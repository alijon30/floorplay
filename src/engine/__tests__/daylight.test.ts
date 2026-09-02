import { describe, it, expect } from 'vitest';
import { makeDemoRoom } from '../rooms';
import { placeTest } from '../validate';
import { sunAzimuth, windowIntensity, computeDaylight, bestSpots } from '../daylight';
import { cellIndex, gridDims } from '../grid';
import type { Opening } from '../types';

const win = (wall: Opening['wall']): Opening => ({ id: 'w', kind: 'window', wall, offset: 100, width: 100, height: 120, sill: 90 });

describe('sun', () => {
  it('moves east to west', () => {
    expect(sunAzimuth(6)).toBe(90);
    expect(sunAzimuth(12)).toBe(180);
    expect(sunAzimuth(18)).toBe(270);
    expect(sunAzimuth(21)).toBeNull();
  });

  it('lights windows facing the sun', () => {
    const room = makeDemoRoom();
    expect(windowIntensity(room, win('right'), 9)).toBeGreaterThan(0.6);
    expect(windowIntensity(room, win('left'), 9)).toBe(0);
    expect(windowIntensity(room, win('bottom'), 12)).toBeCloseTo(1, 2);
    expect(windowIntensity(room, win('bottom'), 22)).toBe(0);
  });
});

describe('computeDaylight', () => {
  it('is brighter near the east window in the morning', () => {
    const room = makeDemoRoom();
    const d = computeDaylight(room, 9);
    const { cols, rows } = gridDims(room);
    const near = d.grid[cellIndex(330, 260, cols, rows)!]!;
    const far = d.grid[cellIndex(20, 20, cols, rows)!]!;
    expect(near).toBeGreaterThan(0.6);
    expect(far).toBeLessThan(near);
  });

  it('is blocked by a wardrobe but not by a rug', () => {
    const room = makeDemoRoom();
    const { cols, rows } = gridDims(room);
    const probe = cellIndex(150, 260, cols, rows)!;
    room.items = [placeTest(room, 'wardrobe-100', 250, 260, 90, 'w')];
    expect(computeDaylight(room, 9).grid[probe]).toBe(0);
    room.items = [placeTest(room, 'rug-160x230', 250, 260, 0, 'r')];
    expect(computeDaylight(room, 9).grid[probe]).toBeGreaterThan(0);
  });

  it('scores items and finds bright free spots', () => {
    const room = makeDemoRoom();
    room.items = [placeTest(room, 'desk-120', 300, 260, 90, 'd')];
    const d = computeDaylight(room, 9);
    expect(d.lightByItem['d']).toBeGreaterThan(0.5);
    const spots = bestSpots(room, 9, 3);
    expect(spots).toHaveLength(3);
    expect(spots[0]!.light).toBeGreaterThanOrEqual(spots[1]!.light);
    expect(spots[0]!.x).toBeGreaterThan(200);
  });
});
