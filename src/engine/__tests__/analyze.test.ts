import { describe, it, expect } from 'vitest';
import { makeDemoRoom } from '../rooms';
import { placeTest } from '../validate';
import { analyze, metricsDelta } from '../analyze';

describe('analyze', () => {
  it('describes the empty demo room', () => {
    const a = analyze(makeDemoRoom());
    expect(a.metrics).toMatchObject({ freeFloorPct: 100, openAreaCm2: 187200, minWalkwayCm: 120, budgetUsed: 0, budgetRemaining: 1200, violationCount: 0 });
    expect(a.violations).toEqual([]);
    expect(a.daylight.cols).toBe(36);
  });

  it('accounts for a placed bed', () => {
    const room = makeDemoRoom();
    room.items = [placeTest(room, 'bed-queen-160', 80, 300, 0, 'bed')];
    const a = analyze(room);
    expect(a.metrics.freeFloorPct).toBe(83);
    expect(a.metrics.budgetUsed).toBe(499);
    expect(a.metrics.lightByItem['bed']).toBeGreaterThanOrEqual(0);
    expect(a.metrics.violationCount).toBe(0);
  });

  it('gives up no floor to a mounted mirror', () => {
    const empty = analyze(makeDemoRoom());
    const room = makeDemoRoom();
    room.items = [placeTest(room, 'mirror-rect-80', 180, 2.5, 0, 'm')];
    const a = analyze(room);
    expect(a.metrics.freeFloorPct).toBe(100);
    expect(a.metrics.openAreaCm2).toBe(empty.metrics.openAreaCm2);
    expect(a.metrics.minWalkwayCm).toBe(120);
    expect(a.metrics.budgetUsed).toBe(129);
    expect(a.violations).toEqual([]);
  });

  it('computes a delta only for changed numbers', () => {
    const before = analyze(makeDemoRoom()).metrics;
    const room = makeDemoRoom();
    room.items = [placeTest(room, 'bed-queen-160', 80, 300, 0, 'bed')];
    const after = analyze(room).metrics;
    const delta = metricsDelta(before, after);
    expect(delta.freeFloorPct).toEqual({ before: 100, after: 83 });
    expect(delta.budgetUsed).toEqual({ before: 0, after: 499 });
    expect(delta.minWalkwayCm).toBeUndefined();
  });
});
