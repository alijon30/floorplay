// src/plan/layers/Grid.tsx
import type { ReactElement } from 'react';

export default function Grid({ width, depth }: { width: number; depth: number }) {
  const lines: ReactElement[] = [];
  for (let x = 0; x <= width; x += 50) lines.push(<line key={`v${x}`} x1={x} y1={0} x2={x} y2={depth} stroke={x % 100 === 0 ? '#2a2a2e' : '#202024'} strokeWidth={1} />);
  for (let y = 0; y <= depth; y += 50) lines.push(<line key={`h${y}`} x1={0} y1={y} x2={width} y2={y} stroke={y % 100 === 0 ? '#2a2a2e' : '#202024'} strokeWidth={1} />);
  return <g pointerEvents="none">{lines}</g>;
}
