import { describe, it, expect } from 'vitest';
import { makeDemoRoom } from '../rooms';
import { placeTest, validateRoom } from '../validate';
import { reachability } from '../reach';
import { gridDims, rectCells, occupancy, dilate, flood, largestFreeRegion } from '../grid';

describe('grid', () => {
  it('sizes the grid and maps rects to cells', () => {
    const room = makeDemoRoom();
    expect(gridDims(room)).toEqual({ cols: 36, rows: 52 });
    expect(rectCells({ x: 0, y: 0, w: 100, h: 10 }, 36, 52)).toHaveLength(10);
    expect(rectCells({ x: 5, y: 0, w: 100, h: 10 }, 36, 52)).toHaveLength(11);
  });

  it('dilates and floods', () => {
    const occ = new Uint8Array(25);
    occ[12] = 1;
    const d = dilate(occ, 5, 5, 1);
    expect(Array.from(d).filter(Boolean)).toHaveLength(9);
    const reached = flood(d, 5, 5, 0);
    expect(reached[0]).toBe(1);
    expect(reached[4]).toBe(1);
    expect(reached[12]).toBe(0);
    expect(largestFreeRegion(occ, 5, 5)).toBe(24);
  });
});

describe('reachability', () => {
  it('reports everything reachable in an empty room', () => {
    expect(reachability(makeDemoRoom())).toEqual({ unreachable: [], minWalkwayCm: 120, hasDoor: true });
  });

  it('marks items unreachable when a wardrobe blocks the door', () => {
    const room = makeDemoRoom();
    room.items = [placeTest(room, 'wardrobe-100', 60, 470, 180, 'w'), placeTest(room, 'desk-120', 200, 100, 0, 'd')];
    const r = reachability(room);
    expect(r.unreachable).toContain('d');
    expect(r.minWalkwayCm).toBe(0);
    expect(validateRoom(room).some((v) => v.kind === 'unreachable' && v.itemIds[0] === 'd')).toBe(true);
  });

  it('measures a 60 cm corridor as a 40 cm walkway and flags what is behind it', () => {
    const room = makeDemoRoom();
    room.items = [
      placeTest(room, 'wardrobe-150', 75, 300, 0, 'a'),
      placeTest(room, 'wardrobe-150', 285, 300, 0, 'b'),
      placeTest(room, 'desk-120', 180, 100, 0, 'd'),
    ];
    const r = reachability(room);
    expect(r.unreachable).toEqual(['d']);
    expect(r.minWalkwayCm).toBe(40);
  });

  it('treats a room without a door as fully reachable', () => {
    const room = makeDemoRoom();
    room.openings = room.openings.filter((o) => o.kind !== 'door');
    room.items = [placeTest(room, 'desk-120', 180, 100, 0, 'd')];
    expect(reachability(room)).toEqual({ unreachable: [], minWalkwayCm: 120, hasDoor: false });
  });
});
