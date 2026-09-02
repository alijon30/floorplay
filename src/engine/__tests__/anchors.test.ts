// src/engine/__tests__/anchors.test.ts
import { describe, it, expect } from 'vitest';
import { makeDemoRoom } from '../rooms';
import { placeTest, itemViolations } from '../validate';
import { orientToWall, snapToWall, suggestPositions } from '../anchors';
import { BLOCKING_KINDS } from '../nearest';

describe('orientToWall', () => {
  it('faces the room', () => {
    expect([orientToWall('top'), orientToWall('right'), orientToWall('bottom'), orientToWall('left')]).toEqual([0, 90, 180, 270]);
  });
});

describe('snapToWall', () => {
  it('snaps a desk flush to the top wall and orients it', () => {
    const room = makeDemoRoom();
    const r = snapToWall(room, 'desk-120', 100, 42, 90);
    expect(r).toMatchObject({ snapped: true, wall: 'top', rotation: 0, x: 100, y: 30 });
  });
  it('does not snap beyond 15 cm', () => {
    const room = makeDemoRoom();
    expect(snapToWall(room, 'desk-120', 100, 60, 0)).toMatchObject({ snapped: false, x: 100, y: 60, rotation: 0 });
  });
  it('keeps free-standing rotation', () => {
    const room = makeDemoRoom();
    const r = snapToWall(room, 'table-coffee-90', 350, 300, 90);
    expect(r.snapped).toBe(true);
    expect(r.rotation).toBe(90);
    expect(r.x).toBe(335);
  });
});

describe('suggestPositions', () => {
  it('returns wall-backed, valid, deterministic suggestions for a bed', () => {
    const room = makeDemoRoom();
    const a = suggestPositions(room, 'bed-queen-160');
    const b = suggestPositions(room, 'bed-queen-160');
    expect(a).toEqual(b);
    expect(a.length).toBe(5);
    for (const s of a) {
      const probe = placeTest(room, 'bed-queen-160', s.x, s.y, s.rotation, '__probe');
      expect(itemViolations(room, probe).filter((v) => BLOCKING_KINDS.has(v.kind))).toEqual([]);
      expect(s.reason).toMatch(/wall|corner/);
    }
    expect(a[0]!.score).toBeGreaterThanOrEqual(a[4]!.score);
  });
  it('prefers light for a desk and avoids occupied space', () => {
    const room = makeDemoRoom();
    room.items = [placeTest(room, 'wardrobe-150', 75, 30, 0, 'w')];
    const s = suggestPositions(room, 'desk-120', { hour: 9 });
    expect(s[0]!.light).toBeGreaterThan(0.3);
    expect(s.some((p) => p.reason.includes('right wall'))).toBe(true);
    for (const p of s) expect(itemViolations(room, placeTest(room, 'desk-120', p.x, p.y, p.rotation, '__probe')).filter((v) => BLOCKING_KINDS.has(v.kind))).toEqual([]);
  });
  it('honours near=window and near=door', () => {
    const room = makeDemoRoom();
    const win = suggestPositions(room, 'nightstand-45', { near: 'window', count: 3 });
    expect(win.every((s) => s.x > 250)).toBe(true);
    const door = suggestPositions(room, 'plant-medium', { near: 'door', count: 3 });
    expect(door.every((s) => s.y > 380)).toBe(true);
  });
  it('offers free-standing spots for a rug and none for a wardrobe', () => {
    const room = makeDemoRoom();
    expect(suggestPositions(room, 'rug-160x230').some((s) => s.reason.startsWith('free-standing'))).toBe(true);
    expect(suggestPositions(room, 'wardrobe-100').every((s) => !s.reason.startsWith('free-standing'))).toBe(true);
  });
});
