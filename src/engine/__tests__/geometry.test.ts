import { describe, it, expect } from 'vitest';
import type { CatalogItem, PlacedItem, RoomShell, Opening } from '../types';
import {
  rotatedDims, footprint, intersects, intersection, containsRect, expandRect,
  clearanceGroups, openingSpan, doorZones, doorInsidePoint, wallFacing, frontVector,
} from '../geometry';

const desk: CatalogItem = {
  id: 'desk', name: 'Desk', category: 'desk', width: 120, depth: 60, height: 75, price: 100,
  color: '#ccc', shape: 'desk', clearance: { front: 90 }, blocksLight: false, source: 'seed', rooms: ['office'],
};
const bed: CatalogItem = { ...desk, id: 'bed', name: 'Bed', category: 'bed', width: 160, depth: 200, clearance: { anyLongSide: 60 } };
const shell: RoomShell = { width: 360, depth: 520, height: 260, northWall: 'top' };
const place = (cat: CatalogItem, x: number, y: number, rotation: 0 | 90 | 180 | 270 = 0): PlacedItem =>
  ({ id: `p_${cat.id}`, catalogId: cat.id, x, y, rotation, locked: false });

describe('geometry', () => {
  it('rotates dimensions', () => {
    expect(rotatedDims(desk, 0)).toEqual({ w: 120, h: 60 });
    expect(rotatedDims(desk, 90)).toEqual({ w: 60, h: 120 });
    expect(rotatedDims(desk, 180)).toEqual({ w: 120, h: 60 });
  });

  it('computes center-based footprints', () => {
    expect(footprint(place(desk, 100, 100), desk)).toEqual({ x: 40, y: 70, w: 120, h: 60 });
    expect(footprint(place(desk, 100, 100, 90), desk)).toEqual({ x: 70, y: 40, w: 60, h: 120 });
  });

  it('treats touching edges as not intersecting', () => {
    expect(intersects({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 0, w: 10, h: 10 })).toBe(false);
    expect(intersects({ x: 0, y: 0, w: 10, h: 10 }, { x: 9, y: 9, w: 10, h: 10 })).toBe(true);
    expect(intersection({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5, w: 10, h: 10 })).toEqual({ x: 5, y: 5, w: 5, h: 5 });
    expect(intersection({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 0, w: 10, h: 10 })).toBeNull();
    expect(containsRect({ x: 0, y: 0, w: 100, h: 100 }, { x: 10, y: 10, w: 20, h: 20 })).toBe(true);
    expect(containsRect({ x: 0, y: 0, w: 100, h: 100 }, { x: 90, y: 10, w: 20, h: 20 })).toBe(false);
    expect(expandRect({ x: 10, y: 10, w: 10, h: 10 }, 5)).toEqual({ x: 5, y: 5, w: 20, h: 20 });
  });

  it('places front clearance below the item at rotation 0 and to the left at 90', () => {
    const g0 = clearanceGroups(place(desk, 100, 100), desk);
    expect(g0).toEqual([{ label: 'front', mode: 'all', cm: 90, rects: [{ x: 40, y: 130, w: 120, h: 90 }] }]);
    const g90 = clearanceGroups(place(desk, 100, 100, 90), desk);
    expect(g90[0]!.rects[0]).toEqual({ x: -20, y: 40, w: 90, h: 120 });
  });

  it('puts left clearance on the -x side and back clearance on the -y side', () => {
    const shelf: CatalogItem = {
      ...desk, id: 'shelf', name: 'Shelf', category: 'shelf', width: 80, depth: 40,
      clearance: { left: 30, back: 20 },
    };
    // Item spans x 60..140, y 80..120 at rotation 0.
    const g0 = clearanceGroups(place(shelf, 100, 100), shelf);
    expect(g0.map((g) => g.label)).toEqual(['back', 'left']);
    // back hugs the item's -y edge, as wide as the item.
    expect(g0[0]!).toEqual({ label: 'back', mode: 'all', cm: 20, rects: [{ x: 60, y: 60, w: 80, h: 20 }] });
    // left hugs the item's -x edge, as deep as the item.
    expect(g0[1]!).toEqual({ label: 'left', mode: 'all', cm: 30, rects: [{ x: 30, y: 80, w: 30, h: 40 }] });

    // At 90 the item spans x 80..120, y 60..140, and the front (+y) swings to -x,
    // so back (-y) lands on +x and left (-x) lands on -y.
    const g90 = clearanceGroups(place(shelf, 100, 100, 90), shelf);
    expect(g90[0]!.rects[0]).toEqual({ x: 120, y: 60, w: 20, h: 80 });
    expect(g90[1]!.rects[0]).toEqual({ x: 80, y: 30, w: 40, h: 30 });
  });

  it('builds an any-long-side group for beds', () => {
    const g = clearanceGroups(place(bed, 100, 200), bed);
    expect(g[0]!.mode).toBe('any');
    expect(g[0]!.rects).toHaveLength(2);
    expect(g[0]!.rects[0]).toEqual({ x: -40, y: 100, w: 60, h: 200 });
    expect(g[0]!.rects[1]).toEqual({ x: 180, y: 100, w: 60, h: 200 });
  });

  it('spans openings on each wall', () => {
    const o = (wall: Opening['wall']): Opening => ({ id: 'o', kind: 'door', wall, offset: 20, width: 80, height: 200 });
    expect(openingSpan(shell, o('top'), 60)).toEqual({ x: 20, y: 0, w: 80, h: 60 });
    expect(openingSpan(shell, o('bottom'), 60)).toEqual({ x: 20, y: 460, w: 80, h: 60 });
    expect(openingSpan(shell, o('left'), 60)).toEqual({ x: 0, y: 20, w: 60, h: 80 });
    expect(openingSpan(shell, o('right'), 60)).toEqual({ x: 300, y: 20, w: 60, h: 80 });
  });

  it('computes door zones and inside point', () => {
    const door: Opening = { id: 'd', kind: 'door', wall: 'bottom', offset: 20, width: 80, height: 200, swing: 'in', hinge: 'start' };
    expect(doorZones(shell, door)).toEqual({ swing: { x: 20, y: 440, w: 80, h: 80 }, approach: { x: 20, y: 460, w: 80, h: 60 } });
    expect(doorZones(shell, { ...door, swing: 'out' }).swing).toBeNull();
    expect(doorInsidePoint(shell, door)).toEqual({ x: 60, y: 505 });
  });

  it('computes wall facing and front vectors', () => {
    expect(wallFacing('top', 'top')).toBe(0);
    expect(wallFacing('right', 'top')).toBe(90);
    expect(wallFacing('bottom', 'top')).toBe(180);
    expect(wallFacing('left', 'top')).toBe(270);
    expect(wallFacing('top', 'right')).toBe(270);
    expect(frontVector(0)).toEqual({ dx: 0, dy: 1 });
    expect(frontVector(90)).toEqual({ dx: -1, dy: 0 });
    expect(frontVector(180)).toEqual({ dx: 0, dy: -1 });
    expect(frontVector(270)).toEqual({ dx: 1, dy: 0 });
  });
});
