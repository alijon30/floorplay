// src/engine/wallNames.ts
import { wallFacing } from './geometry';
import type { Room, Wall } from './types';

/**
 * What to call a wall to someone looking at the plan.
 *
 * North, east, south and west are the wrong words for this job. They depend on a north
 * setting most people never touch, they change under the reader when they do touch it, and
 * a renter who wants "the wall behind the bed" has to work out the compass first. The plan
 * on screen is the shared reference, so the name comes from the plan: top, right, bottom,
 * left, plus whatever door or window makes the wall recognisable.
 *
 * The `Wall` type keeps its `top`/`right`/`bottom`/`left` values throughout the engine and
 * the tools. Only what is written on screen changes here.
 */

const POSITION: Record<Wall, string> = { top: 'Top', right: 'Right', bottom: 'Bottom', left: 'Left' };

/** Compass letter for a facing in degrees, kept as the small caption beside the name. */
const LETTER: Record<number, string> = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' };
const LONG: Record<number, string> = { 0: 'north', 90: 'east', 180: 'south', 270: 'west' };

/** "Top", "Right", "Bottom", "Left" — where the wall sits on the plan. */
export function wallPositionName(wall: Wall): string {
  return POSITION[wall];
}

/** "N", "E", "S", "W" — the caption, never the name. */
export function wallCompassLetter(room: Room, wall: Wall): string {
  return LETTER[wallFacing(wall, room.northWall)] ?? '?';
}

/** "north", "east", "south", "west" — for a sentence rather than a chip. */
export function wallCompassName(room: Room, wall: Wall): string {
  return LONG[wallFacing(wall, room.northWall)] ?? wall;
}

/**
 * What is set into this wall, in the fewest words that still identify it: "window", "door",
 * "door + window", or nothing when the wall is blank. Two of the same kind still reads as
 * one word, because "window + window" tells nobody anything.
 */
export function wallOpeningsName(room: Room, wall: Wall): string | null {
  const kinds = new Set(room.openings.filter((o) => o.wall === wall).map((o) => o.kind));
  if (kinds.size === 0) return null;
  if (kinds.size === 2) return 'door + window';
  return kinds.has('door') ? 'door' : 'window';
}

/** "Right wall · window" — the full name, for a heading or a sentence. */
export function wallLabel(room: Room, wall: Wall): string {
  const opening = wallOpeningsName(room, wall);
  return opening ? `${POSITION[wall]} wall · ${opening}` : `${POSITION[wall]} wall`;
}

/** "Right · window" — the same name with the word "wall" dropped, for a chip. */
export function wallChipLabel(room: Room, wall: Wall): string {
  const opening = wallOpeningsName(room, wall);
  return opening ? `${POSITION[wall]} · ${opening}` : POSITION[wall];
}
