// src/plan/layers/Shell.tsx
import type { Opening, Rect, Room, Wall } from '../../engine/types';
import { ACCENT, INK, PAPER } from '../tokens';

/** How thick the walls are drawn, in centimetres. Matches `WALL_T` in the 3D view. */
export const WALL_CM = 10;

/** The band an opening occupies inside the wall itself, outside the room's own rectangle. */
export function wallBand(room: Room, o: Opening, t = WALL_CM): Rect {
  switch (o.wall) {
    case 'top': return { x: o.offset, y: -t, w: o.width, h: t };
    case 'bottom': return { x: o.offset, y: room.depth, w: o.width, h: t };
    case 'left': return { x: -t, y: o.offset, w: t, h: o.width };
    case 'right': return { x: room.width, y: o.offset, w: t, h: o.width };
  }
}

/**
 * The shell: four solid wall bands with the doors and windows cut clean out of them.
 *
 * The cut is a paper-coloured rectangle rather than a mask, which keeps the whole thing four
 * rectangles and a handful more — cheap to draw, and exact at any zoom.
 */
/** The band one wall occupies, in the same coordinates the four shell bands are drawn in. */
export function bandOf(room: Room, wall: Wall, t = WALL_CM): Rect {
  const { width, depth } = room;
  switch (wall) {
    case 'top': return { x: -t, y: -t, w: width + 2 * t, h: t };
    case 'bottom': return { x: -t, y: depth, w: width + 2 * t, h: t };
    case 'left': return { x: -t, y: 0, w: t, h: depth };
    case 'right': return { x: width, y: 0, w: t, h: depth };
  }
}

export default function Shell({ room, highlight }: { room: Room; highlight?: Wall | null }) {
  const bands: Rect[] = (['top', 'bottom', 'left', 'right'] as const).map((w) => bandOf(room, w));
  const lit = highlight ? bandOf(room, highlight) : null;
  return (
    <g pointerEvents="none">
      {bands.map((b, i) => <rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} fill={INK} />)}
      {room.openings.map((o) => {
        const b = wallBand(room, o);
        return <rect key={o.id} x={b.x} y={b.y} width={b.w} height={b.h} fill={PAPER} />;
      })}
      {/* The wall the Style tab or the Wall view is working on, so the plan says which one
          the paint is about to land on rather than leaving it to be worked out. */}
      {lit && (
        <rect
          x={lit.x} y={lit.y} width={lit.w} height={lit.h}
          fill={ACCENT} fillOpacity={0.34}
          stroke={ACCENT} strokeWidth={2} vectorEffect="non-scaling-stroke"
        />
      )}
    </g>
  );
}
