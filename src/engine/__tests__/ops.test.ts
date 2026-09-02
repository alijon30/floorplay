import { describe, it, expect } from 'vitest';
import { makeDemoRoom } from '../rooms';
import { placeTest } from '../validate';
import { applyOps, describeOps } from '../ops';
import { nearestValid } from '../nearest';
import { evaluateOps } from '../evaluate';
import type { Op } from '../types';

describe('applyOps', () => {
  it('applies a sequence and its inverse restores the original', () => {
    const room = makeDemoRoom();
    const ops: Op[] = [
      { type: 'place', item: placeTest(room, 'desk-120', 60, 30, 0, 'a') },
      { type: 'place', item: placeTest(room, 'chair-office', 60, 110, 0, 'b') },
      { type: 'move', id: 'a', x: 200, y: 30, rotation: 0 },
      { type: 'swap', id: 'b', catalogId: 'chair-dining' },
      { type: 'setLocked', id: 'a', locked: true },
      { type: 'setBrief', brief: { budget: 500, currency: 'USD', needs: ['sleep'], notes: '' } },
      { type: 'addOpening', opening: { id: 'w2', kind: 'window', wall: 'top', offset: 100, width: 80, height: 100, sill: 100 } },
      { type: 'addCatalogItem', item: { id: 'agent-lamp', name: 'Paper lamp', category: 'lamp', width: 30, depth: 30, height: 150, price: 25, color: '#fff', shape: 'lamp', clearance: {}, blocksLight: false, source: 'agent' } },
      { type: 'setShell', width: 400, depth: 520, height: 260, northWall: 'left' },
    ];
    const r = applyOps(room, ops);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.room.items.find((i) => i.id === 'a')).toMatchObject({ x: 200, locked: true });
    expect(r.room.items.find((i) => i.id === 'b')?.catalogId).toBe('chair-dining');
    expect(r.room.width).toBe(400);
    expect(room.items).toEqual([]);
    const back = applyOps(r.room, r.inverse);
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    expect(back.room).toEqual(room);
    const again = applyOps(back.room, back.inverse);
    expect(again.ok).toBe(true);
    if (again.ok) expect(again.room).toEqual(r.room);
  });

  it('restores array order on undo of a mid-array removal', () => {
    const room = makeDemoRoom();
    const placed = applyOps(room, [
      { type: 'place', item: placeTest(room, 'chair-dining', 60, 60, 0, 'a') },
      { type: 'place', item: placeTest(room, 'chair-dining', 160, 60, 0, 'b') },
      { type: 'place', item: placeTest(room, 'chair-dining', 260, 60, 0, 'c') },
    ]);
    expect(placed.ok).toBe(true);
    if (!placed.ok) return;
    const removed = applyOps(placed.room, [{ type: 'remove', id: 'b' }]);
    expect(removed.ok).toBe(true);
    if (!removed.ok) return;
    expect(removed.room.items.map((i) => i.id)).toEqual(['a', 'c']);
    const undone = applyOps(removed.room, removed.inverse);
    expect(undone.ok).toBe(true);
    if (!undone.ok) return;
    expect(undone.room.items.map((i) => i.id)).toEqual(['a', 'b', 'c']);
    expect(undone.room).toEqual(placed.room);

    const openingGone = applyOps(room, [{ type: 'removeOpening', id: 'door-main' }]);
    expect(openingGone.ok).toBe(true);
    if (!openingGone.ok) return;
    expect(openingGone.room.openings.map((o) => o.id)).toEqual(['window-east']);
    const openingBack = applyOps(openingGone.room, openingGone.inverse);
    expect(openingBack.ok).toBe(true);
    if (!openingBack.ok) return;
    expect(openingBack.room.openings.map((o) => o.id)).toEqual(['door-main', 'window-east']);
    expect(openingBack.room).toEqual(room);
  });

  it('undo of placing a locked item', () => {
    const room = makeDemoRoom();
    const r = applyOps(room, [{ type: 'place', item: { ...placeTest(room, 'desk-120', 60, 30, 0, 'a'), locked: true } }]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.room.items).toHaveLength(1);
    const back = applyOps(r.room, r.inverse);
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    expect(back.room.items).toHaveLength(0);
    expect(back.room).toEqual(room);
  });

  it('refuses to move, remove, or swap a locked item', () => {
    const room = makeDemoRoom();
    room.items = [{ ...placeTest(room, 'desk-120', 60, 30, 0, 'a'), locked: true }];
    expect(applyOps(room, [{ type: 'move', id: 'a', x: 100, y: 100, rotation: 0 }])).toMatchObject({ ok: false, error: 'locked', itemId: 'a' });
    expect(applyOps(room, [{ type: 'remove', id: 'a' }])).toMatchObject({ ok: false, error: 'locked' });
    expect(applyOps(room, [{ type: 'swap', id: 'a', catalogId: 'desk-100' }])).toMatchObject({ ok: false, error: 'locked' });
    expect(applyOps(room, [{ type: 'setLocked', id: 'a', locked: false }]).ok).toBe(true);
  });

  it('reports not_found and invalid', () => {
    const room = makeDemoRoom();
    expect(applyOps(room, [{ type: 'move', id: 'zz', x: 0, y: 0, rotation: 0 }])).toMatchObject({ ok: false, error: 'not_found' });
    expect(applyOps(room, [{ type: 'place', item: { id: 'x', catalogId: 'nope', x: 0, y: 0, rotation: 0, locked: false } }])).toMatchObject({ ok: false, error: 'invalid' });
    expect(applyOps(room, [{ type: 'setShell', width: 0, depth: 100, height: 100, northWall: 'top' }])).toMatchObject({ ok: false, error: 'invalid' });
  });

  it('summarises ops', () => {
    const room = makeDemoRoom();
    expect(describeOps(room, [{ type: 'place', item: placeTest(room, 'desk-120', 60, 30, 0, 'a') }])).toBe('Placed Desk 120 at (60, 30)');
  });
});

describe('nearestValid', () => {
  it('returns the same point when valid and the nearest free point otherwise', () => {
    const room = makeDemoRoom();
    expect(nearestValid(room, 'desk-120', 60, 30, 0)).toEqual({ x: 60, y: 30 });
    expect(nearestValid(room, 'desk-120', 30, 30, 0)).toEqual({ x: 60, y: 60 });
  });
});

describe('evaluateOps', () => {
  it('returns an analysis without mutating the room', () => {
    const room = makeDemoRoom();
    const r = evaluateOps(room, [{ type: 'place', item: placeTest(room, 'bed-queen-160', 80, 300, 0, 'bed') }]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.analysis.metrics.budgetUsed).toBe(499);
    expect(room.items).toHaveLength(0);
  });
});
