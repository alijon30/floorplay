// src/plan/HomePlan.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRoom } from '../store';
import type { Doorway, Rect, Room, Wall } from '../engine/types';
import { homeBounds, placementOf, sharedSegments, snapRoomPlacement } from '../engine/home';
import { TEMPLATES } from '../engine/templates';
import { FLOOR_PLAN_FILL } from '../finishes';
import Viewport from '../ui/Viewport';
import { useDismiss } from '../ui/useDismiss';
import { useAddRoom } from '../ui/homeActions';
import Tool, { PLAN_MENU, PLAN_MENU_ITEM, PLAN_MENU_LABEL } from './Tool';
import PlanViewToggle from './PlanViewToggle';
import { ACCENT, BAD, INK, INK_DIM, PAPER } from './tokens';
import Grid from './layers/Grid';
import Shell, { WALL_CM } from './layers/Shell';
import Openings from './layers/Openings';
import Items from './layers/Items';

/** Room from the outermost wall to the edge of the sheet, in centimetres. */
const PAD = 90;
const MIN_ZOOM = 0.4;
const MAX_ZOOM = 4;
/** Every doorway this view cuts is a single interior door. */
const DOORWAY_CM = 80;
/** Rooms are dragged on a 5 cm grid; the 20 cm snap does the rest. */
const step = (v: number) => Math.round(v / 5) * 5;
const EPS = 0.001;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** What the plan is telling you about the last thing you did. Cleared on its own. */
interface Note { tone: 'bad' | 'warn'; text: string }

/** A stretch of wall two rooms share, in the coordinates the drawing is in. */
interface WallSeg {
  key: string;
  roomId: string;
  otherRoomId: string;
  wall: Wall;
  /** Along that room's own wall, the same origin every `Opening.offset` uses. */
  start: number;
  end: number;
  x1: number; y1: number; x2: number; y2: number;
  /** The room's top-left on the plan, for turning a click back into an offset. */
  originX: number; originY: number;
}

