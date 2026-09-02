// src/plan/layers/Violations.tsx
import type { Violation } from '../../engine/types';
import { BAD, PAPER } from '../tokens';

/**
 * Every breached zone as a thin dashed outline, and one counter where several land on the
 * same rectangle. Hatching a room full of clearance zones fills the drawing with noise; an
 * outline says exactly as much and leaves the plan readable underneath.
 */
export default function Violations({ violations, selectedId, u }: { violations: Violation[]; selectedId: string | null; u: number }) {
  const zoned = violations.filter((v) => v.zone);
  // Several rules often fail over one rectangle — an overlap and the clearance it eats. One
  // outline and one number say that better than three outlines on top of each other.
  const groups = new Map<string, { v: Violation; count: number }>();
  for (const v of zoned) {
    const z = v.zone!;
    const key = `${Math.round(z.x)}:${Math.round(z.y)}:${Math.round(z.w)}:${Math.round(z.h)}`;
    const g = groups.get(key);
    if (g) g.count += 1;
    else groups.set(key, { v, count: 1 });
  }
  return (
    <g pointerEvents="none">
      {[...groups.values()].map(({ v, count }, i) => {
        const z = v.zone!;
        const mine = selectedId !== null && v.itemIds.includes(selectedId);
        const r = 7 * u;
        return (
          <g key={i} opacity={mine ? 1 : 0.75}>
            <rect
              x={z.x} y={z.y} width={z.w} height={z.h}
              fill="none" stroke={BAD} strokeWidth={1} strokeDasharray="5 4" vectorEffect="non-scaling-stroke"
            />
            <circle cx={z.x + r + 2 * u} cy={z.y + r + 2 * u} r={r} fill={PAPER} stroke={BAD} strokeWidth={1} vectorEffect="non-scaling-stroke" />
            <text
              x={z.x + r + 2 * u} y={z.y + r + 2 * u + 3.4 * u} fill={BAD} fontSize={9 * u} textAnchor="middle"
              style={{ fontFamily: 'var(--font-mono)' }}
            >{count}</text>
          </g>
        );
      })}
    </g>
  );
}
