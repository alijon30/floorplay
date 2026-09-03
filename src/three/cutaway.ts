// src/three/cutaway.ts
import type { Rect, Wall } from '../engine/types';
import { WALLS } from '../engine/types';
import { M } from './units';

/**
 * What the dollhouse cutaway measures itself against.
 *
 * A wall the camera has stepped outside of would otherwise fill the frame with its blank outer
 * face, so it steps aside. One room decides that against its own four walls. A whole home has
 * to decide it once, against the plan's outer edge: judged room by room, walking into the
 * living room would take the bedroom's walls away, and the wall two rooms share would vanish
 * for one of them and stay for the other.
 */
export interface Cutaway {
  /** The rectangle the camera is judged against, in cm on whatever plan the scene is drawn on. */
  rect: Rect;
  /** Walls that are never taken away, whatever the camera does: the ones with a room behind them. */
  keep: readonly Wall[];
}

/** A single room standing at the origin, which is where the room view always draws it. */
export function roomCutaway(width: number, depth: number): Cutaway {
  return { rect: { x: 0, y: 0, w: width, h: depth }, keep: [] };
}

/** How far past a wall the camera has to be before that wall gives up, in meters. */
const PAST = 0.02;

/** Whether one wall of a room drawn under this cutaway is currently stepped outside of. */
export function isWallHidden(cam: { x: number; z: number }, cut: Cutaway, wall: Wall): boolean {
  if (cut.keep.includes(wall)) return false;
  const { x, y, w, h } = cut.rect;
  switch (wall) {
    case 'top': return cam.z < y * M - PAST;
    case 'bottom': return cam.z > (y + h) * M + PAST;
    case 'left': return cam.x < x * M - PAST;
    case 'right': return cam.x > (x + w) * M + PAST;
  }
}

/** The same answer for all four walls at once, for the caller that draws all four. */
export function hiddenWalls(cam: { x: number; z: number }, cut: Cutaway): Record<Wall, boolean> {
  return Object.fromEntries(WALLS.map((w) => [w, isWallHidden(cam, cut, w)])) as Record<Wall, boolean>;
}
