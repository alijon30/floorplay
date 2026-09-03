// src/engine/wallColor.ts
import type { RoomFinish, Wall } from './types';
import { DEFAULT_FINISH } from './types';

/**
 * The paint on one wall: its own override when it has one, otherwise the room's default.
 *
 * Everything that draws a wall — the 3D view, the elevation, the palette panel — reads it
 * through here, so a room persisted before per-wall colour existed (no `walls`, or no
 * `finish` at all) still paints, and there is exactly one place that knows the fallback order.
 *
 * Takes anything carrying a `finish`, because `Walls` is also handed a bare shell in tests.
 */
export function wallColor(room: { finish?: RoomFinish | undefined }, wall: Wall): string {
  const finish = room.finish;
  return finish?.walls?.[wall] ?? finish?.wall ?? DEFAULT_FINISH.wall;
}

/**
 * The finish that paints one wall `color`, leaving every other wall as it was.
 *
 * Returned rather than applied: `setFinish` takes the whole finish object, so the caller
 * hands this straight to the op.
 */
export function withWallColor(finish: RoomFinish, wall: Wall, color: string): RoomFinish {
  return { ...finish, walls: { ...finish.walls, [wall]: color } };
}

/** The finish that paints every wall `color`, dropping the per-wall overrides entirely. */
export function withAllWallsColor(finish: RoomFinish, color: string): RoomFinish {
  return { wall: color, floor: finish.floor };
}
