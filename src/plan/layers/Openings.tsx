// src/plan/layers/Openings.tsx
import type { Opening, Room } from '../../engine/types';
import { openingSpan, wallFacing } from '../../engine/geometry';

function DoorGlyph({ room, o }: { room: Room; o: Opening }) {
  const s = openingSpan(room, o, 12);
  const r = o.width;
  const inward = o.swing !== 'out';
  const hingeAtStart = o.hinge !== 'end';
  let hx = 0, hy = 0, ex = 0, ey = 0, sweep = 0;
  if (o.wall === 'bottom') { hy = room.depth; hx = hingeAtStart ? o.offset : o.offset + o.width; ex = hx; ey = inward ? hy - r : hy + r; sweep = hingeAtStart === inward ? 1 : 0; }
  if (o.wall === 'top') { hy = 0; hx = hingeAtStart ? o.offset : o.offset + o.width; ex = hx; ey = inward ? r : -r; sweep = hingeAtStart === inward ? 0 : 1; }
  if (o.wall === 'left') { hx = 0; hy = hingeAtStart ? o.offset : o.offset + o.width; ey = hy; ex = inward ? r : -r; sweep = hingeAtStart === inward ? 1 : 0; }
  if (o.wall === 'right') { hx = room.width; hy = hingeAtStart ? o.offset : o.offset + o.width; ey = hy; ex = inward ? hx - r : hx + r; sweep = hingeAtStart === inward ? 0 : 1; }
  const tx = hingeAtStart ? (o.wall === 'top' || o.wall === 'bottom' ? hx + r : hx) : (o.wall === 'top' || o.wall === 'bottom' ? hx - r : hx);
  const ty = hingeAtStart ? (o.wall === 'left' || o.wall === 'right' ? hy + r : hy) : (o.wall === 'left' || o.wall === 'right' ? hy - r : hy);
  return (
    <g pointerEvents="none">
      <rect x={s.x - (o.wall === 'left' || o.wall === 'right' ? 6 : 0)} y={s.y - (o.wall === 'top' || o.wall === 'bottom' ? 6 : 0)} width={s.w} height={s.h} fill="#0a0a0a" />
      <line x1={hx} y1={hy} x2={ex} y2={ey} stroke="#e5e5e5" strokeWidth={3} />
      <path d={`M ${ex} ${ey} A ${r} ${r} 0 0 ${sweep} ${tx} ${ty}`} fill="none" stroke="#737373" strokeWidth={1} strokeDasharray="4 3" />
    </g>
  );
}

function WindowGlyph({ room, o }: { room: Room; o: Opening }) {
  const s = openingSpan(room, o, 10);
  const facing = wallFacing(o.wall, room.northWall);
  const label = ['N', 'E', 'S', 'W'][Math.round(facing / 90) % 4];
  const horizontal = o.wall === 'top' || o.wall === 'bottom';
  const x = horizontal ? s.x : o.wall === 'left' ? -10 : room.width;
  const y = horizontal ? (o.wall === 'top' ? -10 : room.depth) : s.y;
  return (
    <g pointerEvents="none">
      <rect x={x} y={y} width={horizontal ? s.w : 10} height={horizontal ? 10 : s.h} fill="#7dd3fc" />
      <line x1={horizontal ? x : x + 5} y1={horizontal ? y + 5 : y} x2={horizontal ? x + s.w : x + 5} y2={horizontal ? y + 5 : y + s.h} stroke="#0c4a6e" strokeWidth={1} />
      <text x={horizontal ? x + s.w / 2 : x + 5} y={horizontal ? y + (o.wall === 'top' ? -6 : 22) : y - 6} fill="#7dd3fc" fontSize={11} textAnchor="middle">window · {label}</text>
    </g>
  );
}

export default function Openings({ room }: { room: Room }) {
  return <g>{room.openings.map((o) => (o.kind === 'door' ? <DoorGlyph key={o.id} room={room} o={o} /> : <WindowGlyph key={o.id} room={room} o={o} />))}</g>;
}
