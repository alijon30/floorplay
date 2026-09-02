// src/engine/templates.ts
import type { Brief, Opening, Room, RoomFinish, RoomKind, Rotation, Wall } from './types';
import { ROOM_KINDS } from './types';
import { makeEmptyRoom } from './rooms';
import { newId } from './ids';

/** One placed piece in a template, in the same plan coordinates the tools use. */
export interface TemplateItem {
  catalogId: string;
  x: number;
  y: number;
  rotation: Rotation;
  /** Optional per-placement color override, used when the template wants a non-default finish. */
  color?: string;
}

/**
 * A ready-made room: a shell, its openings, a brief, a finish and a furnished layout.
 *
 * Every template is checked by `templates.test.ts` to have no blocking violations, no
 * unreachable item and a total price within its own budget, so `load_template` always hands
 * the user a room that already validates.
 */
export interface RoomTemplate {
  key: RoomKind;
  name: string;
  blurb: string;
  width: number;
  depth: number;
  height: number;
  northWall: Wall;
  openings: Opening[];
  brief: Brief;
  finish: RoomFinish;
  items: TemplateItem[];
  /** Hour the daylight slider starts at. Defaults to noon when a template does not care. */
  daylightHour?: number;
}

const door = (wall: Wall, offset: number, width: number): Opening =>
  ({ id: `door-${wall}-${offset}`, kind: 'door', wall, offset, width, height: 200, swing: 'in', hinge: 'start' });

const window_ = (wall: Wall, offset: number, width: number, height = 120, sill = 90): Opening =>
  ({ id: `window-${wall}-${offset}`, kind: 'window', wall, offset, width, height, sill });

const brief = (budget: number, needs: string[], notes: string): Brief => ({ budget, currency: 'USD', needs, notes });

const LIVING: RoomTemplate = {
  key: 'living',
  name: 'Living room',
  blurb: 'A sofa facing the TV wall, a reading corner and a rug that ties the seating together.',
  width: 450, depth: 550, height: 270, northWall: 'top',
  openings: [door('bottom', 40, 90), window_('top', 150, 180, 130)],
  brief: brief(2000, ['seat five', 'watch films', 'read'], 'Keep the middle of the floor open.'),
  finish: { wall: '#efe9df', floor: 'oak' },
  items: [
    { catalogId: 'rug-200x300', x: 225, y: 250, rotation: 0 },
    { catalogId: 'sofa-3', x: 45, y: 250, rotation: 270 },
    { catalogId: 'tv-stand-160', x: 430, y: 250, rotation: 90 },
    { catalogId: 'table-coffee-90', x: 225, y: 250, rotation: 0 },
    { catalogId: 'armchair-80', x: 405, y: 430, rotation: 90 },
    { catalogId: 'shelf-80', x: 60, y: 15, rotation: 0 },
    { catalogId: 'plant-large', x: 400, y: 60, rotation: 0 },
    { catalogId: 'lamp-floor', x: 110, y: 400, rotation: 0 },
    { catalogId: 'picture-90', x: 300, y: 547.5, rotation: 180 },
    { catalogId: 'curtain-200', x: 240, y: 5, rotation: 0 },
  ],
};

const KITCHEN: RoomTemplate = {
  key: 'kitchen',
  name: 'Kitchen',
  blurb: 'Counters in an L along two walls with the fridge at the end of the run and an island in the middle.',
  width: 380, depth: 420, height: 250, northWall: 'top',
  openings: [door('right', 300, 80), window_('top', 140, 120, 110, 100)],
  brief: brief(3500, ['cook for four', 'store dry goods', 'sit for breakfast'], 'Work triangle between sink, hob and fridge.'),
  finish: { wall: '#eef1f4', floor: 'tile' },
  items: [
    { catalogId: 'counter-corner-90', x: 45, y: 45, rotation: 0 },
    { catalogId: 'sink-unit-80', x: 130, y: 30, rotation: 0 },
    { catalogId: 'counter-180', x: 260, y: 30, rotation: 0 },
    { catalogId: 'dishwasher-60', x: 30, y: 210, rotation: 270 },
    { catalogId: 'oven-60', x: 30, y: 280, rotation: 270 },
    { catalogId: 'fridge-tall-70', x: 35, y: 355, rotation: 270 },
    { catalogId: 'island-120', x: 240, y: 250, rotation: 0 },
    { catalogId: 'stool-bar-75', x: 200, y: 399, rotation: 180 },
    { catalogId: 'stool-bar-75', x: 280, y: 399, rotation: 180 },
    { catalogId: 'wall-clock-30', x: 377.5, y: 100, rotation: 90 },
    { catalogId: 'wall-shelf-60', x: 10, y: 130, rotation: 270 },
  ],
};

