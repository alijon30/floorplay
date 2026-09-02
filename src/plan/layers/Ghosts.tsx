// src/plan/layers/Ghosts.tsx
import type { Ghost } from '../ghosts';

export default function Ghosts({ ghosts, dim, onPointerDown }: { ghosts: Ghost[]; dim: boolean; onPointerDown: (e: React.PointerEvent, g: Ghost) => void }) {
  return (
    <g>
      {ghosts.map((g) => {
        const removal = g.kind === 'remove';
        return (
          <g key={`${g.proposalId}:${g.opIndex}`} className={removal ? '' : 'cursor-grab'} onPointerDown={removal ? undefined : (e) => onPointerDown(e, g)}>
            <rect x={g.rect.x} y={g.rect.y} width={g.rect.w} height={g.rect.h} rx={2} fill={removal ? 'none' : g.color} opacity={dim ? 0.25 : 0.45} stroke={removal ? '#ef4444' : '#34d399'} strokeWidth={2} strokeDasharray="6 4" />
            <text x={g.x} y={g.y + 4} fill={removal ? '#fca5a5' : '#d1fae5'} fontSize={10} textAnchor="middle" pointerEvents="none">{removal ? `remove ${g.label}` : g.label}</text>
          </g>
        );
      })}
    </g>
  );
}
