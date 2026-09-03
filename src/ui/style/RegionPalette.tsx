// src/ui/style/RegionPalette.tsx
import { WALL_PALETTES } from '../../engine/wallPalettes';
import { FOCUS } from '../styles';

/**
 * Eleven regional palettes as cards, then the six paints of whichever one is open.
 *
 * The cards carry the six colours as a strip, so choosing a region is a visual choice rather
 * than a guess at what "Morocco" is going to mean. The swatches below are large enough and
 * named, because the name is what a person repeats back to their agent.
 */
export default function RegionPalette({
  regionKey, onRegion, activeHex, onPick,
}: {
  regionKey: string;
  onRegion: (key: string) => void;
  /** The paint currently on the target, so the matching swatch can read as chosen. */
  activeHex: string;
  onPick: (hex: string, name: string) => void;
}) {
  const region = WALL_PALETTES.find((p) => p.key === regionKey) ?? WALL_PALETTES[0]!;

  return (
    <div>
      <div className="-mx-3 flex gap-1.5 overflow-x-auto px-3 pb-1" role="group" aria-label="Regions">
        {WALL_PALETTES.map((p) => {
          const on = p.key === region.key;
          return (
            <button
              key={p.key}
              aria-pressed={on}
              aria-label={`${p.region} palette`}
              onClick={() => onRegion(p.key)}
              className={`w-[132px] shrink-0 rounded-md border p-1.5 text-left transition-colors ${FOCUS} ${
                on ? 'border-accent/60 bg-[var(--accent-fill)]' : 'border-line bg-raised hover:border-[var(--line-hi)]'
              }`}
            >
              <div className={`truncate text-[11.5px] ${on ? 'font-medium text-accent' : 'text-fg'}`}>{p.region}</div>
              <div className="mt-1 flex h-3 overflow-hidden rounded-[3px] ring-1 ring-black/15">
                {p.swatches.map((s) => <span key={s.hex} className="flex-1" style={{ background: s.hex }} />)}
              </div>
              <div className="mt-1 line-clamp-2 text-[10.5px] leading-snug text-muted">{p.note}</div>
            </button>
          );
        })}
      </div>

      <div className="mt-2 grid grid-cols-6 gap-1.5" role="group" aria-label={`${region.region} paints`}>
        {region.swatches.map((s) => {
          const on = activeHex.toLowerCase() === s.hex.toLowerCase();
          return (
            <button
              key={s.hex}
              title={`${s.name} ${s.hex}`}
              aria-label={`${region.region} ${s.name}`}
              aria-pressed={on}
              onClick={() => onPick(s.hex, s.name)}
              className={`flex flex-col items-center gap-1 rounded ${FOCUS}`}
            >
              <span
                className={`block h-8 w-8 rounded-[4px] transition-shadow ${
                  on ? 'ring-2 ring-accent ring-offset-2 ring-offset-panel' : 'ring-1 ring-line'
                }`}
                style={{ background: s.hex }}
              />
              <span className="w-full truncate text-center text-[9.5px] leading-tight text-muted">{s.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
