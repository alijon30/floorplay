import { describe, it, expect } from 'vitest';
import type { Home, Opening, Room } from '../types';
import { makeEmptyRoom } from '../rooms';
import {
  doorwayOpenings, homeBounds, homeContaining, homeReachability, homeTotals,
  roomRectInHome, sharedSegments, snapRoomPlacement,
} from '../home';

function room(id: string, width: number, depth: number, openings: Opening[] = []): Room {
  return { ...makeEmptyRoom(id, width, depth, 250), id, openings };
}

const extDoor: Opening = { id: 'ext', kind: 'door', wall: 'bottom', offset: 20, width: 80, height: 200, swing: 'in' };

/** A: 300x400 at the origin, B: 200x400 flush to its right, C: 300x200 flush below it. */
function grid(): { home: Home; rooms: Record<string, Room> } {
  const rooms = {
    a: room('a', 300, 400, [extDoor]),
    b: room('b', 200, 400),
    c: room('c', 300, 200),
  };
  const home: Home = {
    id: 'h1', name: 'Test flat', doorways: [],
    rooms: [{ roomId: 'a', x: 0, y: 0 }, { roomId: 'b', x: 300, y: 0 }, { roomId: 'c', x: 0, y: 400 }],
  };
  return { home, rooms };
}

describe('home geometry', () => {
  it('places each room at its offset and bounds the whole plan', () => {
    const { home, rooms } = grid();
    expect(roomRectInHome(home, rooms, 'b')).toEqual({ x: 300, y: 0, w: 200, h: 400 });
    expect(roomRectInHome(home, rooms, 'c')).toEqual({ x: 0, y: 400, w: 300, h: 200 });
    expect(homeBounds(home, rooms)).toEqual({ x: 0, y: 0, w: 500, h: 600 });
    expect(() => roomRectInHome(home, rooms, 'nope')).toThrow(/not on this floor plan/);
    expect(homeBounds({ id: 'h', name: 'Empty', rooms: [], doorways: [] }, {})).toEqual({ x: 0, y: 0, w: 0, h: 0 });
  });

  it('reports shared segments for right-to-left and bottom-to-top pairs', () => {
    const { home, rooms } = grid();
    expect(sharedSegments(home, rooms, 'a')).toEqual([
      { otherRoomId: 'b', wall: 'right', otherWall: 'left', start: 0, end: 400 },
      { otherRoomId: 'c', wall: 'bottom', otherWall: 'top', start: 0, end: 300 },
    ]);
    // Seen from the neighbour the same wall is its left, and the interval is in its coordinates.
    expect(sharedSegments(home, rooms, 'b')).toEqual([
      { otherRoomId: 'a', wall: 'left', otherWall: 'right', start: 0, end: 400 },
    ]);
    expect(sharedSegments(home, rooms, 'c')).toEqual([
      { otherRoomId: 'a', wall: 'top', otherWall: 'bottom', start: 0, end: 300 },
    ]);
  });

  it('clips a shared segment to the overlapping part of the two walls', () => {
    const rooms = { a: room('a', 300, 400), b: room('b', 200, 400) };
    const home: Home = {
      id: 'h', name: 'Offset pair', doorways: [],
      rooms: [{ roomId: 'a', x: 0, y: 0 }, { roomId: 'b', x: 300, y: 250 }],
    };
    expect(sharedSegments(home, rooms, 'a')).toEqual([
      { otherRoomId: 'b', wall: 'right', otherWall: 'left', start: 250, end: 400 },
    ]);
    expect(sharedSegments(home, rooms, 'b')).toEqual([
      { otherRoomId: 'a', wall: 'left', otherWall: 'right', start: 0, end: 150 },
    ]);
  });

  it('shares nothing between walls that are not collinear, and nothing at a bare corner', () => {
    const rooms = { a: room('a', 300, 400), b: room('b', 200, 300), c: room('c', 200, 200) };
    const home: Home = {
      id: 'h', name: 'Apart', doorways: [],
      // b stops 10 cm short of a's right wall; c meets a only at the corner (300, 400).
      rooms: [{ roomId: 'a', x: 0, y: 0 }, { roomId: 'b', x: 310, y: 0 }, { roomId: 'c', x: 300, y: 400 }],
    };
    expect(sharedSegments(home, rooms, 'a')).toEqual([]);
    expect(sharedSegments(home, rooms, 'b')).toEqual([]);
    expect(sharedSegments(home, rooms, 'c')).toEqual([]);
  });
});

