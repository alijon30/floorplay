import { describe, it, expect } from 'vitest';
import { hiddenWalls, isWallHidden, roomCutaway } from '../cutaway';
import { M } from '../units';

/** A camera at these centimetres on the plan, at whatever height. */
const at = (x: number, z: number) => ({ x: x * M, z: z * M });

describe('dollhouse cutaway', () => {
  it('takes away the walls the camera has stepped outside of', () => {
    const cut = roomCutaway(400, 500);
    expect(hiddenWalls(at(-300, -300), cut)).toEqual({ top: true, left: true, bottom: false, right: false });
    expect(hiddenWalls(at(700, 900), cut)).toEqual({ top: false, left: false, bottom: true, right: true });
  });

  it('keeps every wall while the camera is inside', () => {
    const cut = roomCutaway(400, 500);
    expect(hiddenWalls(at(200, 250), cut)).toEqual({ top: false, bottom: false, left: false, right: false });
  });

  it('judges a room on the home plan against the home edge, not its own', () => {
    // The bedroom sits at (200, 550) inside a home 1030 x 970; the camera is off the home's
    // top-left corner, which is outside the home and outside the bedroom both.
    const cut = { rect: { x: 0, y: 0, w: 1030, h: 970 }, keep: ['top'] as const };
    expect(hiddenWalls(at(-400, -400), cut)).toEqual({ top: false, left: true, bottom: false, right: false });
    // Standing in the living room is inside the home, so no room is stripped of its walls.
    expect(hiddenWalls(at(400, 300), cut)).toEqual({ top: false, bottom: false, left: false, right: false });
  });

  it('never takes away a wall another room stands behind', () => {
    const cut = { rect: { x: 0, y: 0, w: 500, h: 400 }, keep: ['left', 'bottom'] as const };
    expect(isWallHidden(at(-100, -100), cut, 'left')).toBe(false);
    expect(isWallHidden(at(-100, -100), cut, 'top')).toBe(true);
    expect(isWallHidden(at(600, 500), cut, 'bottom')).toBe(false);
    expect(isWallHidden(at(600, 500), cut, 'right')).toBe(true);
  });
});
