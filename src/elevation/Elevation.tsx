// src/elevation/Elevation.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRoom } from '../store';
import { catalogFor, findCatalogItem } from '../engine/catalog';
import { rotatedDims } from '../engine/geometry';
import { elevationView, offsetOnWall, wallLength, wallPlacement, type ElevationItem } from '../engine/elevation';
import { wallColor } from '../engine/wallColor';
import { wallChipLabel, wallCompassLetter, wallLabel, wallPositionName } from '../engine/wallNames';
import { newId } from '../engine/ids';
import { WALLS, type Op, type Wall } from '../engine/types';
import { Glyph, darken } from '../plan/glyphs';
import { ACCENT, GRID_MAJOR, INK, INK_DIM, PAPER } from '../plan/tokens';
import Viewport from '../ui/Viewport';
import { BTN_SM, BTN_SM_ON, LABEL, SEG, SEG_ITEM, SEG_ITEM_ON } from '../ui/styles';
import ViewToggle from './ViewToggle';

/** Margin around the wall, in the drawing's own centimetres. */
const PAD = 34;
/** How much floor the drawing shows below the wall, so the room has a ground to stand on. */
const GROUND = 46;
/** Baseboard height in cm — the same 8 cm the 3D view uses. */
const BASEBOARD = 8;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * Smallest box the marks inside a glyph still fit in, in cm.
 *
 * A rug is one centimetre tall, so seen from the side it is a line on the floor and its glyph's
 * inset would be wider than the box it sits in. Below this the rectangle is drawn and the mark
 * is not, which is also the honest reading: there is nothing there to see.
 */
const GLYPH_MIN_CM = 14;

/** The wall the item sits on runs along x for top and bottom, along y for left and right. */
const horizontal = (wall: Wall) => wall === 'top' || wall === 'bottom';

/**
 * One wall of the room, drawn straight on.
 *
 * The plan says where furniture stands and the 3D view says what the room feels like; neither
 * answers "how high, and how far along". That is the question decoration is made of, so this
 * view draws the wall flat: its paint, its openings at their real sills, everything hanging on
 * it, and — faintly — the furniture standing in front of it, because a picture is hung relative
 * to the sofa under it and not to the corner of the room.
 *
 * All geometry is in centimetres, and the SVG viewBox does the scaling. y is measured down from
 * the ceiling, so `yOf` is the only place that flips a height above the floor into a coordinate.
 */