describe('snapRoomPlacement', () => {
  const base = () => {
    const rooms = { a: room('a', 300, 400), n: room('n', 200, 300) };
    const home: Home = { id: 'h', name: 'Snap', rooms: [{ roomId: 'a', x: 0, y: 0 }], doorways: [] };
    return { home, rooms };
  };

  it('snaps an edge flush to a neighbour and aligns the corner', () => {
    const { home, rooms } = base();
    const r = snapRoomPlacement(home, rooms, 'n', 312, 14, 200, 300);
    expect(r).toEqual({ x: 300, y: 0, snapped: true, overlaps: [] });
  });

  it('snaps at exactly 20 cm and leaves anything further alone', () => {
    const { home, rooms } = base();
    expect(snapRoomPlacement(home, rooms, 'n', 320, 400, 200, 300)).toMatchObject({ x: 300, y: 400, snapped: true });
    const far = snapRoomPlacement(home, rooms, 'n', 321, 400, 200, 300);
    expect(far).toEqual({ x: 321, y: 400, snapped: false, overlaps: [] });
  });

  it('reports overlapping rooms but treats touching as clear', () => {
    const { home, rooms } = base();
    expect(snapRoomPlacement(home, rooms, 'n', 300, 0, 200, 300).overlaps).toEqual([]);
    // 150 cm to the right of the origin puts half of n inside a, too far away to snap out of it.
    expect(snapRoomPlacement(home, rooms, 'n', 150, 50, 200, 300).overlaps).toEqual(['a']);
  });

  it('ignores the room being moved, so a placed room can be nudged in place', () => {
    const rooms = { a: room('a', 300, 400) };
    const home: Home = { id: 'h', name: 'Solo', rooms: [{ roomId: 'a', x: 0, y: 0 }], doorways: [] };
    expect(snapRoomPlacement(home, rooms, 'a', 40, 60, 300, 400)).toEqual({ x: 40, y: 60, snapped: false, overlaps: [] });
  });
});

