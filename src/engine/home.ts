// src/engine/home.ts
import type { Doorway, DoorwaySide, Home, HomeRoomPlacement, Opening, Rect, Room, Wall } from './types';
import { intersects } from './geometry';
import { newId } from './ids';
import { budgetUsed } from './validate';

/** How close an edge has to come to a neighbour's before it is pulled flush, in cm. */
export const SNAP_CM = 20;

/** Every doorway is cut to the same height; a home is not the place to design door leaves. */
export const DOORWAY_HEIGHT = 200;

/**
 * How far apart two coordinates may be and still count as the same line, in cm.
 *
 * Placements come out of `snapRoomPlacement` exactly equal, so this only guards arithmetic that
 * has been through a scale factor on its way from a pointer, never a real 1 mm gap.
 */
const SAME = 0.001;

type Rooms = Readonly<Record<string, Room>>;

const same = (a: number, b: number): boolean => Math.abs(a - b) < SAME;

const isVertical = (wall: Wall): boolean => wall === 'left' || wall === 'right';

export function placementOf(home: Home, roomId: string): HomeRoomPlacement | null {
  return home.rooms.find((p) => p.roomId === roomId) ?? null;
}

/** The home a room stands in, or null when it is standalone. A room is in at most one home. */
export function homeContaining(homes: Readonly<Record<string, Home>>, roomId: string): Home | null {
  return Object.values(homes).find((h) => h.rooms.some((p) => p.roomId === roomId)) ?? null;
}

function rectOf(home: Home, rooms: Rooms, roomId: string): Rect | null {
  const p = placementOf(home, roomId);
  const room = rooms[roomId];
  if (!p || !room) return null;
  return { x: p.x, y: p.y, w: room.width, h: room.depth };
}

/** The room's footprint in home coordinates. Throws when the room is not on this plan. */
export function roomRectInHome(home: Home, rooms: Rooms, roomId: string): Rect {
  const r = rectOf(home, rooms, roomId);
  if (!r) throw new Error(`Room ${roomId} is not on this floor plan`);
  return r;
}

