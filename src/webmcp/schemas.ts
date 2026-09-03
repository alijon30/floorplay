import type { JsonSchemaProp } from './results';
import { CATEGORIES, FLOOR_FINISHES, ROOM_KINDS, ROTATIONS, WALLS } from '../engine/types';

export const COORDS_NOTE =
  'Coordinates are integer centimeters. Origin is the top-left corner of the room; x grows to the right, y grows downward. Items are placed by their center. rotation is 0, 90, 180 or 270 degrees clockwise; at 0 the item front faces +y (the bottom wall). Call get_room first to learn dimensions, openings and current items.';

export const cm = (description: string): JsonSchemaProp => ({ type: 'integer', description: `${description} (cm)` });
export const intProp = (description: string, minimum?: number, maximum?: number): JsonSchemaProp => ({ type: 'integer', description, ...(minimum !== undefined ? { minimum } : {}), ...(maximum !== undefined ? { maximum } : {}) });
export const numProp = (description: string, minimum?: number, maximum?: number): JsonSchemaProp => ({ type: 'number', description, ...(minimum !== undefined ? { minimum } : {}), ...(maximum !== undefined ? { maximum } : {}) });
export const strProp = (description: string): JsonSchemaProp => ({ type: 'string', description });
export const boolProp = (description: string): JsonSchemaProp => ({ type: 'boolean', description });
export const idProp = (description: string): JsonSchemaProp => ({ type: 'string', description });
export const rotationProp: JsonSchemaProp = { type: 'integer', description: 'Rotation in degrees clockwise', enum: [...ROTATIONS] };
export const wallProp: JsonSchemaProp = { type: 'string', description: 'Which wall, named by where it sits on the plan: top, right, bottom or left. These are positions on the drawing the user is looking at, not compass directions — say "the top wall" back to them, not "the north wall"', enum: [...WALLS] };
export const categoryProp: JsonSchemaProp = { type: 'string', description: 'Furniture category', enum: [...CATEGORIES] };
export const roomKindProp: JsonSchemaProp = { type: 'string', description: 'Kind of room the item suits', enum: [...ROOM_KINDS] };
export const floorFinishProp: JsonSchemaProp = { type: 'string', description: 'Floor material', enum: [...FLOOR_FINISHES] };

/** A `#rrggbb` or `#rgb` color. Tools still re-check the value so the hint can name the offender. */
export const HEX_COLOR = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
export const hexColorProp = (description: string): JsonSchemaProp => ({ type: 'string', description: `${description} as hex, like #aabbcc` });

export const placementSchema: JsonSchemaProp = {
  type: 'array',
  description: 'Changes to apply in order',
  items: {
    type: 'object',
    properties: {
      action: { type: 'string', description: 'place | move | remove | swap', enum: ['place', 'move', 'remove', 'swap'] },
      catalogId: strProp('Catalog id (place, swap)'),
      id: strProp('Existing item id (move, remove, swap). For place, optional id to assign'),
      x: cm('Center x (place, move)'),
      y: cm('Center y (place, move)'),
      rotation: rotationProp,
    },
    required: ['action'],
  },
};
