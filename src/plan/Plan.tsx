// src/plan/Plan.tsx
import { useCallback, useMemo, useRef, useState } from 'react';
import { useRoom } from '../store';
import type { PlacedItem, Rotation } from '../engine/types';
import { nearestValid } from '../engine/nearest';
import { ghostsFor, type Ghost } from './ghosts';
import Grid from './layers/Grid';
import Shell from './layers/Shell';
import Openings from './layers/Openings';
import Daylight from './layers/Daylight';
import Violations from './layers/Violations';
import Items from './layers/Items';
import Ghosts from './layers/Ghosts';

const snap = (v: number) => Math.round(v / 5) * 5;
const PAD = 40;

type Drag =
  | { kind: 'item'; id: string; offX: number; offY: number; moved: boolean }
  | { kind: 'ghost'; ghost: Ghost; offX: number; offY: number; moved: boolean };

export default function Plan() {
  const room = useRoom((s) => s.rooms[s.currentId]!);
  const analysis = useRoom((s) => s.analysis);
  const ui = useRoom((s) => s.ui);
  const { dispatch, select, undo, updateProposalOp } = useRoom((s) => s);
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [dragPos, setDragPos] = useState<{ id: string; x: number; y: number } | null>(null);
  const [ghostPos, setGhostPos] = useState<{ key: string; x: number; y: number } | null>(null);

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
    if (drag.kind === 'item') { setDragPos({ id: drag.id, x, y }); setDrag({ ...drag, moved: true }); }
    else { setGhostPos({ key: `${drag.ghost.proposalId}:${drag.ghost.opIndex}`, x, y }); setDrag({ ...drag, moved: true }); }
  };

  const onUp = () => {
    if (!drag) return;
    if (drag.kind === 'item' && drag.moved && dragPos) {
      const item = room.items.find((i) => i.id === drag.id);
      if (item && (item.x !== dragPos.x || item.y !== dragPos.y)) dispatch({ actor: 'human', ops: [{ type: 'move', id: item.id, x: dragPos.x, y: dragPos.y, rotation: item.rotation }] });
    }
    if (drag.kind === 'ghost' && drag.moved && ghostPos) {
      const g = drag.ghost;
      const p = room.proposals.find((x) => x.id === g.proposalId);
      const op = p?.ops[g.opIndex];
      if (op?.type === 'place') updateProposalOp(g.proposalId, g.opIndex, { type: 'place', item: { ...op.item, x: ghostPos.x, y: ghostPos.y } });
      if (op?.type === 'move') updateProposalOp(g.proposalId, g.opIndex, { ...op, x: ghostPos.x, y: ghostPos.y });
    }
    setDrag(null); setDragPos(null); setGhostPos(null);
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
    const pos = nearestValid(room, catalogId, snap(p.x), snap(p.y), 0) ?? { x: snap(p.x), y: snap(p.y) };
    const id = `item_${Date.now().toString(36)}`;
    dispatch({ actor: 'human', ops: [{ type: 'place', item: { id, catalogId, x: pos.x, y: pos.y, rotation: 0, locked: false } }] });
    select(id);
  };

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
        <Items room={room} selectedId={ui.selectedItemId} dragPos={dragPos} onPointerDown={onItemDown} />
        <Violations violations={analysis.violations} />
        <Ghosts ghosts={ghosts} dim={!ui.hoveredProposalId && room.proposals.length > 1} onPointerDown={onGhostDown} />
      </svg>
    </div>
  );
}