/** The rectangle every room fits inside. An empty home has no extent rather than a default one. */
export function homeBounds(home: Home, rooms: Rooms): Rect {
  const rects = home.rooms.map((p) => rectOf(home, rooms, p.roomId)).filter((r): r is Rect => r !== null);
  const first = rects[0];
  if (!first) return { x: 0, y: 0, w: 0, h: 0 };
  let minX = first.x, minY = first.y, maxX = first.x + first.w, maxY = first.y + first.h;
  for (const r of rects) {
    minX = Math.min(minX, r.x);
    minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.w);
    maxY = Math.max(maxY, r.y + r.h);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/**
 * A stretch of one room's wall that another room's opposite wall lies against.
 *
 * `start` and `end` are along that wall in the room's own coordinates, measured from the left
 * end of a top or bottom wall and from the top end of a left or right wall — the same origin
 * every `Opening.offset` uses, so a segment can be compared with one directly.
 */
export interface SharedSegment { otherRoomId: string; wall: Wall; otherWall: Wall; start: number; end: number }

/**
 * Where this room's walls touch another room's, wall by wall.
 *
 * Only a right wall can meet a left one and only a bottom wall a top one: two rooms drawn side
 * by side on a plan can never present the same-facing wall to each other. Rooms that meet at a
 * bare corner share no segment, because a doorway needs length to be cut into.
 */
export function sharedSegments(home: Home, rooms: Rooms, roomId: string): SharedSegment[] {
  const me = rectOf(home, rooms, roomId);
  if (!me) return [];
  const out: SharedSegment[] = [];
  for (const p of home.rooms) {
    if (p.roomId === roomId) continue;
    const other = rectOf(home, rooms, p.roomId);
    if (!other) continue;

    const yStart = Math.max(me.y, other.y);
    const yEnd = Math.min(me.y + me.h, other.y + other.h);
    if (yEnd - yStart > SAME) {
      if (same(me.x + me.w, other.x)) out.push({ otherRoomId: p.roomId, wall: 'right', otherWall: 'left', start: yStart - me.y, end: yEnd - me.y });
      if (same(me.x, other.x + other.w)) out.push({ otherRoomId: p.roomId, wall: 'left', otherWall: 'right', start: yStart - me.y, end: yEnd - me.y });
    }

    const xStart = Math.max(me.x, other.x);
    const xEnd = Math.min(me.x + me.w, other.x + other.w);
    if (xEnd - xStart > SAME) {
      if (same(me.y + me.h, other.y)) out.push({ otherRoomId: p.roomId, wall: 'bottom', otherWall: 'top', start: xStart - me.x, end: xEnd - me.x });
      if (same(me.y, other.y + other.h)) out.push({ otherRoomId: p.roomId, wall: 'top', otherWall: 'bottom', start: xStart - me.x, end: xEnd - me.x });
    }
  }
  return out;
}

export interface SnapResult { x: number; y: number; snapped: boolean; overlaps: string[] }

/**
 * Pull a placement onto its neighbours: flush against an opposite edge, aligned at a corner.
 *
 * The two axes are snapped independently, which is what makes a corner fall into place: dragging
 * a room to the right of another snaps x flush to that room's right edge and y to its top one,
 * in the same move. Flush wins a tie with alignment, because meeting a wall is the point.
 *
 * `overlaps` is answered after snapping and names the rooms this placement would sit inside.
 * Two rooms sharing a wall touch but do not overlap; the caller decides what to do about the
 * ones that do.
 */
export function snapRoomPlacement(home: Home, rooms: Rooms, roomId: string, x: number, y: number, width: number, depth: number): SnapResult {
  const neighbours = home.rooms
    .filter((p) => p.roomId !== roomId)
    .map((p) => ({ id: p.roomId, rect: rectOf(home, rooms, p.roomId) }))
    .filter((n): n is { id: string; rect: Rect } => n.rect !== null);

  const snapAxis = (v: number, size: number, ranges: { lo: number; hi: number }[]): number => {
    let best = v;
    let bestD = Infinity;
    for (const r of ranges) {
      // Flush first, so an edge that could equally align with a corner still meets the wall.
      for (const c of [r.hi, r.lo - size, r.lo, r.hi - size]) {
        const d = Math.abs(c - v);
        if (d <= SNAP_CM && d < bestD) { best = c; bestD = d; }
      }
    }
    return best;
  };

  const sx = snapAxis(x, width, neighbours.map((n) => ({ lo: n.rect.x, hi: n.rect.x + n.rect.w })));
  const sy = snapAxis(y, depth, neighbours.map((n) => ({ lo: n.rect.y, hi: n.rect.y + n.rect.h })));
  const placed: Rect = { x: sx, y: sy, w: width, h: depth };
  return {
    x: sx,
    y: sy,
    snapped: !same(sx, x) || !same(sy, y),
    overlaps: neighbours.filter((n) => intersects(placed, n.rect)).map((n) => n.id),
  };
}

export interface DoorwaySpec {
  roomId: string;
  wall: Wall;
  offset: number;
  width: number;
  kind: 'door' | 'passage';
  /** Which neighbour to open into, when more than one room lies behind that wall. */
  otherRoomId?: string;
}

export type DoorwayBuild =
  | { ok: true; doorway: Doorway; a: Opening; b: Opening }
  | { ok: false; error: string; hint: string };

const describeSegments = (segs: SharedSegment[], rooms: Rooms): string =>
  segs.map((s) => `${rooms[s.otherRoomId]?.name ?? s.otherRoomId} from ${Math.round(s.start)} to ${Math.round(s.end)} cm`).join(', ');

/**
 * Work out the two halves of a doorway without touching either room.
 *
 * The offset is mirrored through home coordinates: a point on the wall is the room's own offset
 * plus its placement, and the neighbour reads that same point back from its own corner. The two
 * numbers agree only when the rooms start level, which is why this cannot be skipped.
 */
export function doorwayOpenings(home: Home, rooms: Rooms, spec: DoorwaySpec): DoorwayBuild {
  const room = rooms[spec.roomId];
  const me = rectOf(home, rooms, spec.roomId);
  if (!room || !me) {
    return { ok: false, error: `Room ${spec.roomId} is not on this floor plan`, hint: 'Add the room to the home before cutting a doorway from it.' };
  }
  if (!(spec.width > 0)) {
    return { ok: false, error: 'A doorway needs a positive width', hint: 'Interior doors are usually 70 to 90 cm wide.' };
  }

  const onWall = sharedSegments(home, rooms, spec.roomId).filter((s) => s.wall === spec.wall);
  const segs = spec.otherRoomId ? onWall.filter((s) => s.otherRoomId === spec.otherRoomId) : onWall;
  if (segs.length === 0) {
    const all = sharedSegments(home, rooms, spec.roomId);
    const hint = all.length
      ? `${room.name} shares its ${[...new Set(all.map((s) => s.wall))].join(' and ')} wall with another room.`
      : `${room.name} does not touch another room yet. Move it against one first.`;
    return { ok: false, error: `The ${spec.wall} wall of ${room.name} is not shared with ${spec.otherRoomId ? rooms[spec.otherRoomId]?.name ?? spec.otherRoomId : 'another room'}`, hint };
  }

  const seg = segs.find((s) => spec.offset >= s.start - SAME && spec.offset + spec.width <= s.end + SAME);
  if (!seg) {
    return {
      ok: false,
      error: `A ${spec.width} cm doorway at ${spec.offset} cm does not fit the shared part of the ${spec.wall} wall`,
      hint: `${room.name} shares that wall with ${describeSegments(segs, rooms)}.`,
    };
  }

  const otherRect = rectOf(home, rooms, seg.otherRoomId);
  if (!otherRect) {
    return { ok: false, error: `Room ${seg.otherRoomId} is not on this floor plan`, hint: 'The plan changed while the doorway was being cut; try again.' };
  }
  const vertical = isVertical(spec.wall);
  const globalPos = (vertical ? me.y : me.x) + spec.offset;
  const otherOffset = globalPos - (vertical ? otherRect.y : otherRect.x);

  const id = newId('dw');
  const a: DoorwaySide = { roomId: spec.roomId, wall: spec.wall, offset: spec.offset };
  const b: DoorwaySide = { roomId: seg.otherRoomId, wall: seg.otherWall, offset: otherOffset };
  const opening = (side: DoorwaySide, suffix: 'a' | 'b', swing: 'in' | 'out'): Opening => ({
    id: `door_${id}_${suffix}`, kind: 'door', wall: side.wall, offset: side.offset,
    width: spec.width, height: DOORWAY_HEIGHT, swing, doorwayId: id,
  });
  return {
    ok: true,
    doorway: { id, a, b, width: spec.width, kind: spec.kind },
    // A door leaf hangs in room a and swings into it; room b only ever sees the hole. A passage
    // has no leaf at all, so nothing swings anywhere.
    a: opening(a, 'a', spec.kind === 'passage' ? 'out' : 'in'),
    b: opening(b, 'b', 'out'),
  };
}

/**
 * Which rooms you can walk to from the front door, and which you cannot.
 *
 * The entrance is the one the home names, else the first room with a door that leads outside —
 * an opening of kind door carrying no `doorwayId`, since every doorway between two rooms carries
 * one — else simply the first room, so a home under construction still reports something useful.
 */
export function homeReachability(home: Home, rooms: Rooms): { entranceRoomId: string | null; unreachable: string[] } {
  const ids = home.rooms.map((p) => p.roomId).filter((id) => rooms[id]);
  const first = ids[0];
  if (first === undefined) return { entranceRoomId: null, unreachable: [] };

  const named = home.entranceRoomId && ids.includes(home.entranceRoomId) ? home.entranceRoomId : null;
  const external = ids.find((id) => rooms[id]!.openings.some((o) => o.kind === 'door' && !o.doorwayId));
  const entranceRoomId = named ?? external ?? first;

  const adjacency = new Map<string, string[]>(ids.map((id) => [id, []]));
  for (const d of home.doorways) {
    const from = adjacency.get(d.a.roomId);
    const to = adjacency.get(d.b.roomId);
    if (!from || !to) continue;
    from.push(d.b.roomId);
    to.push(d.a.roomId);
  }

  const seen = new Set<string>([entranceRoomId]);
  const queue = [entranceRoomId];
  while (queue.length) {
    for (const next of adjacency.get(queue.shift()!) ?? []) {
      if (seen.has(next)) continue;
      seen.add(next);
      queue.push(next);
    }
  }
  return { entranceRoomId, unreachable: ids.filter((id) => !seen.has(id)) };
}

export interface HomeTotals { areaM2: number; budget: number; budgetUsed: number; items: number; rooms: number }

/** The whole home in one line: floor area, what it is meant to cost and what it costs so far. */
export function homeTotals(home: Home, rooms: Rooms): HomeTotals {
  const list = home.rooms.map((p) => rooms[p.roomId]).filter((r): r is Room => r !== undefined);
  const areaCm2 = list.reduce((sum, r) => sum + r.width * r.depth, 0);
  return {
    areaM2: Math.round(areaCm2 / 100) / 100,
    budget: list.reduce((sum, r) => sum + r.brief.budget, 0),
    budgetUsed: list.reduce((sum, r) => sum + budgetUsed(r), 0),
    items: list.reduce((sum, r) => sum + r.items.length, 0),
    rooms: list.length,
  };
}