/** The viewport's size in device pixels, so the drawing can size its text in them. */
function useSize(ref: React.RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ w: 640, h: 640 });
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([entry]) => {
      const r = entry?.contentRect;
      if (r && r.width > 0 && r.height > 0) setSize({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

/**
 * The edges where a placement has come to rest against a neighbour's.
 *
 * Drawn while a room is being dragged, so the wall it is about to meet is named before the
 * mouse is let go rather than after. Only the overlapping stretch is marked: two rooms that
 * meet along 40 cm of a 400 cm wall have not really met.
 */
function flushEdges(rect: Rect, neighbours: Rect[]): { x1: number; y1: number; x2: number; y2: number }[] {
  const out: { x1: number; y1: number; x2: number; y2: number }[] = [];
  for (const n of neighbours) {
    const yS = Math.max(rect.y, n.y), yE = Math.min(rect.y + rect.h, n.y + n.h);
    if (yE - yS > EPS) {
      if (Math.abs(rect.x + rect.w - n.x) < EPS) out.push({ x1: rect.x + rect.w, y1: yS, x2: rect.x + rect.w, y2: yE });
      if (Math.abs(rect.x - (n.x + n.w)) < EPS) out.push({ x1: rect.x, y1: yS, x2: rect.x, y2: yE });
    }
    const xS = Math.max(rect.x, n.x), xE = Math.min(rect.x + rect.w, n.x + n.w);
    if (xE - xS > EPS) {
      if (Math.abs(rect.y + rect.h - n.y) < EPS) out.push({ x1: xS, y1: rect.y + rect.h, x2: xE, y2: rect.y + rect.h });
      if (Math.abs(rect.y - (n.y + n.h)) < EPS) out.push({ x1: xS, y1: rect.y, x2: xE, y2: rect.y });
    }
  }
  return out;
}

/** Where a doorway sits on the plan, read off the side that owns the door leaf. */
function doorwayPoint(x: number, y: number, room: Room, d: Doorway): { cx: number; cy: number } {
  const mid = d.a.offset + d.width / 2;
  switch (d.a.wall) {
    case 'top': return { cx: x + mid, cy: y };
    case 'bottom': return { cx: x + mid, cy: y + room.depth };
    case 'left': return { cx: x, cy: y + mid };
    case 'right': return { cx: x + room.width, cy: y + mid };
  }
}

/**
 * The whole home on one sheet: every room at its offset, drawn with the same layers the room
 * plan uses, inside a `<g>` that carries it to its place.
 *
 * Shared walls are drawn twice, once by each room, which puts a 20 cm band where a real plan
 * would draw 10. That is what makes the seam between two rooms read as a seam, and it costs
 * nothing: every doorway is cut out of both bands by the openings the two rooms already carry,
 * so a door still reads as one hole through one wall.
 */
export default function HomePlan() {
  const rooms = useRoom((s) => s.rooms);
  const home = useRoom((s) => s.currentHome());
  const currentId = useRoom((s) => s.currentId);
  const showGrid = useRoom((s) => s.ui.showGrid);
  const doorwayMode = useRoom((s) => s.ui.doorwayMode);
  const setDoorwayMode = useRoom((s) => s.setDoorwayMode);
  const setShowGrid = useRoom((s) => s.setShowGrid);
  const switchRoom = useRoom((s) => s.switchRoom);
  const moveRoom = useRoom((s) => s.moveRoom);
  const cutDoorway = useRoom((s) => s.cutDoorway);
  const removeDoorway = useRoom((s) => s.removeDoorway);
  const { standalone, addExisting, addTemplate } = useAddRoom(home);

  const svgRef = useRef<SVGSVGElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const size = useSize(frameRef);
  const [zoom, setZoom] = useState(1);
  const [drag, setDrag] = useState<{ roomId: string; offX: number; offY: number; moved: boolean } | null>(null);
  const [dragPos, setDragPos] = useState<{ roomId: string; x: number; y: number; overlaps: string[] } | null>(null);
  const [hoverSeg, setHoverSeg] = useState<string | null>(null);
  const [hoverDoorway, setHoverDoorway] = useState<string | null>(null);
  const [note, setNote] = useState<Note | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const closeAdd = useCallback(() => setAddOpen(false), []);
  useDismiss(addOpen, menuRef, closeAdd);

  // A note is about the move you just made, not a state of the plan, so it goes on its own.
  useEffect(() => {
    if (!note) return;
    const t = setTimeout(() => setNote(null), 7000);
    return () => clearTimeout(t);
  }, [note]);

  const bounds = useMemo(() => (home ? homeBounds(home, rooms) : { x: 0, y: 0, w: 0, h: 0 }), [home, rooms]);

  const view = useMemo(() => {
    const bw = Math.max(200, bounds.w) + 2 * PAD, bh = Math.max(200, bounds.h) + 2 * PAD;
    const w = bw / zoom, h = bh / zoom;
    const box = { x: bounds.x - PAD + (bw - w) / 2, y: bounds.y - PAD + (bh - h) / 2, w, h };
    const u = Math.max(w / Math.max(1, size.w), h / Math.max(1, size.h));
    return { box, u };
  }, [bounds.x, bounds.y, bounds.w, bounds.h, zoom, size.w, size.h]);
  const u = view.u;

  const toCm = useCallback((e: { clientX: number; clientY: number }) => {
    const svg = svgRef.current!;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    return { x: p.x, y: p.y };
  }, []);

  /** Every shared wall, once. Each pair meets on one room's right or bottom and the other's
      left or top, so keeping those two sides names every seam exactly once — and the room
      that owns it is the one the door will swing into. */
  const segments = useMemo<WallSeg[]>(() => {
    if (!home || !doorwayMode) return [];
    return home.rooms.flatMap((p) => {
      const room = rooms[p.roomId];
      if (!room) return [];
      return sharedSegments(home, rooms, p.roomId)
        .filter((s) => s.wall === 'right' || s.wall === 'bottom')
        .map((s) => ({
          key: `${p.roomId}:${s.otherRoomId}:${s.wall}:${s.start}`,
          roomId: p.roomId, otherRoomId: s.otherRoomId, wall: s.wall, start: s.start, end: s.end,
          originX: p.x, originY: p.y,
          ...(s.wall === 'right'
            ? { x1: p.x + room.width, y1: p.y + s.start, x2: p.x + room.width, y2: p.y + s.end }
            : { x1: p.x + s.start, y1: p.y + room.depth, x2: p.x + s.end, y2: p.y + room.depth }),
        }));
    });
  }, [home, rooms, doorwayMode]);

  if (!home) return null;

  const placements = home.rooms.filter((p) => rooms[p.roomId]);
  const livePos = (roomId: string) => (dragPos?.roomId === roomId ? dragPos : null);

  const onRoomDown = (e: React.PointerEvent, roomId: string) => {
    if (e.button !== 0) return;
    const p = placementOf(home, roomId);
    if (!p) return;
    const at = toCm(e);
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    setDrag({ roomId, offX: p.x - at.x, offY: p.y - at.y, moved: false });
  };

  const onMove = (e: React.PointerEvent) => {
    // While the doorway tool is out, a press on a room is only ever a press: cutting a door and
    // shifting the room it is cut through are not gestures anyone wants to confuse.
    if (!drag || doorwayMode) return;
    const room = rooms[drag.roomId];
    if (!room) return;
    const at = toCm(e);
    const s = snapRoomPlacement(home, rooms, drag.roomId, step(at.x + drag.offX), step(at.y + drag.offY), room.width, room.depth);
    setDragPos({ roomId: drag.roomId, x: s.x, y: s.y, overlaps: s.overlaps });
    if (!drag.moved) setDrag({ ...drag, moved: true });
  };

  const onUp = () => {
    if (!drag) return;
    const room = rooms[drag.roomId];
    if (!drag.moved) switchRoom(drag.roomId);
    else if (dragPos && room) {
      const r = moveRoom(drag.roomId, dragPos.x, dragPos.y);
      if (!r.ok) setNote({ tone: 'bad', text: r.error });
      else if (r.removedDoorways.length) {
        const n = r.removedDoorways.length;
        setNote({ tone: 'warn', text: `Moving ${room.name} took ${n} doorway${n === 1 ? '' : 's'} with it: an opening only joins two rooms while both halves meet. Cut ${n === 1 ? 'it' : 'them'} again where the rooms meet now.` });
      } else setNote(null);
    }
    setDrag(null);
    setDragPos(null);
  };

  const onSegmentDown = (e: React.PointerEvent, seg: WallSeg) => {
    e.stopPropagation();
    const room = rooms[seg.roomId];
    if (!room) return;
    const span = seg.end - seg.start;
    if (span < DOORWAY_CM) {
      setNote({ tone: 'bad', text: `${room.name} shares only ${Math.round(span)} cm of that wall, and a doorway needs ${DOORWAY_CM} cm.` });
      return;
    }
    const at = toCm(e);
    const along = seg.wall === 'right' ? at.y - seg.originY : at.x - seg.originX;
    const offset = clamp(step(along - DOORWAY_CM / 2), seg.start, seg.end - DOORWAY_CM);
    const r = cutDoorway({ roomId: seg.roomId, wall: seg.wall, offset, width: DOORWAY_CM, kind: 'door', otherRoomId: seg.otherRoomId });
    setNote(r.ok ? null : { tone: 'bad', text: r.hint ? `${r.error}. ${r.hint}` : r.error });
  };

  const add = (r: { ok: true } | { ok: false; error: string }) => {
    closeAdd();
    setNote(r.ok ? null : { tone: 'bad', text: r.error });
  };

  const toolbar = (
    <>
      <PlanViewToggle />
      <div className="relative" ref={menuRef}>
        <Tool label="Add a room to this home" hint="Put another room on this floor plan" text="Add room" icon="roomAdd" expanded={addOpen} onClick={() => setAddOpen((o) => !o)} />
        {addOpen && (
          <div className={`${PLAN_MENU} max-h-[420px] w-64 overflow-y-auto`}>
            {standalone.length > 0 && (
              <>
                <div className={PLAN_MENU_LABEL}>Rooms you already have</div>
                {standalone.map((r) => (
                  <button key={r.id} className={PLAN_MENU_ITEM} onClick={() => add(addExisting(r.id))}>
                    <span className="min-w-0 flex-1 truncate">{r.name}</span>
                    <span className="shrink-0 font-mono text-[10.5px] tabular-nums text-[var(--plan-dim)]">{r.width}×{r.depth}</span>
                  </button>
                ))}
              </>
            )}
            <div className={PLAN_MENU_LABEL}>Ready-made rooms</div>
            {TEMPLATES.map((t) => (
              <button key={t.key} className={PLAN_MENU_ITEM} title={t.blurb} onClick={() => add(addTemplate(t.key))}>
                <span className="min-w-0 flex-1 truncate">{t.name}</span>
                <span className="shrink-0 font-mono text-[10.5px] tabular-nums text-[var(--plan-dim)]">{t.width}×{t.depth}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <Tool
        on={doorwayMode}
        label="Cut a doorway"
        hint="Click a wall two rooms share to cut an 80 cm door through it"
        text="Cut doorway"
        icon="doorway"
        onClick={() => { setDoorwayMode(!doorwayMode); setNote(null); }}
      />
      <Tool on={showGrid} label="Grid" text="Grid" icon="grid" onClick={() => setShowGrid(!showGrid)} />
      <Tool label="Zoom out" hint="Zoom out. The mouse wheel zooms too." icon="minus" disabled={zoom <= MIN_ZOOM} onClick={() => setZoom((z) => Math.max(MIN_ZOOM, Math.round(z / 1.25 * 100) / 100))} />
      <Tool label="Fit to view" hint="Put the whole home back on screen. The mouse wheel zooms." text="Fit" icon="fit" onClick={() => setZoom(1)} />
      <Tool label="Zoom in" hint="Zoom in. The mouse wheel zooms too." icon="plus" disabled={zoom >= MAX_ZOOM} onClick={() => setZoom((z) => Math.min(MAX_ZOOM, Math.round(z * 1.25 * 100) / 100))} />
    </>
  );

  const dragging = dragPos && rooms[dragPos.roomId];
  const guides = dragging
    ? flushEdges(
      { x: dragPos.x, y: dragPos.y, w: dragging.width, h: dragging.depth },
      placements.filter((p) => p.roomId !== dragPos.roomId).map((p) => ({ x: p.x, y: p.y, w: rooms[p.roomId]!.width, h: rooms[p.roomId]!.depth })),
    )
    : [];

  // The viewport is named "Home" rather than after the home itself: its label sits opposite the
  // toolbar in a box that can be half a window wide, and a long flat name would run under the
  // tools. The name is on the status strip and at the head of the Room tab.
  return (
    <Viewport label="Home" tone="light" toolbar={toolbar}>
      <div
        ref={frameRef}
        className="h-full w-full outline-none"
        style={{ background: PAPER }}
        onWheel={(e) => setZoom((z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z * Math.exp(-e.deltaY * 0.0012))))}
      >
        {/* `data-home-plan` is how a script maps home centimetres to screen pixels through
            `getScreenCTM`, which is the only honest way to click a wall two rooms share. */}
        <svg
          ref={svgRef}
          data-home-plan=""
          className="h-full w-full select-none"
          viewBox={`${view.box.x} ${view.box.y} ${view.box.w} ${view.box.h}`}
          preserveAspectRatio="xMidYMid meet"
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerLeave={onUp}
        >
          {placements.map((p) => {
            const room = rooms[p.roomId]!;
            const live = livePos(p.roomId);
            const at = live ?? p;
            const current = p.roomId === currentId;
            const bad = (live?.overlaps.length ?? 0) > 0;
            return (
              <g
                key={p.roomId}
                data-room={p.roomId}
                transform={`translate(${at.x} ${at.y})`}
                className={doorwayMode ? 'cursor-pointer' : 'cursor-grab'}
                opacity={live ? 0.9 : 1}
                onPointerDown={(e) => onRoomDown(e, p.roomId)}
              >
                <title>{`${room.name} · ${room.width}×${room.depth} cm · ${room.items.length} items`}</title>
                {/* The room itself, at the weight the single-room plan draws it, dimmed a step
                    when it is not the one being worked on. */}
                <g opacity={current ? 1 : 0.55}>
                  <rect x={0} y={0} width={room.width} height={room.depth} fill={FLOOR_PLAN_FILL[room.finish.floor]} />
                  {showGrid && <Grid width={room.width} depth={room.depth} u={u} />}
                  <Shell room={room} />
                  <Openings room={room} u={u} />
                  <Items room={room} selectedId={null} dragPos={null} u={u} onPointerDown={() => {}} />
                </g>
                {(current || bad) && (
                  <rect
                    x={0} y={0} width={room.width} height={room.depth}
                    fill="none" stroke={bad ? BAD : ACCENT} strokeWidth={2.5} vectorEffect="non-scaling-stroke" pointerEvents="none"
                  />
                )}
                {/* The name is the only thing on this sheet that is not to scale, so it carries a
                    paper halo rather than a box: legible over a rug, and still a drawing. */}
                <text
                  x={13 * u} y={17 * u} fill={current ? INK : INK_DIM} fontSize={11.5 * u}
                  stroke={PAPER} strokeWidth={3.5 * u} paintOrder="stroke" pointerEvents="none"
                  style={{ fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: `${0.7 * u}px` }}
                >{room.name}</text>
                <text
                  x={13 * u} y={30 * u} fill={INK_DIM} fontSize={9.5 * u}
                  stroke={PAPER} strokeWidth={3 * u} paintOrder="stroke" pointerEvents="none"
                  style={{ fontFamily: 'var(--font-mono)' }}
                >{room.width}×{room.depth} cm</text>
              </g>
            );
          })}

          {/* The wall the dragged room is about to meet, marked before the mouse is let go. */}
          {guides.map((g, i) => (
            <line key={i} x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2} stroke={ACCENT} strokeWidth={4} strokeLinecap="round" vectorEffect="non-scaling-stroke" pointerEvents="none" />
          ))}

          {doorwayMode && segments.map((s) => (
            <g key={s.key} className="cursor-pointer" onPointerDown={(e) => onSegmentDown(e, s)} onPointerEnter={() => setHoverSeg(s.key)} onPointerLeave={() => setHoverSeg((k) => (k === s.key ? null : k))}>
              <title>{`Cut an ${DOORWAY_CM} cm doorway between ${rooms[s.roomId]?.name} and ${rooms[s.otherRoomId]?.name}`}</title>
              <line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke="transparent" strokeWidth={WALL_CM * 4} />
              <line
                x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
                stroke={ACCENT} strokeOpacity={hoverSeg === s.key ? 0.75 : 0.28} strokeWidth={WALL_CM * 2} pointerEvents="none"
              />
            </g>
          ))}

          {doorwayMode && home.doorways.map((d) => {
            const p = placementOf(home, d.a.roomId);
            const room = rooms[d.a.roomId];
            if (!p || !room) return null;
            const { cx, cy } = doorwayPoint(p.x, p.y, room, d);
            const on = hoverDoorway === d.id;
            const r = 11 * u;
            return (
              <g
                key={d.id}
                className="cursor-pointer"
                onPointerEnter={() => setHoverDoorway(d.id)}
                onPointerLeave={() => setHoverDoorway((k) => (k === d.id ? null : k))}
                onPointerDown={(e) => { e.stopPropagation(); removeDoorway(d.id); setHoverDoorway(null); }}
              >
                <title>{`Remove the doorway between ${room.name} and ${rooms[d.b.roomId]?.name ?? 'the next room'}`}</title>
                <circle cx={cx} cy={cy} r={r * 1.4} fill="transparent" />
                <circle cx={cx} cy={cy} r={r} fill={on ? BAD : PAPER} fillOpacity={on ? 1 : 0.85} stroke={on ? BAD : INK_DIM} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
                <path
                  d={`M ${cx - r * 0.4} ${cy - r * 0.4} L ${cx + r * 0.4} ${cy + r * 0.4} M ${cx + r * 0.4} ${cy - r * 0.4} L ${cx - r * 0.4} ${cy + r * 0.4}`}
                  stroke={on ? PAPER : INK_DIM} strokeWidth={1.8} strokeLinecap="round" vectorEffect="non-scaling-stroke" fill="none"
                />
              </g>
            );
          })}
        </svg>
      </div>

      <div className="pointer-events-none absolute bottom-3 left-3 right-3 flex flex-col items-start gap-1.5">
        {doorwayMode && (
          <span className="rounded-md border border-accent/40 bg-white/90 px-2 py-1 text-[11.5px] text-[var(--plan-ink)] shadow-sm">
            Click a wall two rooms share to cut an {DOORWAY_CM} cm doorway there, or a doorway’s × to take it out.
          </span>
        )}
        {note && (
          <button
            type="button"
            role="alert"
            onClick={() => setNote(null)}
            className={`pointer-events-auto max-w-[min(560px,100%)] rounded-md border px-2 py-1 text-left text-[11.5px] leading-snug shadow-sm ${
              note.tone === 'bad' ? 'border-bad/50 bg-bad/12 text-bad' : 'border-warn/50 bg-white/95 text-[var(--plan-ink)]'
            }`}
          >{note.text}</button>
        )}
        {placements.length === 0 && (
          <span className="rounded-md border border-black/10 bg-white/90 px-2 py-1 text-[11.5px] text-[var(--plan-ink)] shadow-sm">
            This home has no rooms yet. Add one with the Add room button.
          </span>
        )}
      </div>
    </Viewport>
  );
}
