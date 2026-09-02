// src/plan/Plan.tsx
import { useCallback, useMemo, useRef, useState } from 'react';
import { useRoom } from '../store';
import type { PlacedItem, Rotation, Wall } from '../engine/types';
import { BLOCKING_KINDS, nearestValid } from '../engine/nearest';
import { snapToWall, suggestPositions } from '../engine/anchors';
import { itemViolations } from '../engine/validate';
import { ghostsFor, type Ghost } from './ghosts';
import Grid from './layers/Grid';
import Shell from './layers/Shell';
import Openings from './layers/Openings';
import Daylight from './layers/Daylight';
import Violations from './layers/Violations';
import Items, { type Fit } from './layers/Items';
import Ghosts from './layers/Ghosts';

const snap = (v: number) => Math.round(v / 5) * 5;
const PAD = 40;
/** Half the snap guide's stroke, so the 4 cm line sits just inside the wall it marks. */
const SNAP_LINE_INSET = 2;

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

export default function Plan() {
  const room = useRoom((s) => s.rooms[s.currentId]!);
  const analysis = useRoom((s) => s.analysis);
  const ui = useRoom((s) => s.ui);
  const { dispatch, select, undo, updateProposalOp } = useRoom((s) => s);
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [dragPos, setDragPos] = useState<{ id: string; x: number; y: number } | null>(null);
  const [ghostPos, setGhostPos] = useState<{ key: string; x: number; y: number } | null>(null);
  const [fit, setFit] = useState<Fit>(null);
  const [snapWall, setSnapWall] = useState<Wall | null>(null);

  const ghosts = useMemo(() => {
    const list = ghostsFor(room, room.proposals, ui.hoveredProposalId);
    return ghostPos ? list.map((g) => (`${g.proposalId}:${g.opIndex}` === ghostPos.key ? { ...g, x: ghostPos.x, y: ghostPos.y, rect: { ...g.rect, x: ghostPos.x - g.rect.w / 2, y: ghostPos.y - g.rect.h / 2 } } : g)) : list;
  }, [room, ui.hoveredProposalId, ghostPos]);

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

  return (
    <div className="h-full w-full bg-neutral-950 outline-none" tabIndex={0} onKeyDown={onKey} onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
      <svg
        ref={svgRef}
        className="h-full w-full select-none"
        viewBox={`${-PAD} ${-PAD} ${room.width + 2 * PAD} ${room.depth + 2 * PAD}`}
        preserveAspectRatio="xMidYMid meet"
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={onUp}
        onPointerDown={() => select(null)}
      >
        <rect x={0} y={0} width={room.width} height={room.depth} fill="#161618" />
        <Grid width={room.width} depth={room.depth} />
        <Daylight d={analysis.daylight} />
        <Shell width={room.width} depth={room.depth} />
        <Openings room={room} />
        <Items room={room} selectedId={ui.selectedItemId} dragPos={dragPos} fit={fit} onPointerDown={onItemDown} />
        {guide && <line x1={guide.x1} y1={guide.y1} x2={guide.x2} y2={guide.y2} stroke="#34d399" strokeWidth={4} strokeLinecap="round" pointerEvents="none" />}
        <Violations violations={analysis.violations} selectedId={ui.selectedItemId} />
        <Ghosts ghosts={ghosts} dim={!ui.hoveredProposalId && room.proposals.length > 1} onPointerDown={onGhostDown} />
      </svg>
    </div>
  );
}
