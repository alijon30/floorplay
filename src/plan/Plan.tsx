// src/plan/Plan.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRoom } from '../store';
import type { PlacedItem, Rotation, Wall } from '../engine/types';
import { WALLS } from '../engine/types';
import { BLOCKING_KINDS, nearestValid } from '../engine/nearest';
import { snapToWall, suggestPositions } from '../engine/anchors';
import { itemViolations } from '../engine/validate';
import { FLOOR_PLAN_FILL } from '../finishes';
import Viewport from '../ui/Viewport';
import { Icon } from '../ui/icons';
import { ghostsFor, type Ghost } from './ghosts';
import { ACCENT, PAPER } from './tokens';
import Grid from './layers/Grid';
import Shell from './layers/Shell';
import Openings from './layers/Openings';
import Dimensions from './layers/Dimensions';
import Daylight from './layers/Daylight';
import Violations from './layers/Violations';
import Items, { type Fit } from './layers/Items';
import Ghosts from './layers/Ghosts';

const snap = (v: number) => Math.round(v / 5) * 5;
/** Room to the wall band, the dimension run and its number, in centimetres. */
const PAD = 62;
/** Half the snap guide's stroke, so the 4 cm line sits just inside the wall it marks. */
const SNAP_LINE_INSET = 2;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;

type Drag =
  | { kind: 'item'; id: string; offX: number; offY: number; moved: boolean }
  | { kind: 'ghost'; ghost: Ghost; offX: number; offY: number; moved: boolean };

/** Endpoints of the guide drawn along the inside face of `wall`. */
function wallLine(wall: Wall, width: number, depth: number): { x1: number; y1: number; x2: number; y2: number } {
  switch (wall) {
    case 'top': return { x1: 0, y1: SNAP_LINE_INSET, x2: width, y2: SNAP_LINE_INSET };
    case 'bottom': return { x1: 0, y1: depth - SNAP_LINE_INSET, x2: width, y2: depth - SNAP_LINE_INSET };
    case 'left': return { x1: SNAP_LINE_INSET, y1: 0, x2: SNAP_LINE_INSET, y2: depth };
    case 'right': return { x1: width - SNAP_LINE_INSET, y1: 0, x2: width - SNAP_LINE_INSET, y2: depth };
  }
}

/** The viewport's size in device pixels, so the drawing can size its text and handles in them. */
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

/** One of the plan's own tools. */
function Tool({ on, label, icon, onClick }: { on?: boolean; label: string; icon: Parameters<typeof Icon>[0]['name']; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={on === undefined ? undefined : on}
      title={label}
      onClick={onClick}
      className={`inline-flex h-7 w-7 items-center justify-center rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent ${
        on ? 'border-accent/50 bg-[var(--accent-fill)] text-accent' : 'border-black/8 bg-white/70 text-[var(--plan-ink-soft)] hover:bg-white hover:text-[var(--plan-ink)]'
      }`}
    >
      <Icon name={icon} />
    </button>
  );
}