describe('doorwayOpenings', () => {
  it('mirrors the offset across a vertical wall and builds both openings', () => {
    const rooms = { a: room('a', 300, 400), b: room('b', 200, 400) };
    const home: Home = {
      id: 'h', name: 'Pair', doorways: [],
      rooms: [{ roomId: 'a', x: 0, y: 0 }, { roomId: 'b', x: 300, y: 50 }],
    };
    const r = doorwayOpenings(home, rooms, { roomId: 'a', wall: 'right', offset: 100, width: 80, kind: 'door' });
    if (!r.ok) throw new Error(r.error);
    expect(r.doorway).toMatchObject({
      a: { roomId: 'a', wall: 'right', offset: 100 },
      b: { roomId: 'b', wall: 'left', offset: 50 },
      width: 80, kind: 'door',
    });
    expect(r.a).toEqual({ id: `door_${r.doorway.id}_a`, kind: 'door', wall: 'right', offset: 100, width: 80, height: 200, swing: 'in', doorwayId: r.doorway.id });
    expect(r.b).toEqual({ id: `door_${r.doorway.id}_b`, kind: 'door', wall: 'left', offset: 50, width: 80, height: 200, swing: 'out', doorwayId: r.doorway.id });
  });

  it('mirrors the offset across a horizontal wall', () => {
    const rooms = { a: room('a', 300, 400), c: room('c', 300, 200) };
    const home: Home = {
      id: 'h', name: 'Stack', doorways: [],
      rooms: [{ roomId: 'a', x: 0, y: 0 }, { roomId: 'c', x: -40, y: 400 }],
    };
    const r = doorwayOpenings(home, rooms, { roomId: 'a', wall: 'bottom', offset: 60, width: 80, kind: 'passage' });
    if (!r.ok) throw new Error(r.error);
    expect(r.doorway.b).toEqual({ roomId: 'c', wall: 'top', offset: 100 });
    // A passage has no leaf, so neither side swings into the room.
    expect(r.a.swing).toBe('out');
    expect(r.b.swing).toBe('out');
  });

  it('refuses a doorway that runs past the shared part of the wall', () => {
    const rooms = { a: room('a', 300, 400), b: room('b', 200, 400) };
    const home: Home = {
      id: 'h', name: 'Pair', doorways: [],
      rooms: [{ roomId: 'a', x: 0, y: 0 }, { roomId: 'b', x: 300, y: 250 }],
    };
    const r = doorwayOpenings(home, rooms, { roomId: 'a', wall: 'right', offset: 200, width: 80, kind: 'door' });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.hint).toContain('250');
    expect(r.hint).toContain('400');
  });

  it('refuses a wall no other room is behind, and an unplaced room', () => {
    const { home, rooms } = grid();
    const wall = doorwayOpenings(home, rooms, { roomId: 'a', wall: 'top', offset: 10, width: 80, kind: 'door' });
    expect(wall).toMatchObject({ ok: false });
    const missing = doorwayOpenings(home, rooms, { roomId: 'zz', wall: 'top', offset: 10, width: 80, kind: 'door' });
    expect(missing).toMatchObject({ ok: false });
  });

  it('honours an explicit other room and refuses one that is not behind that wall', () => {
    const { home, rooms } = grid();
    const ok = doorwayOpenings(home, rooms, { roomId: 'a', wall: 'right', offset: 100, width: 80, kind: 'door', otherRoomId: 'b' });
    expect(ok.ok).toBe(true);
    const wrong = doorwayOpenings(home, rooms, { roomId: 'a', wall: 'right', offset: 100, width: 80, kind: 'door', otherRoomId: 'c' });
    expect(wrong).toMatchObject({ ok: false });
  });
});

describe('homeReachability and totals', () => {
  function withDoorway(): { home: Home; rooms: Record<string, Room> } {
    const { home, rooms } = grid();
    const r = doorwayOpenings(home, rooms, { roomId: 'a', wall: 'right', offset: 100, width: 80, kind: 'door' });
    if (!r.ok) throw new Error(r.error);
    const a = rooms.a!;
    const b = rooms.b!;
    rooms.a = { ...a, openings: [...a.openings, r.a] };
    rooms.b = { ...b, openings: [...b.openings, r.b] };
    return { home: { ...home, doorways: [r.doorway] }, rooms };
  }

  it('walks the doorways from the room with an external door and reports the rest', () => {
    const { home, rooms } = withDoorway();
    expect(homeReachability(home, rooms)).toEqual({ entranceRoomId: 'a', unreachable: ['c'] });
  });

  it('prefers a named entrance and falls back to the first room when nothing else says', () => {
    const { home, rooms } = withDoorway();
    expect(homeReachability({ ...home, entranceRoomId: 'b' }, rooms).entranceRoomId).toBe('b');
    // A room named as the entrance but no longer on the plan does not win.
    expect(homeReachability({ ...home, entranceRoomId: 'gone' }, rooms).entranceRoomId).toBe('a');
    const a = rooms.a!;
    const doorless = { ...rooms, a: { ...a, openings: a.openings.filter((o) => o.id !== 'ext') } };
    expect(homeReachability(home, doorless).entranceRoomId).toBe('a');
    expect(homeReachability({ id: 'e', name: 'Empty', rooms: [], doorways: [] }, {})).toEqual({ entranceRoomId: null, unreachable: [] });
  });

  it('sums area, budget, spend and item count across the home', () => {
    const { home, rooms } = grid();
    const a = rooms.a!;
    rooms.a = { ...a, brief: { ...a.brief, budget: 1500 } };
    expect(homeTotals(home, rooms)).toEqual({ areaM2: 26, budget: 3500, budgetUsed: 0, items: 0, rooms: 3 });
  });

  it('finds the home a room belongs to', () => {
    const { home } = grid();
    expect(homeContaining({ h1: home }, 'b')?.id).toBe('h1');
    expect(homeContaining({ h1: home }, 'zz')).toBeNull();
  });
});
