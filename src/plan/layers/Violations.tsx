// src/plan/layers/Violations.tsx
import type { Violation } from '../../engine/types';

export default function Violations({ violations }: { violations: Violation[] }) {
  return (
    <g pointerEvents="none">
      <defs>
        <pattern id="hatch" width={8} height={8} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1={0} y1={0} x2={0} y2={8} stroke="#ef4444" strokeWidth={3} />
        </pattern>
      </defs>
      {violations.filter((v) => v.zone).map((v, i) => (
        <g key={i}>
          <rect x={v.zone!.x} y={v.zone!.y} width={v.zone!.w} height={v.zone!.h} fill="url(#hatch)" opacity={0.5} stroke="#ef4444" strokeWidth={1} />
          <text x={v.zone!.x + 4} y={v.zone!.y + 12} fill="#fca5a5" fontSize={10}>{v.kind.replace(/_/g, ' ')}</text>
        </g>
      ))}
    </g>
  );
}
