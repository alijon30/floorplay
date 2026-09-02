// src/plan/layers/Ghosts.tsx
import type { Ghost } from '../ghosts';
import { ACCENT, BAD } from '../tokens';

/**
 * What a proposal would do, drawn as dashed accent outlines over the room as it stands.
 *
 * Nothing here is filled: a ghost has to read as a suggestion laid over the drawing, not as
 * a second layer of furniture competing with the real one.
 */
export default function Ghosts({ ghosts, dim, u, onPointerDown }: { ghosts: Ghost[]; dim: boolean; u: number; onPointerDown: (e: React.PointerEvent, g: Ghost) => void }) {
  return (
    <g>
      {ghosts.map((g) => {
        const removal = g.kind === 'remove';
        const stroke = removal ? BAD : ACCENT;
        const fs = 9 * u;
        return (
          <g
            key={`${g.proposalId}:${g.opIndex}`}
            className={removal ? '' : 'cursor-grab'}
            opacity={dim ? 0.32 : 0.6}
            onPointerDown={removal ? undefined : (e) => onPointerDown(e, g)}
          >
            <rect
              x={g.rect.x} y={g.rect.y} width={g.rect.w} height={g.rect.h}
              fill={stroke} fillOpacity={0.06} stroke={stroke} strokeWidth={1.5} strokeDasharray="6 4"
              vectorEffect="non-scaling-stroke"
            />
            <text
              x={g.x} y={g.y + fs * 0.36} fill={stroke} fontSize={fs} textAnchor="middle" pointerEvents="none"
              style={{ fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: `${0.5 * u}px` }}
            >{removal ? `− ${g.label}` : g.label}</text>
          </g>
        );
      })}
    </g>
  );
}
