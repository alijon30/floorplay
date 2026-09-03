// src/ui/style/FloorTiles.tsx
import { FLOOR_LABEL, FLOOR_SWATCH } from '../../finishes';
import { FLOOR_FINISHES, type FloorFinish } from '../../engine/types';
import { FOCUS } from '../styles';

const W = 52;
const H = 34;

/**
 * A scrap of the floor, drawn rather than sampled.
 *
 * A flat chip of colour cannot tell oak from tile — the difference is the pattern, so the
 * preview draws the pattern: three courses of planks with staggered joints for the woods,
 * a grouted grid for the tile.
 */
function FloorPreview({ finish }: { finish: FloorFinish }) {
  const base = FLOOR_SWATCH[finish];
  if (finish === 'tile') {
    const cols = 3, rows = 2, gap = 1.5;
    const cw = (W - gap * (cols + 1)) / cols;
    const ch = (H - gap * (rows + 1)) / rows;
    return (
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true" className="rounded-[3px]">
        <rect width={W} height={H} fill="#b9c0c4" />
        {Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => (
          <rect
            key={`${r}-${c}`}
            x={gap + c * (cw + gap)} y={gap + r * (ch + gap)} width={cw} height={ch}
            fill={base} opacity={(r + c) % 2 === 0 ? 1 : 0.86}
          />
        )))}
      </svg>
    );
  }
  const rows = 3;
  const rh = H / rows;
  // Each course is offset half a plank from the one above, the way a floor is actually laid.
  const joints = [0.55, 0.3, 0.72];
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true" className="rounded-[3px]">
      <rect width={W} height={H} fill={base} />
      {Array.from({ length: rows }, (_, r) => (
        <g key={r}>
          <rect x={0} y={r * rh} width={W} height={rh} fill="#000" opacity={r % 2 === 0 ? 0 : 0.07} />
          <line x1={0} y1={r * rh} x2={W} y2={r * rh} stroke="#000" strokeOpacity={0.18} strokeWidth={0.8} />
          <line x1={W * joints[r]!} y1={r * rh} x2={W * joints[r]!} y2={(r + 1) * rh} stroke="#000" strokeOpacity={0.16} strokeWidth={0.8} />
        </g>
      ))}
    </svg>
  );
}

/** The five floors, each showing what it looks like underfoot. */
export default function FloorTiles({ floor, onFloor }: { floor: FloorFinish; onFloor: (f: FloorFinish) => void }) {
  return (
    <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="Floor finish">
      {FLOOR_FINISHES.map((f) => {
        const on = floor === f;
        return (
          <button
            key={f}
            aria-pressed={on}
            aria-label={`${FLOOR_LABEL[f]} floor`}
            onClick={() => onFloor(f)}
            className={`flex flex-col items-center gap-1 rounded-md border p-1.5 transition-colors ${FOCUS} ${
              on ? 'border-accent/60 bg-[var(--accent-fill)]' : 'border-line bg-raised hover:border-[var(--line-hi)]'
            }`}
          >
            <FloorPreview finish={f} />
            <span className={`text-[11px] ${on ? 'font-medium text-accent' : 'text-muted'}`}>{FLOOR_LABEL[f]}</span>
          </button>
        );
      })}
    </div>
  );
}
