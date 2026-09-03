// src/ui/style/WallPicker.tsx
import { wallColor } from '../../engine/wallColor';
import { wallFacing } from '../../engine/geometry';
import { WALLS, type Room, type Wall } from '../../engine/types';
import { BTN_SM, BTN_SM_ON } from '../styles';

/** What a wall faces once north is decided. The name people actually use for it. */
const COMPASS: Record<number, string> = { 0: 'north', 90: 'east', 180: 'south', 270: 'west' };

/** The thing being painted: one wall, or the room's four walls together. */
export type PaintTarget = Wall | 'all';

const SIZE = 120;
/** Room for the wall band and its highlight inside the 120 px box. */
const PAD = 14;
const STROKE = 9;

/** "east" for the wall facing north-plus-90, whatever `top`/`right` happen to mean here. */
export function wallFacingName(room: Room, wall: Wall): string {
  return COMPASS[wallFacing(wall, room.northWall)] ?? wall;
}

/** The mini plan's geometry: the room drawn as large as it goes inside the box. */
function layout(width: number, depth: number) {
  const inner = SIZE - PAD * 2;
  const scale = Math.min(inner / width, inner / depth);
  const w = width * scale;
  const h = depth * scale;
  return { scale, w, h, x0: (SIZE - w) / 2, y0: (SIZE - h) / 2 };
}

/** Both ends of one wall in the mini plan, in its own coordinates. */
function wallEnds(wall: Wall, l: ReturnType<typeof layout>) {
  const { x0, y0, w, h } = l;
  switch (wall) {
    case 'top': return { x1: x0, y1: y0, x2: x0 + w, y2: y0 };
    case 'right': return { x1: x0 + w, y1: y0, x2: x0 + w, y2: y0 + h };
    case 'bottom': return { x1: x0, y1: y0 + h, x2: x0 + w, y2: y0 + h };
    case 'left': return { x1: x0, y1: y0, x2: x0, y2: y0 + h };
  }
}

/** A door or window as a segment of its wall, measured the way `add_opening` measures it. */
function openingSegment(wall: Wall, offset: number, width: number, l: ReturnType<typeof layout>) {
  const e = wallEnds(wall, l);
  const a = offset * l.scale;
  const b = (offset + width) * l.scale;
  const horizontal = wall === 'top' || wall === 'bottom';
  return horizontal
    ? { x1: e.x1 + a, y1: e.y1, x2: e.x1 + b, y2: e.y2 }
    : { x1: e.x1, y1: e.y1 + a, x2: e.x2, y2: e.y1 + b };
}

/**
 * The four walls of the room, drawn small, in the paint they are actually wearing.
 *
 * Colour is a spatial decision — "the wall behind the bed", not "the top wall" — so the
 * picker is a picture of the room rather than a row of words. The door and window ticks are
 * there for the same reason: they are how you recognise which wall is which.
 */
export default function WallPicker({
  room, target, onTarget,
}: { room: Room; target: PaintTarget; onTarget: (t: PaintTarget) => void }) {
  const l = layout(room.width, room.depth);
  const name = target === 'all' ? 'all walls' : `${wallFacingName(room, target)} wall`;

  return (
    <div>
      <div className="flex items-start gap-3">
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="shrink-0 rounded-md border border-line bg-raised"
          aria-label="Room plan, click a wall to paint it"
        >
          <rect x={l.x0} y={l.y0} width={l.w} height={l.h} fill="var(--raised-hi)" />
          {WALLS.map((w) => {
            const e = wallEnds(w, l);
            const on = target === w || target === 'all';
            return (
              <g key={w}>
                {on && (
                  <line
                    x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
                    stroke="var(--accent)" strokeWidth={STROKE + 5} strokeLinecap="square" opacity={0.9}
                  />
                )}
                <line
                  x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
                  stroke={wallColor(room, w)} strokeWidth={STROKE} strokeLinecap="square"
                />
              </g>
            );
          })}
          {room.openings.map((o) => {
            const s = openingSegment(o.wall, o.offset, o.width, l);
            return (
              <line
                key={o.id}
                x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
                stroke={o.kind === 'door' ? '#ffffff' : '#8fc6dd'}
                strokeWidth={STROKE - 3}
                strokeLinecap="butt"
              />
            );
          })}
          {/* The hit targets sit last so they take the clicks, and wide so they are easy to hit. */}
          {WALLS.map((w) => {
            const e = wallEnds(w, l);
            return (
              <line
                key={`hit-${w}`}
                x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
                stroke="transparent" strokeWidth={PAD * 2} strokeLinecap="square"
                role="button"
                tabIndex={0}
                aria-label={`Paint the ${wallFacingName(room, w)} wall`}
                aria-pressed={target === w}
                className="cursor-pointer"
                onClick={() => onTarget(w)}
                onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onTarget(w); } }}
              />
            );
          })}
        </svg>

        <div className="min-w-0 flex-1">
          <button
            className={target === 'all' ? BTN_SM_ON : BTN_SM}
            aria-pressed={target === 'all'}
            onClick={() => onTarget('all')}
          >All walls</button>
          <div className="mt-2 flex flex-wrap gap-1">
            {WALLS.map((w) => (
              <button
                key={w}
                className={target === w ? BTN_SM_ON : BTN_SM}
                aria-pressed={target === w}
                title={`The ${w} wall on the plan`}
                onClick={() => onTarget(w)}
              >
                <span className="h-2.5 w-2.5 rounded-[2px] ring-1 ring-black/25" style={{ background: wallColor(room, w) }} />
                {wallFacingName(room, w)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <p className="mt-2 text-[11.5px] text-muted">
        Painting: <span className="text-fg">{name}</span>
      </p>
    </div>
  );
}
