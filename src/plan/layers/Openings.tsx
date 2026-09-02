// src/plan/layers/Openings.tsx
import type { Opening, Room } from '../../engine/types';
import { wallFacing } from '../../engine/geometry';
import { ACCENT, INK, INK_DIM } from '../tokens';
import { wallBand } from './Shell';

/**
 * A door, drawn the way a plan draws one: the leaf as a single line from its hinge, and the
 * quarter circle it sweeps. The shell has already cut the hole; this is only the swing.
 */
function DoorGlyph({ room, o }: { room: Room; o: Opening }) {
  const r = o.width;
  const inward = o.swing !== 'out';
  const hingeAtStart = o.hinge !== 'end';
  let hx = 0, hy = 0, ex = 0, ey = 0, sweep = 0;
  if (o.wall === 'bottom') { hy = room.depth; hx = hingeAtStart ? o.offset : o.offset + o.width; ex = hx; ey = inward ? hy - r : hy + r; sweep = hingeAtStart === inward ? 1 : 0; }
  if (o.wall === 'top') { hy = 0; hx = hingeAtStart ? o.offset : o.offset + o.width; ex = hx; ey = inward ? r : -r; sweep = hingeAtStart === inward ? 0 : 1; }
  if (o.wall === 'left') { hx = 0; hy = hingeAtStart ? o.offset : o.offset + o.width; ey = hy; ex = inward ? r : -r; sweep = hingeAtStart === inward ? 1 : 0; }
  if (o.wall === 'right') { hx = room.width; hy = hingeAtStart ? o.offset : o.offset + o.width; ey = hy; ex = inward ? hx - r : hx + r; sweep = hingeAtStart === inward ? 0 : 1; }
  const horizontal = o.wall === 'top' || o.wall === 'bottom';
  const tx = hingeAtStart ? (horizontal ? hx + r : hx) : (horizontal ? hx - r : hx);
  const ty = hingeAtStart ? (!horizontal ? hy + r : hy) : (!horizontal ? hy - r : hy);
  return (
    <g pointerEvents="none">
      <path d={`M ${ex} ${ey} A ${r} ${r} 0 0 ${sweep} ${tx} ${ty}`} fill="none" stroke={INK} strokeWidth={1} opacity={0.45} vectorEffect="non-scaling-stroke" />
      <line x1={hx} y1={hy} x2={ex} y2={ey} stroke={INK} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
    </g>
  );
}

/** A window: two thin lines across the wall band, the way glass is drawn. */
function WindowGlyph({ room, o, u }: { room: Room; o: Opening; u: number }) {
  const b = wallBand(room, o);
  const horizontal = o.wall === 'top' || o.wall === 'bottom';
  const facing = wallFacing(o.wall, room.northWall);
  const label = ['N', 'E', 'S', 'W'][Math.round(facing / 90) % 4];
  const inset = b.h * 0 + (horizontal ? b.h : b.w) * 0.32;
  const lines = horizontal
    ? [
      { x1: b.x, y1: b.y + inset, x2: b.x + b.w, y2: b.y + inset },
      { x1: b.x, y1: b.y + b.h - inset, x2: b.x + b.w, y2: b.y + b.h - inset },
    ]
    : [
      { x1: b.x + inset, y1: b.y, x2: b.x + inset, y2: b.y + b.h },
      { x1: b.x + b.w - inset, y1: b.y, x2: b.x + b.w - inset, y2: b.y + b.h },
    ];
  // Side walls have no width to write across, so the label turns and runs along the glass.
  const lx = horizontal ? b.x + b.w / 2 : o.wall === 'left' ? b.x - 5 * u : b.x + b.w + 5 * u + 9 * u;
  const ly = horizontal ? (o.wall === 'top' ? b.y - 5 * u : b.y + b.h + 12 * u) : b.y + b.h / 2;
  return (
    <g pointerEvents="none">
      {lines.map((l, i) => <line key={i} {...l} stroke={ACCENT} strokeWidth={1} vectorEffect="non-scaling-stroke" />)}
      <text
        x={lx} y={ly} fill={INK_DIM} fontSize={9 * u} textAnchor="middle"
        transform={horizontal ? undefined : `rotate(-90 ${lx} ${ly})`}
        style={{ fontFamily: 'var(--font-mono)', letterSpacing: `${0.6 * u}px` }}
      >WINDOW {label}</text>
    </g>
  );
}

export default function Openings({ room, u }: { room: Room; u: number }) {
  return <g>{room.openings.map((o) => (o.kind === 'door' ? <DoorGlyph key={o.id} room={room} o={o} /> : <WindowGlyph key={o.id} room={room} o={o} u={u} />))}</g>;
}
