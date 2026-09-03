// src/elevation/WallPalettePanel.tsx
import { useState } from 'react';
import { useRoom } from '../store';
import { WALL_PALETTES } from '../engine/wallPalettes';
import { wallColor, withAllWallsColor, withWallColor } from '../engine/wallColor';
import { wallFacing } from '../engine/geometry';
import { WALLS, type Wall } from '../engine/types';
import { BTN_SM, BTN_SM_ON, LABEL } from '../ui/styles';

const COMPASS: Record<number, string> = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' };

/**
 * Wall paint by region, one wall at a time.
 *
 * The eight curated swatches above answer "what colour is this room"; this answers "what
 * colour is *that* wall", which is the question you ask once you have decided to paint one of
 * them differently. The regions are there because that decision is almost never abstract —
 * people reach for a shoji white or a Venetian red, not for a hex.
 *
 * The wall being painted is `ui.elevationWall`, the same one the elevation is drawing, so
 * picking a wall here also turns the right viewport to it and the two never disagree.
 */
export default function WallPalettePanel() {
  const room = useRoom((s) => s.rooms[s.currentId]!);
  const wall = useRoom((s) => s.ui.elevationWall);
  const setElevationWall = useRoom((s) => s.setElevationWall);
  const dispatch = useRoom((s) => s.dispatch);
  const [regionKey, setRegionKey] = useState(WALL_PALETTES[0]!.key);
  const region = WALL_PALETTES.find((p) => p.key === regionKey) ?? WALL_PALETTES[0]!;
  const active = wallColor(room, wall);

  const paintOne = (hex: string, name: string) =>
    dispatch({ actor: 'human', ops: [{ type: 'setFinish', finish: withWallColor(room.finish, wall, hex) }], summary: `Painted the ${wall} wall ${name}` });
  const paintAll = () =>
    dispatch({ actor: 'human', ops: [{ type: 'setFinish', finish: withAllWallsColor(room.finish, active) }], summary: `Painted every wall ${active}` });

  return (
    <section aria-label="Wall colors by region">
      <strong className={`mt-3.5 block ${LABEL}`}>Walls by region</strong>
      <div className="mt-1.5 flex flex-wrap gap-1" role="group" aria-label="Which wall">
        {WALLS.map((w) => (
          <button
            key={w}
            className={w === wall ? BTN_SM_ON : BTN_SM}
            aria-pressed={w === wall}
            aria-label={`Paint the ${w} wall`}
            onClick={() => setElevationWall(w)}
          >
            <span className="h-2.5 w-2.5 rounded-[2px] ring-1 ring-black/25" style={{ background: wallColor(room, w) }} />
            {COMPASS[wallFacing(w, room.northWall)] ?? '?'} · {w}
          </button>
        ))}
      </div>

      <p className="mt-1.5 text-[11px] text-muted">
        Painting the <span className="text-fg">{wall}</span> wall, now <span className="font-mono text-fg">{active}</span>.
      </p>

      <div className="mt-1.5 flex flex-wrap gap-1" role="group" aria-label="Region">
        {WALL_PALETTES.map((p) => (
          <button
            key={p.key}
            className={p.key === region.key ? BTN_SM_ON : BTN_SM}
            aria-pressed={p.key === region.key}
            title={p.note}
            onClick={() => setRegionKey(p.key)}
          >{p.region}</button>
        ))}
      </div>

      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {region.swatches.map((s) => (
          <button
            key={s.hex}
            title={`${s.name} ${s.hex}`}
            aria-label={`${region.region} ${s.name}`}
            aria-pressed={active.toLowerCase() === s.hex.toLowerCase()}
            onClick={() => paintOne(s.hex, s.name)}
            className={`h-[22px] w-[22px] rounded-[3px] transition-shadow focus-visible:outline-none ${
              active.toLowerCase() === s.hex.toLowerCase() ? 'ring-2 ring-accent ring-offset-2 ring-offset-panel' : 'ring-1 ring-line hover:ring-[var(--line-hi)]'
            }`}
            style={{ background: s.hex }}
          />
        ))}
      </div>

      <p className="mt-1 text-[11px] leading-snug text-muted">{region.note}</p>
      <button className={`mt-1.5 ${BTN_SM}`} onClick={paintAll}>Apply to all walls</button>
    </section>
  );
}

/** Re-exported so a caller can name the wall the same way this panel does. */
export function wallLabel(wall: Wall, northWall: Wall): string {
  return `${COMPASS[wallFacing(wall, northWall)] ?? '?'} · ${wall}`;
}