const BEDROOM: RoomTemplate = {
  key: 'bedroom',
  name: 'Bedroom',
  blurb: 'Queen bed against the long wall, wardrobe opposite and a small desk under the window.',
  width: 340, depth: 420, height: 250, northWall: 'top',
  openings: [door('bottom', 20, 80), window_('right', 190, 140)],
  brief: brief(1900, ['sleep', 'store clothes', 'write letters'], 'Bed away from the door swing.'),
  finish: { wall: '#efe9df', floor: 'oak' },
  items: [
    { catalogId: 'bed-queen-160', x: 150, y: 100, rotation: 0 },
    { catalogId: 'nightstand-45', x: 25, y: 22, rotation: 0 },
    { catalogId: 'wardrobe-150', x: 175, y: 390, rotation: 180 },
    { catalogId: 'desk-100', x: 315, y: 270, rotation: 90 },
    { catalogId: 'rug-160x230', x: 150, y: 220, rotation: 0 },
    { catalogId: 'lamp-floor', x: 60, y: 270, rotation: 0 },
    { catalogId: 'mirror-rect-80', x: 2.5, y: 150, rotation: 270 },
    { catalogId: 'curtain-140', x: 335, y: 260, rotation: 90 },
    { catalogId: 'picture-60', x: 150, y: 2, rotation: 0 },
  ],
};

const HALL: RoomTemplate = {
  key: 'hall',
  name: 'Entrance hall',
  blurb: 'Everything hugs the walls so the run from the front door stays clear.',
  width: 200, depth: 420, height: 250, northWall: 'top',
  openings: [door('bottom', 60, 90), window_('left', 150, 80, 100, 110)],
  brief: brief(800, ['hang coats', 'store shoes', 'drop keys'], 'Nothing may narrow the walk-through.'),
  finish: { wall: '#e4d7c2', floor: 'walnut' },
  items: [
    { catalogId: 'shoe-cabinet-100', x: 185, y: 120, rotation: 90 },
    { catalogId: 'coat-rack-60', x: 180, y: 250, rotation: 90 },
    { catalogId: 'table-console-100', x: 17.5, y: 100, rotation: 270 },
    { catalogId: 'bench-hall-90', x: 19, y: 250, rotation: 270 },
    { catalogId: 'plant-medium', x: 70, y: 40, rotation: 0 },
    { catalogId: 'rug-80x150', x: 100, y: 300, rotation: 0 },
    { catalogId: 'mirror-round-60', x: 197.5, y: 350, rotation: 90 },
    { catalogId: 'coat-hooks-60', x: 5, y: 350, rotation: 270 },
  ],
};

const OFFICE: RoomTemplate = {
  key: 'office',
  name: 'Home office',
  blurb: 'Desk under the window, shelving on the blank wall and files within reach of the chair.',
  width: 340, depth: 360, height: 250, northWall: 'top',
  openings: [door('bottom', 20, 80), window_('top', 120, 160)],
  brief: brief(1400, ['work all day', 'take calls', 'file paperwork'], 'Daylight on the desk, no glare on the screen.'),
  finish: { wall: '#eef1f4', floor: 'ash' },
  items: [
    { catalogId: 'desk-140', x: 170, y: 35, rotation: 0 },
    { catalogId: 'chair-office', x: 290, y: 130, rotation: 0 },
    { catalogId: 'shelf-tall-200', x: 17.5, y: 120, rotation: 270 },
    { catalogId: 'cabinet-120', x: 170, y: 337.5, rotation: 180 },
    { catalogId: 'filing-cabinet-45', x: 310, y: 250, rotation: 90 },
    { catalogId: 'lamp-floor', x: 60, y: 200, rotation: 0 },
    { catalogId: 'plant-medium', x: 170, y: 200, rotation: 0 },
    { catalogId: 'pinboard-80', x: 50, y: 2, rotation: 0 },
    { catalogId: 'wall-shelf-100', x: 11, y: 250, rotation: 270 },
  ],
};

const DINING: RoomTemplate = {
  key: 'dining',
  name: 'Dining room',
  blurb: 'A long table centred under the pendant with chairs pulled back on every side.',
  width: 420, depth: 520, height: 270, northWall: 'top',
  openings: [door('bottom', 40, 90), window_('top', 140, 200, 140)],
  brief: brief(1800, ['seat six', 'serve from a sideboard'], 'Room to push a chair back on every side.'),
  finish: { wall: '#efe9df', floor: 'walnut' },
  items: [
    { catalogId: 'rug-240x340', x: 210, y: 240, rotation: 0 },
    { catalogId: 'table-dining-200', x: 210, y: 240, rotation: 0 },
    { catalogId: 'chair-dining', x: 160, y: 100, rotation: 0 },
    { catalogId: 'chair-dining', x: 260, y: 100, rotation: 0 },
    { catalogId: 'chair-dining', x: 160, y: 380, rotation: 180 },
    { catalogId: 'chair-dining', x: 260, y: 380, rotation: 180 },
    { catalogId: 'chair-dining', x: 75, y: 240, rotation: 270 },
    { catalogId: 'chair-dining', x: 345, y: 240, rotation: 90 },
    { catalogId: 'sideboard-200', x: 300, y: 497.5, rotation: 180 },
    { catalogId: 'pendant-40', x: 210, y: 240, rotation: 0 },
    { catalogId: 'picture-90', x: 417.5, y: 150, rotation: 90 },
  ],
};

