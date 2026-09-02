// src/plan/layers/Dimensions.tsx
import { INK_DIM } from '../tokens';

/** How far outside the shell the dimension lines run, in centimetres. */
const OFFSET = 30;

function Tick({ x, y, vertical, u }: { x: number; y: number; vertical: boolean; u: number }) {
  const l = 4 * u;
  return vertical
    ? <line x1={x - l} y1={y} x2={x + l} y2={y} stroke={INK_DIM} strokeWidth={1} vectorEffect="non-scaling-stroke" />
    : <line x1={x} y1={y - l} x2={x} y2={y + l} stroke={INK_DIM} strokeWidth={1} vectorEffect="non-scaling-stroke" />;
}

/**
 * The two overall dimensions, drawn outside the shell the way a drawing carries them:
 * a witness line at each end, a run between them, and the number in the middle in mono.
 */
export default function Dimensions({ width, depth, u }: { width: number; depth: number; u: number }) {
  const dy = -OFFSET, dx = -OFFSET;
  const fs = 10.5 * u;
  const mono = { fontFamily: 'var(--font-mono)', letterSpacing: `${0.4 * u}px` } as const;
  return (
    <g pointerEvents="none">
      {/* across the top */}
      <line x1={0} y1={dy} x2={width} y2={dy} stroke={INK_DIM} strokeWidth={1} vectorEffect="non-scaling-stroke" />
      <Tick x={0} y={dy} vertical={false} u={u} />
      <Tick x={width} y={dy} vertical={false} u={u} />
      <line x1={0} y1={dy} x2={0} y2={-10} stroke={INK_DIM} strokeWidth={1} opacity={0.5} vectorEffect="non-scaling-stroke" />
      <line x1={width} y1={dy} x2={width} y2={-10} stroke={INK_DIM} strokeWidth={1} opacity={0.5} vectorEffect="non-scaling-stroke" />
      <text x={width / 2} y={dy - 5 * u} fill={INK_DIM} fontSize={fs} textAnchor="middle" style={mono}>{width}</text>

      {/* down the left */}
      <line x1={dx} y1={0} x2={dx} y2={depth} stroke={INK_DIM} strokeWidth={1} vectorEffect="non-scaling-stroke" />
      <Tick x={dx} y={0} vertical u={u} />
      <Tick x={dx} y={depth} vertical u={u} />
      <line x1={dx} y1={0} x2={-10} y2={0} stroke={INK_DIM} strokeWidth={1} opacity={0.5} vectorEffect="non-scaling-stroke" />
      <line x1={dx} y1={depth} x2={-10} y2={depth} stroke={INK_DIM} strokeWidth={1} opacity={0.5} vectorEffect="non-scaling-stroke" />
      <text
        x={dx - 5 * u} y={depth / 2} fill={INK_DIM} fontSize={fs} textAnchor="middle" style={mono}
        transform={`rotate(-90 ${dx - 5 * u} ${depth / 2})`}
      >{depth}</text>
    </g>
  );
}
