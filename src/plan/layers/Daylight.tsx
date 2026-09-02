// src/plan/layers/Daylight.tsx
import type { ReactElement } from 'react';
import type { Daylight as DaylightData } from '../../engine/types';
import { CELL } from '../../engine/types';

export default function Daylight({ d }: { d: DaylightData }) {
  const cells: ReactElement[] = [];
  for (let i = 0; i < d.grid.length; i++) {
    const v = d.grid[i]!;
    if (v < 0.05) continue;
    const c = i % d.cols;
    const r = (i - c) / d.cols;
    cells.push(<rect key={i} x={c * CELL} y={r * CELL} width={CELL} height={CELL} fill="#fbbf24" opacity={v * 0.35} />);
  }
  return <g pointerEvents="none">{cells}</g>;
}