export default function Elevation() {
  const room = useRoom((s) => s.rooms[s.currentId]!);
  const wall = useRoom((s) => s.ui.elevationWall);
  const selectedId = useRoom((s) => s.ui.selectedItemId);
  const setElevationWall = useRoom((s) => s.setElevationWall);
  const setHighlightWall = useRoom((s) => s.setHighlightWall);
  const dispatch = useRoom((s) => s.dispatch);
  const select = useRoom((s) => s.select);

  const [hangId, setHangId] = useState<string | null>(null);
  /** While a mounted item is being dragged: its id and the offset it currently reads at. */
  const [drag, setDrag] = useState<{ id: string; offset: number } | null>(null);
  /** Where the cursor is along the wall, so the hang ghost can follow it. */
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Looking at a wall here points the plan and the 3D view at the same one, so "hang it on
  // this wall" never needs a compass to settle which wall that is.
  useEffect(() => {
    setHighlightWall(wall);
    return () => setHighlightWall(null);
  }, [wall, setHighlightWall]);

  const view = useMemo(() => elevationView(room, wall), [room, wall]);
  const hangables = useMemo(() => catalogFor(room).filter((c) => c.category === 'wall'), [room]);
  const hangCat = hangId ? findCatalogItem(room, hangId) : undefined;

  const L = view.length;
  const H = view.height;
  const paint = wallColor(room, wall);
  const yOf = (z: number) => H - z;

  /** Client coordinates to the drawing's own frame: distance along the wall, height above the floor. */
  const toWall = (e: { clientX: number; clientY: number }): { u: number; z: number } | null => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return null;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    return { u: p.x, z: H - p.y };
  };

  /** Where a hang would land: the cursor centered on the item, clamped inside the wall. */
  const hangOffset = (u: number): number => clamp(Math.round(u - (hangCat?.width ?? 0) / 2), 0, Math.max(0, L - (hangCat?.width ?? 0)));

  const hang = (u: number) => {
    if (!hangCat) return;
    const offset = hangOffset(u);
    const p = wallPlacement(room, hangCat, wall, offset);
    const op: Op = {
      type: 'place',
      item: { id: newId('item'), catalogId: hangCat.id, x: Math.round(p.x), y: Math.round(p.y), rotation: p.rotation, locked: false },
    };
    const r = dispatch({ actor: 'human', ops: [op], summary: `Hung ${hangCat.name} on the ${wallPositionName(wall).toLowerCase()} wall at ${offset} cm` });
    if (r.ok) select(op.item.id);
  };

  /**
   * Drag a mounted item along its wall.
   *
   * One `move` op on release rather than one per pointer event: dragging a picture across the
   * wall is a single decision, and the ledger should be able to undo it in one press. The
   * perpendicular coordinate is left exactly as it was, so the item stays flush on its wall
   * however far along it travels.
   */
  const startDrag = (e: React.PointerEvent, m: ElevationItem) => {
    e.stopPropagation();
    select(m.id);
    const item = room.items.find((i) => i.id === m.id);
    const cat = findCatalogItem(room, m.catalogId);
    if (!item || !cat || item.locked) return;
    const start = toWall(e);
    if (!start) return;
    const dims = rotatedDims(cat, item.rotation);
    const span = horizontal(wall) ? dims.w : dims.h;
    const grab = start.u - m.offset;
    const el = e.currentTarget as SVGGElement;
    el.setPointerCapture(e.pointerId);
    let latest = m.offset;

    const move = (ev: PointerEvent) => {
      const at = toWall(ev);
      if (!at) return;
      latest = clamp(Math.round(at.u - grab), 0, Math.max(0, L - span));
      setDrag({ id: m.id, offset: latest });
    };
    const up = () => {
      el.releasePointerCapture(e.pointerId);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      setDrag(null);
      if (latest === m.offset) return;
      const along = latest + span / 2;
      const next = horizontal(wall) ? { x: Math.round(along), y: item.y } : { x: item.x, y: Math.round(along) };
      dispatch({ actor: 'human', ops: [{ type: 'move', id: m.id, x: next.x, y: next.y, rotation: item.rotation }], summary: `Slid ${cat.name} to ${latest} cm along the ${wallPositionName(wall).toLowerCase()} wall` });
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
  };

  const onWallClick = (e: React.PointerEvent) => {
    const at = toWall(e);
    if (!at) return;
    if (hangCat) hang(at.u);
    else select(null);
  };

  const toolbar = <ViewToggle />;

  return (
    <Viewport label="Wall" toolbar={toolbar} tone="light">
      <div className="flex h-full w-full flex-col" style={{ background: PAPER }}>
        <div className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1 px-3 pb-1 pt-7">
          <div className={SEG} role="group" aria-label="Which wall">
            {WALLS.map((w) => {
              const on = w === wall;
              return (
                <button
                  key={w}
                  className={on ? SEG_ITEM_ON : SEG_ITEM}
                  aria-pressed={on}
                  aria-label={`Show the ${w} wall`}
                  title={`The ${wallPositionName(w).toLowerCase()} wall on the plan — ${wallLength(room, w)} cm long, facing ${wallCompassLetter(room, w)}`}
                  onClick={() => setElevationWall(w)}
                >
                  {wallChipLabel(room, w)}
                  {/* The compass is a caption, not the name: it moves when north moves. */}
                  <span className="ml-1 opacity-55">{wallCompassLetter(room, w)}</span>
                </button>
              );
            })}
          </div>
          <span className="font-mono text-[11px] tabular-nums" style={{ color: INK_DIM }}>{L} × {H} cm</span>
        </div>

        <div className="min-h-0 flex-1 px-3 pb-1">
          <svg
            ref={svgRef}
            className="h-full w-full"
            viewBox={`${-PAD} ${-PAD} ${L + 2 * PAD} ${H + PAD + GROUND}`}
            preserveAspectRatio="xMidYMid meet"
            role="img"
            aria-label={`Elevation of the ${wallLabel(room, wall).toLowerCase()}`}
            style={{ cursor: hangCat ? 'copy' : 'default' }}
            onPointerDown={onWallClick}
            onPointerMove={(e) => { const at = toWall(e); setHover(at ? at.u : null); }}
            onPointerLeave={() => setHover(null)}
          >
            {/* the floor the wall stands on */}
            <rect x={-PAD} y={yOf(0)} width={L + 2 * PAD} height={GROUND} fill={GRID_MAJOR} />
            {/* the wall itself, in its own paint */}
            <rect x={0} y={0} width={L} height={H} fill={paint} stroke={INK} strokeOpacity={0.35} strokeWidth={1} />
            {/* skirting, interrupted below by any door drawn over it */}
            <rect x={0} y={yOf(BASEBOARD)} width={L} height={BASEBOARD} fill={INK} fillOpacity={0.45} />

            {/* openings: a door is a hole to the floor, a window sits on its sill */}
            {view.openings.map((o) => (
              <g key={o.id}>
                <rect
                  x={o.offset} y={yOf(o.top)} width={o.width} height={o.height}
                  fill={o.kind === 'door' ? PAPER : '#dfe8f0'}
                  stroke={INK} strokeOpacity={0.6} strokeWidth={1.5}
                />
                {o.kind === 'window' && (
                  <>
                    <line x1={o.offset + o.width / 2} y1={yOf(o.top)} x2={o.offset + o.width / 2} y2={yOf(o.sill)} stroke={INK} strokeOpacity={0.4} strokeWidth={1} />
                    <line x1={o.offset} y1={yOf(o.sill + o.height / 2)} x2={o.offset + o.width} y2={yOf(o.sill + o.height / 2)} stroke={INK} strokeOpacity={0.25} strokeWidth={1} />
                  </>
                )}
                {/* the label sits in the margin above the wall, not on it: a name written on
                    the paint disappears the moment someone paints the wall indigo */}
                <text x={o.offset + o.width / 2} y={-12} textAnchor="middle" fill={INK_DIM} style={{ fontSize: 14 }}>
                  {o.kind === 'window' ? `window · sill ${o.sill}` : `door · ${o.width}`}
                </text>
                <line x1={o.offset + o.width / 2} y1={-8} x2={o.offset + o.width / 2} y2={yOf(o.top)} stroke={INK_DIM} strokeWidth={0.8} strokeDasharray="3 4" />
              </g>
            ))}

            {/* furniture standing in front of the wall, as silhouettes to hang things against */}
            {view.floor.map((f) => {
              // A rug stands 1 cm tall, so it draws as the line on the floor that it is.
              const h = Math.max(2, f.height);
              return (
                <g key={f.id} opacity={clamp(0.34 - f.distance / 500, 0.1, 0.34)}>
                  <rect x={f.offset} y={yOf(f.top)} width={f.width} height={h} rx={2} fill={f.color} stroke={darken(f.color)} strokeWidth={1.5} strokeDasharray="7 5" />
                  {Math.min(f.width, h) >= GLYPH_MIN_CM && (
                    <Glyph shape={f.shape} cx={f.offset + f.width / 2} cy={yOf(f.top) + h / 2} w={f.width} h={h} color={darken(f.color)} />
                  )}
                </g>
              );
            })}

            {/* the floor line, over the silhouettes so the room still has a ground */}
            <line x1={-PAD} y1={yOf(0)} x2={L + PAD} y2={yOf(0)} stroke={INK} strokeOpacity={0.65} strokeWidth={1.5} />

            {/* everything hanging on this wall */}
            {view.mounted.map((m) => {
              const offset = drag?.id === m.id ? drag.offset : m.offset;
              const on = selectedId === m.id;
              const ink = darken(m.color);
              return (
                <g
                  key={m.id}
                  role="button"
                  aria-label={`${m.name} at ${offset} cm, ${m.bottom} cm up`}
                  tabIndex={0}
                  style={{ cursor: m.locked ? 'not-allowed' : 'ew-resize' }}
                  onPointerDown={(e) => startDrag(e, m)}
                >
                  <rect x={offset} y={yOf(m.top)} width={m.width} height={Math.max(2, m.height)} rx={2} fill={m.color} stroke={ink} strokeWidth={1.5} />
                  {Math.min(m.width, m.height) >= GLYPH_MIN_CM && (
                    <Glyph shape={m.shape} cx={offset + m.width / 2} cy={yOf(m.top) + m.height / 2} w={m.width} h={m.height} color={ink} />
                  )}
                  {on && <rect x={offset - 4} y={yOf(m.top) - 4} width={m.width + 8} height={m.height + 8} rx={4} fill="none" stroke={ACCENT} strokeWidth={2} />}
                  {/* the drop from the floor to its underside: the number decoration is really about */}
                  {on && (
                    <>
                      <line x1={offset + m.width / 2} y1={yOf(m.bottom)} x2={offset + m.width / 2} y2={yOf(0)} stroke={ACCENT} strokeWidth={1} strokeDasharray="4 4" />
                      <text x={offset + m.width / 2 + 5} y={yOf(m.bottom / 2)} fill={ACCENT} style={{ fontSize: 13 }}>{m.bottom} cm</text>
                    </>
                  )}
                </g>
              );
            })}

            {/* the ghost of what is about to be hung */}
            {hangCat && hover !== null && (
              <rect
                x={hangOffset(hover)} y={yOf((hangCat.mountHeight ?? 0) + hangCat.height)}
                width={hangCat.width} height={hangCat.height} rx={2}
                fill={hangCat.color} opacity={0.45} stroke={ACCENT} strokeWidth={1.5} strokeDasharray="5 4"
              />
            )}
          </svg>
        </div>

        {/* the Hang strip: pick a piece, then click the wall where it goes */}
        <div className="shrink-0 border-t border-line bg-panel px-3 py-1.5">
          <div className="flex items-center gap-2">
            <strong className={LABEL}>Hang</strong>
            <span className="text-[11px] text-muted">
              {/* The bare position reads as a sentence; the opening suffix belongs on a chip. */}
              {hangCat
                ? `Click the ${wallPositionName(wall).toLowerCase()} wall to hang the ${hangCat.name.toLowerCase()}.`
                : `Pick a piece, then click the ${wallPositionName(wall).toLowerCase()} wall.`}
            </span>
            {hangCat && <button className={BTN_SM} onClick={() => setHangId(null)}>Cancel</button>}
          </div>
          <div className="mt-1 flex gap-1 overflow-x-auto pb-0.5">
            {hangables.map((c) => (
              <button
                key={c.id}
                className={hangId === c.id ? BTN_SM_ON : BTN_SM}
                aria-pressed={hangId === c.id}
                title={`${c.name} — ${c.width}×${c.height} cm, hangs at ${c.mountHeight} cm`}
                onClick={() => setHangId((v) => (v === c.id ? null : c.id))}
              >
                <span className="h-2.5 w-2.5 rounded-[2px] ring-1 ring-black/25" style={{ background: c.color }} />
                {c.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Viewport>
  );
}

/** Exported for the tools and the panel: which wall an item already on the wall reads at. */
export { offsetOnWall };