export default function Plan() {
  const room = useRoom((s) => s.rooms[s.currentId]!);
  const analysis = useRoom((s) => s.analysis);
  const ui = useRoom((s) => s.ui);
  const { dispatch, select, undo, updateProposalOp, setShowDaylight, setShowGrid, setNorthWall } = useRoom((s) => s);
  const svgRef = useRef<SVGSVGElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const size = useSize(frameRef);
  const [zoom, setZoom] = useState(1);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [dragPos, setDragPos] = useState<{ id: string; x: number; y: number } | null>(null);
  const [ghostPos, setGhostPos] = useState<{ key: string; x: number; y: number } | null>(null);
  const [fit, setFit] = useState<Fit>(null);
  const [snapWall, setSnapWall] = useState<Wall | null>(null);

  const ghosts = useMemo(() => {
    const list = ghostsFor(room, room.proposals, ui.hoveredProposalId);
    return ghostPos ? list.map((g) => (`${g.proposalId}:${g.opIndex}` === ghostPos.key ? { ...g, x: ghostPos.x, y: ghostPos.y, rect: { ...g.rect, x: ghostPos.x - g.rect.w / 2, y: ghostPos.y - g.rect.h / 2 } } : g)) : list;
  }, [room, ui.hoveredProposalId, ghostPos]);

  // The whole sheet, then zoom in on its middle. `u` is centimetres per screen pixel, and
  // every text size and handle in the drawing is a multiple of it, so a 500 cm room and a
  // 900 cm one carry labels the same height.
  const view = useMemo(() => {
    const bw = room.width + 2 * PAD, bh = room.depth + 2 * PAD;
    const w = bw / zoom, h = bh / zoom;
    const box = { x: -PAD + (bw - w) / 2, y: -PAD + (bh - h) / 2, w, h };
    const u = Math.max(w / Math.max(1, size.w), h / Math.max(1, size.h));
    return { box, u };
  }, [room.width, room.depth, zoom, size.w, size.h]);
  const u = view.u;

  const toCm = useCallback((e: { clientX: number; clientY: number }) => {
    const svg = svgRef.current!;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    return { x: p.x, y: p.y };
  }, []);

  const onItemDown = (e: React.PointerEvent, item: PlacedItem) => {
    e.stopPropagation();
    select(item.id);
    if (item.locked) return;
    const p = toCm(e);
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    setDrag({ kind: 'item', id: item.id, offX: item.x - p.x, offY: item.y - p.y, moved: false });
  };

  const onGhostDown = (e: React.PointerEvent, ghost: Ghost) => {
    e.stopPropagation();
    const p = toCm(e);
    setDrag({ kind: 'ghost', ghost, offX: ghost.x - p.x, offY: ghost.y - p.y, moved: false });
  };

  const onMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const p = toCm(e);
    const x = snap(p.x + drag.offX), y = snap(p.y + drag.offY);
    if (drag.kind === 'item') {
      setDragPos({ id: drag.id, x, y });
      setDrag({ ...drag, moved: true });
      const item = room.items.find((i) => i.id === drag.id);
      if (item) {
        setFit(itemViolations(room, { ...item, x, y }).some((v) => BLOCKING_KINDS.has(v.kind)) ? 'bad' : 'ok');
        const s = snapToWall(room, item.catalogId, x, y, item.rotation);
        setSnapWall(s.snapped ? s.wall ?? null : null);
      }
    }
    else { setGhostPos({ key: `${drag.ghost.proposalId}:${drag.ghost.opIndex}`, x, y }); setDrag({ ...drag, moved: true }); }
  };

  const onUp = () => {
    if (!drag) return;
    if (drag.kind === 'item' && drag.moved && dragPos) {
      const item = room.items.find((i) => i.id === drag.id);
      if (item) {
        // Pull flush to a wall when the drop landed near one, but never at the cost of pushing
        // the footprint outside the room.
        const s = snapToWall(room, item.catalogId, dragPos.x, dragPos.y, item.rotation);
        const snapFits = s.snapped && !itemViolations(room, { ...item, x: s.x, y: s.y, rotation: s.rotation }).some((v) => v.kind === 'out_of_bounds');
        const next = snapFits ? { x: s.x, y: s.y, rotation: s.rotation } : { x: dragPos.x, y: dragPos.y, rotation: item.rotation };
        if (next.x !== item.x || next.y !== item.y || next.rotation !== item.rotation) {
          dispatch({ actor: 'human', ops: [{ type: 'move', id: item.id, x: next.x, y: next.y, rotation: next.rotation }] });
        }
      }
    }
    if (drag.kind === 'ghost' && drag.moved && ghostPos) {
      const g = drag.ghost;
      const p = room.proposals.find((x) => x.id === g.proposalId);
      const op = p?.ops[g.opIndex];
      if (op?.type === 'place') updateProposalOp(g.proposalId, g.opIndex, { type: 'place', item: { ...op.item, x: ghostPos.x, y: ghostPos.y } });
      if (op?.type === 'move') updateProposalOp(g.proposalId, g.opIndex, { ...op, x: ghostPos.x, y: ghostPos.y });
    }
    setDrag(null); setDragPos(null); setGhostPos(null); setFit(null); setSnapWall(null);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); return; }
    const item = ui.selectedItemId ? room.items.find((i) => i.id === ui.selectedItemId) : undefined;
    if (e.key === 'Escape') { select(null); return; }
    if (!item) return;
    if (e.key.toLowerCase() === 'l') { dispatch({ actor: 'human', ops: [{ type: 'setLocked', id: item.id, locked: !item.locked }] }); return; }
    if (item.locked) return;
    if (e.key.toLowerCase() === 'r') { dispatch({ actor: 'human', ops: [{ type: 'move', id: item.id, x: item.x, y: item.y, rotation: (((item.rotation + 90) % 360) as Rotation) }] }); }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); dispatch({ actor: 'human', ops: [{ type: 'remove', id: item.id }] }); select(null); }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const catalogId = e.dataTransfer.getData('text/floorplay-catalog');
    if (!catalogId) return;
    const p = toCm(e);
    const cx = snap(p.x), cy = snap(p.y);
    // Where the cursor let go wins whenever it works, so a deliberate drop is never overridden;
    // a suggestion (then the nearest clear spot) only steps in when it does not.
    const s = snapToWall(room, catalogId, cx, cy, 0);
    const cursorOk = itemViolations(room, { id: '__drop', catalogId, x: s.x, y: s.y, rotation: s.rotation, locked: false }).every((v) => !BLOCKING_KINDS.has(v.kind));
    const suggested = cursorOk ? undefined : suggestPositions(room, catalogId, { count: 1 })[0];
    const near = cursorOk || suggested ? null : nearestValid(room, catalogId, cx, cy, 0);
    const pos = cursorOk
      ? { x: s.x, y: s.y, rotation: s.rotation }
      : suggested
        ? { x: suggested.x, y: suggested.y, rotation: suggested.rotation }
        : near
          ? { x: near.x, y: near.y, rotation: 0 as Rotation }
          : { x: cx, y: cy, rotation: 0 as Rotation };
    const id = `item_${Date.now().toString(36)}`;
    dispatch({ actor: 'human', ops: [{ type: 'place', item: { id, catalogId, x: pos.x, y: pos.y, rotation: pos.rotation, locked: false } }] });
    select(id);
  };

  const guide = snapWall ? wallLine(snapWall, room.width, room.depth) : null;

  const toolbar = (
    <>
      <div role="group" aria-label="North wall" className="inline-flex h-7 items-center gap-px rounded-md border border-black/8 bg-white/70 p-px">
        <span className="px-1.5 text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--plan-dim)]">N</span>
        {WALLS.map((w) => (
          <button
            key={w}
            type="button"
            aria-label={`North is the ${w} wall`}
            aria-pressed={room.northWall === w}
            title={`North is the ${w} wall`}
            onClick={() => setNorthWall(w)}
            className={`inline-flex h-[22px] w-[22px] items-center justify-center rounded-[4px] font-mono text-[10px] uppercase transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent ${
              room.northWall === w ? 'bg-[var(--accent-fill)] font-medium text-accent' : 'text-[var(--plan-dim)] hover:text-[var(--plan-ink)]'
            }`}
          >{w[0]}</button>
        ))}
      </div>
      <Tool on={ui.showGrid} label="Grid" icon="grid" onClick={() => setShowGrid(!ui.showGrid)} />
      <Tool
        on={ui.showDaylight}
        label="Show daylight overlay on the plan"
        icon={ui.showDaylight ? 'sun' : 'sunOff'}
        onClick={() => setShowDaylight(!ui.showDaylight)}
      />
      <Tool label="Fit to view" icon="fit" onClick={() => setZoom(1)} />
    </>
  );

  return (
    <Viewport label="Plan" tone="light" toolbar={toolbar}>
      <div
        ref={frameRef}
        className="h-full w-full outline-none"
        style={{ background: PAPER }}
        tabIndex={0}
        onKeyDown={onKey}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        onWheel={(e) => setZoom((z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z * Math.exp(-e.deltaY * 0.0012))))}
      >
        <svg
          ref={svgRef}
          className="h-full w-full select-none"
          viewBox={`${view.box.x} ${view.box.y} ${view.box.w} ${view.box.h}`}
          preserveAspectRatio="xMidYMid meet"
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerLeave={onUp}
          onPointerDown={() => select(null)}
        >
          <rect x={0} y={0} width={room.width} height={room.depth} fill={FLOOR_PLAN_FILL[room.finish.floor]} />
          {ui.showGrid && <Grid width={room.width} depth={room.depth} u={u} />}
          {ui.showDaylight && <Daylight d={analysis.daylight} />}
          <Shell room={room} />
          <Openings room={room} u={u} />
          <Items room={room} selectedId={ui.selectedItemId} dragPos={dragPos} fit={fit} u={u} onPointerDown={onItemDown} />
          {guide && <line x1={guide.x1} y1={guide.y1} x2={guide.x2} y2={guide.y2} stroke={ACCENT} strokeWidth={3} strokeLinecap="round" vectorEffect="non-scaling-stroke" pointerEvents="none" />}
          <Violations violations={analysis.violations} selectedId={ui.selectedItemId} u={u} />
          <Ghosts ghosts={ghosts} dim={!ui.hoveredProposalId && room.proposals.length > 1} u={u} onPointerDown={onGhostDown} />
          <Dimensions width={room.width} depth={room.depth} u={u} />
        </svg>
      </div>
    </Viewport>
  );
}