const KIDS: RoomTemplate = {
  key: 'kids',
  name: 'Kids room',
  blurb: 'A crib on one wall, a bed on the other and a soft rug across the floor between them.',
  width: 340, depth: 420, height: 250, northWall: 'top',
  openings: [door('bottom', 200, 80), window_('top', 130, 140)],
  brief: brief(1800, ['sleep two', 'store toys', 'draw and read'], 'Nothing sharp in the middle of the floor.'),
  finish: { wall: '#c3cdb9', floor: 'oak' },
  items: [
    { catalogId: 'crib-70', x: 65, y: 60, rotation: 270 },
    { catalogId: 'bed-single-90', x: 285, y: 100, rotation: 0 },
    { catalogId: 'wardrobe-corner-100', x: 60, y: 370, rotation: 180 },
    { catalogId: 'desk-100', x: 315, y: 320, rotation: 90 },
    { catalogId: 'shelf-60', x: 325, y: 235, rotation: 90 },
    { catalogId: 'toy-box-80', x: 150, y: 397.5, rotation: 180 },
    { catalogId: 'chair-kids-30', x: 155, y: 90, rotation: 0 },
    { catalogId: 'rug-round-140', x: 180, y: 250, rotation: 0 },
    { catalogId: 'pinboard-80', x: 60, y: 2, rotation: 0 },
  ],
};

const STUDIO: RoomTemplate = {
  key: 'studio',
  name: 'Studio flat',
  blurb: 'The starter studio, furnished: bed in the corner, desk in the east light, a loveseat by the door.',
  width: 360, depth: 520, height: 260, northWall: 'top',
  openings: [
    { id: 'door-main', kind: 'door', wall: 'bottom', offset: 20, width: 80, height: 200, swing: 'in', hinge: 'start' },
    { id: 'window-east', kind: 'window', wall: 'right', offset: 190, width: 140, height: 120, sill: 90 },
  ],
  brief: brief(1200, ['sleep', 'work from home', 'host two friends'], 'I like natural light at my desk.'),
  finish: { wall: '#efe9df', floor: 'oak' },
  daylightHour: 9,
  items: [
    { catalogId: 'bed-double-140', x: 70, y: 100, rotation: 0 },
    { catalogId: 'nightstand-45', x: 230, y: 20, rotation: 0 },
    { catalogId: 'desk-120', x: 330, y: 250, rotation: 90 },
    { catalogId: 'loveseat-140', x: 40, y: 350, rotation: 270 },
    { catalogId: 'rug-120x180', x: 170, y: 350, rotation: 0 },
    { catalogId: 'lamp-floor', x: 330, y: 60, rotation: 0 },
    { catalogId: 'plant-medium', x: 320, y: 430, rotation: 0 },
    { catalogId: 'picture-60', x: 250, y: 2, rotation: 0 },
  ],
};

/** Every template, keyed so TypeScript refuses a missing room kind. */
const BY_KEY: Record<RoomKind, RoomTemplate> = {
  living: LIVING, kitchen: KITCHEN, bedroom: BEDROOM, hall: HALL,
  office: OFFICE, dining: DINING, kids: KIDS, studio: STUDIO,
};

/** Ready-made rooms, in `ROOM_KINDS` order. */
export const TEMPLATES: RoomTemplate[] = ROOM_KINDS.map((k) => BY_KEY[k]);

export function templateFor(key: RoomKind): RoomTemplate {
  return BY_KEY[key];
}

/**
 * Build a fresh room from a template.
 *
 * Every id is minted at call time, so two rooms built from the same template share no room,
 * opening or item id and can sit side by side in the store. The ledger starts empty: loading a
 * template is the room's beginning, not an edit to undo piecemeal.
 */
export function buildTemplateRoom(key: RoomKind, name?: string): Room {
  const t = BY_KEY[key];
  const room = makeEmptyRoom(name ?? t.name, t.width, t.depth, t.height);
  room.northWall = t.northWall;
  room.openings = t.openings.map((o) => ({ ...o, id: newId(o.kind) }));
  room.brief = { ...t.brief, needs: [...t.brief.needs] };
  room.finish = { ...t.finish };
  room.daylightHour = t.daylightHour ?? room.daylightHour;
  room.items = t.items.map((i) => ({
    id: newId('item'), catalogId: i.catalogId, x: i.x, y: i.y, rotation: i.rotation, locked: false,
    ...(i.color ? { color: i.color } : {}),
  }));
  return room;
}
