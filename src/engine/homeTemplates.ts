// src/engine/homeTemplates.ts
import type { Home, HomeRoomPlacement, Room, RoomKind, Wall } from './types';
import { buildTemplateRoom } from './templates';
import { doorwayOpenings, sharedSegments } from './home';
import { newId } from './ids';

export type HomeTemplateKey = 'one-bedroom' | 'studio-hall';
export const HOME_TEMPLATE_KEYS: HomeTemplateKey[] = ['one-bedroom', 'studio-hall'];

/** One room of a ready-made home: which room template to build, and where to stand it. */
export interface HomeTemplateRoom { key: RoomKind; x: number; y: number; name?: string }

/**
 * One doorway of a ready-made home, naming its two rooms by their index in `rooms`.
 *
 * `room` is the side the door swings into, so it is the room a person arrives from: the hall
 * for the front rooms, the living room for the ones beyond it.
 */
export interface HomeTemplateDoorway {
  room: number;
  other: number;
  wall: Wall;
  offset: number;
  width: number;
  kind: 'door' | 'passage';
}

export interface HomeTemplate {
  key: HomeTemplateKey;
  name: string;
  blurb: string;
  rooms: HomeTemplateRoom[];
  doorways: HomeTemplateDoorway[];
  /** Index of the room the front door is in. Defaults to the first room. */
  entrance?: number;
}

/**
 * A hall, a living room off it, and a bedroom and kitchen off that.
 *
 * Every offset is a room's top-left corner in cm on the shared plan, so the numbers below also
 * say which walls meet: the hall's right wall at x=200 is the living room's left wall, the
 * living room's bottom wall at y=550 is the bedroom's top one, and its right wall at x=650 is
 * the kitchen's left one.
 */
const ONE_BEDROOM: HomeTemplate = {
  key: 'one-bedroom',
  name: 'One-bedroom flat',
  blurb: 'A hall you come in through, a living room off it, and a bedroom and kitchen beyond.',
  rooms: [
    { key: 'hall', x: 0, y: 0 },
    { key: 'living', x: 200, y: 0 },
    { key: 'bedroom', x: 200, y: 550 },
    { key: 'kitchen', x: 650, y: 0 },
  ],
  doorways: [
    { room: 0, other: 1, wall: 'right', offset: 40, width: 80, kind: 'door' },
    { room: 1, other: 2, wall: 'bottom', offset: 240, width: 80, kind: 'door' },
    { room: 1, other: 3, wall: 'right', offset: 95, width: 80, kind: 'passage' },
  ],
  entrance: 0,
};

/** The starter flat: one hall and one room, joined by a single door. */
const STUDIO_HALL: HomeTemplate = {
  key: 'studio-hall',
  name: 'Studio and hall',
  blurb: 'The starter studio with a proper entrance hall in front of it.',
  rooms: [
    { key: 'hall', x: 0, y: 0 },
    { key: 'studio', x: 200, y: 0 },
  ],
  doorways: [
    { room: 0, other: 1, wall: 'right', offset: 210, width: 80, kind: 'door' },
  ],
  entrance: 0,
};

const BY_KEY: Record<HomeTemplateKey, HomeTemplate> = { 'one-bedroom': ONE_BEDROOM, 'studio-hall': STUDIO_HALL };

/** Ready-made homes, in `HOME_TEMPLATE_KEYS` order. */
export const HOME_TEMPLATES: HomeTemplate[] = HOME_TEMPLATE_KEYS.map((k) => BY_KEY[k]);

export function homeTemplateFor(key: HomeTemplateKey): HomeTemplate {
  return BY_KEY[key];
}

/**
 * Build a fresh home: its rooms from the room templates, then its doorways cut through both.
 *
 * The openings go straight onto the rooms rather than through the store's ledger, the same way
 * `buildTemplateRoom` starts a room with an empty history: loading a ready-made home is that
 * home's beginning, not a series of edits somebody might want to undo one at a time.
 */
export function buildHomeFromTemplate(key: HomeTemplateKey): { home: Home; rooms: Room[] } {
  const t = BY_KEY[key];
  const rooms = t.rooms.map((r) => buildTemplateRoom(r.key, r.name));
  const placements: HomeRoomPlacement[] = t.rooms.map((r, i) => ({ roomId: rooms[i]!.id, x: r.x, y: r.y }));
  const byId: Record<string, Room> = Object.fromEntries(rooms.map((r) => [r.id, r]));
  const home: Home = {
    id: newId('home'),
    name: t.name,
    rooms: placements,
    doorways: [],
    entranceRoomId: rooms[t.entrance ?? 0]!.id,
  };

  // A room template carries its own door and windows for standing alone. Once the room is on a
  // plan, any of them that falls on a party wall would open onto the neighbour's solid wall — a
  // door to nowhere — so those go before the doorways are cut. The standalone template is untouched.
  for (const room of rooms) {
    const shared = sharedSegments(home, byId, room.id);
    room.openings = room.openings.filter(
      (o) => !shared.some((s) => s.wall === o.wall && o.offset < s.end && o.offset + o.width > s.start),
    );
  }

  for (const d of t.doorways) {
    const from = rooms[d.room]!;
    const to = rooms[d.other]!;
    const cut = doorwayOpenings(home, byId, { roomId: from.id, otherRoomId: to.id, wall: d.wall, offset: d.offset, width: d.width, kind: d.kind });
    // A template that cannot be cut is a bug in the numbers above, not something a caller can
    // recover from; `homeTemplates.test.ts` is what keeps this from ever firing in the app.
    if (!cut.ok) throw new Error(`${t.key}: ${cut.error}`);
    from.openings = [...from.openings, cut.a];
    to.openings = [...to.openings, cut.b];
    home.doorways = [...home.doorways, cut.doorway];
  }

  return { home, rooms };
}
