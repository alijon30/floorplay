// src/finishes.ts
// How each floor finish looks, in the two places that are not the 3D view: the plan's floor
// fill and the swatch chips in the style popover. The 3D plank and tile textures are drawn
// from `src/three/textures.ts`, which owns its own hues because it paints grain and joints
// rather than a flat color.
import type { FloorFinish } from './engine/types';

/**
 * Floor fill on the plan.
 *
 * The plan is a dark technical drawing, so these are tints rather than wood colors: enough
 * to tell walnut from ash at a glance without lifting the floor above the furniture drawn
 * on top of it.
 */
export const FLOOR_PLAN_FILL: Record<FloorFinish, string> = {
  oak: '#2b2520',
  walnut: '#241c18',
  ash: '#2a2a28',
  grey: '#262729',
  tile: '#23282c',
};

/** The chip shown on a finish button: what the material actually looks like in daylight. */
export const FLOOR_SWATCH: Record<FloorFinish, string> = {
  oak: '#b98d5b',
  walnut: '#6d4a32',
  ash: '#d6c6ac',
  grey: '#9a9a99',
  tile: '#cfd6da',
};

export const FLOOR_LABEL: Record<FloorFinish, string> = {
  oak: 'Oak',
  walnut: 'Walnut',
  ash: 'Ash',
  grey: 'Grey',
  tile: 'Tile',
};
