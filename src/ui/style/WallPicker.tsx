// src/ui/style/WallPicker.tsx
import { useState } from 'react';
import { wallColor } from '../../engine/wallColor';
import { FLOOR_PLAN_FILL } from '../../finishes';
import { wallChipLabel, wallCompassLetter, wallLabel, wallPositionName } from '../../engine/wallNames';
import { WALLS, type Room, type Wall } from '../../engine/types';
import { BTN_SM, BTN_SM_ON } from '../styles';

/** The thing being painted: one wall, or the room's four walls together. */
export type PaintTarget = Wall | 'all';

const SIZE = 120;
/** Room for the wall band and its highlight inside the 120 px box. */
const PAD = 14;
const STROKE = 9;

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
 * This picture is the picker — hover a wall and it lights, click it and it is the one being
 * painted. Colour is a spatial decision ("the wall behind the bed"), and the plan is the only
 * thing on screen that can answer where a wall is. The chips beside it name the same walls by
 * where they sit on that plan, with the compass letter kept as a caption rather than the name,
 * because north is a setting most people never touch and every one of them can see "top".
 */
export default function WallPicker({
  room, target, onTarget,
}: { room: Room; target: PaintTarget; onTarget: (t: PaintTarget) => void }) {
  const l = layout(room.width, room.depth);
  const [hover, setHover] = useState<Wall | null>(null);
  const name = target === 'all' ? 'all four walls' : wallLabel(room, target);

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
          {/* The floor in the same tint the plan draws it, so the two read as one room. */}
          <rect x={l.x0} y={l.y0} width={l.w} height={l.h} fill={FLOOR_PLAN_FILL[room.finish.floor]} />
          {/* The wall under the cursor lights faintly; the chosen one carries the full band.
              One wall gets a band behind it; all four get a ring around the room, because four
              bands would swallow the colours the picker exists to show. */}
          {hover !== null && hover !== target && (() => {
            const e = wallEnds(hover, l);
            return <line x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} stroke="var(--accent)" strokeOpacity={0.45} strokeWidth={STROKE + 6} strokeLinecap="square" />;
          })()}
          {target !== 'all' && (() => {
            const e = wallEnds(target, l);
            return <line x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} stroke="var(--accent)" strokeWidth={STROKE + 6} strokeLinecap="square" />;
          })()}
          {WALLS.map((w) => {
            const e = wallEnds(w, l);
            return (
              <line
                key={w}
                x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
                stroke={wallColor(room, w)} strokeWidth={STROKE} strokeLinecap="square"
              />
            );
          })}
          {target === 'all' && (
            <rect
              x={l.x0 - STROKE / 2 - 3} y={l.y0 - STROKE / 2 - 3}
              width={l.w + STROKE + 6} height={l.h + STROKE + 6}
              rx={3} fill="none" stroke="var(--accent)" strokeWidth={2}
            />
          )}
          {room.openings.map((o) => {
            const s = openingSegment(o.wall, o.offset, o.width, l);
            return (
              <line
                key={o.id}
                x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
                stroke={o.kind === 'door' ? '#9aa2a8' : '#6fb0d6'}
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
                aria-label={`Paint the ${wallLabel(room, w).toLowerCase()}`}
                aria-pressed={target === w}
                className="cursor-pointer"
                onPointerEnter={() => setHover(w)}
                onPointerLeave={() => setHover((h) => (h === w ? null : h))}
                onFocus={() => setHover(w)}
                onBlur={() => setHover((h) => (h === w ? null : h))}
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
            title="Paint all four walls the same colour"
            onClick={() => onTarget('all')}
          >All walls</button>
          <div className="mt-2 flex flex-wrap gap-1">
            {WALLS.map((w) => (
              <button
                key={w}
                className={target === w ? BTN_SM_ON : BTN_SM}
                aria-pressed={target === w}
                aria-label={`Paint the ${wallLabel(room, w).toLowerCase()}`}
                title={`The ${wallPositionName(w).toLowerCase()} wall on the plan, facing ${wallCompassLetter(room, w)}`}
                onPointerEnter={() => setHover(w)}
                onPointerLeave={() => setHover((h) => (h === w ? null : h))}
                onClick={() => onTarget(w)}
              >
                <span className="h-2.5 w-2.5 rounded-[2px] ring-1 ring-black/25" style={{ background: wallColor(room, w) }} />
                {wallChipLabel(room, w)}
                <span className="text-muted/70">{wallCompassLetter(room, w)}</span>
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
