import { describe, it, expect } from 'vitest';
import { makeDemoRoom } from '../rooms';
import { placeTest } from '../validate';
import { applyOps, describeOps, openingFits } from '../ops';
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
      { type: 'addCatalogItem', item: { id: 'agent-lamp', name: 'Paper lamp', category: 'lamp', width: 30, depth: 30, height: 150, price: 25, color: '#fff', shape: 'lamp', clearance: {}, blocksLight: false, source: 'agent', rooms: ['living'] } },
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

  it('recolors an item and repaints the room, both exactly reversible', () => {
    const start = makeDemoRoom();
    const placed = applyOps(start, [{ type: 'place', item: placeTest(start, 'sofa-2', 180, 45, 0, 's') }]);
    expect(placed.ok).toBe(true);
    if (!placed.ok) return;
    const base = placed.room;
    expect(base.finish).toEqual({ wall: '#efe9df', floor: 'oak' });

    const r = applyOps(base, [
      { type: 'recolor', id: 's', color: '#8c9a7a' },
      { type: 'recolor', id: 's', color: '#4a4f57' },
      { type: 'setFinish', finish: { wall: '#d8d2c4', floor: 'walnut' } },
    ]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.room.items[0]!.color).toBe('#4a4f57');
    expect(r.room.finish).toEqual({ wall: '#d8d2c4', floor: 'walnut' });
    expect(base.items[0]).not.toHaveProperty('color');

    const back = applyOps(r.room, r.inverse);
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    // An undone recolor leaves no leftover key, so the item is the one that was there before.
    expect(Object.hasOwn(back.room.items[0]!, 'color')).toBe(false);
    expect(back.room).toEqual(base);
    const again = applyOps(back.room, back.inverse);
    expect(again.ok).toBe(true);
    if (again.ok) expect(again.room).toEqual(r.room);

    const cleared = applyOps(r.room, [{ type: 'recolor', id: 's', color: null }]);
    expect(cleared.ok).toBe(true);
    if (!cleared.ok) return;
    expect(Object.hasOwn(cleared.room.items[0]!, 'color')).toBe(false);
    const restored = applyOps(cleared.room, cleared.inverse);
    expect(restored.ok).toBe(true);
    if (restored.ok) expect(restored.room.items[0]!.color).toBe('#4a4f57');
  });

  it('rejects a color that is not hex and an unknown item or floor', () => {
    const room = makeDemoRoom();
    room.items = [placeTest(room, 'sofa-2', 180, 45, 0, 's')];
    expect(applyOps(room, [{ type: 'recolor', id: 's', color: 'sage' }])).toMatchObject({ ok: false, error: 'invalid' });
    expect(applyOps(room, [{ type: 'recolor', id: 'zz', color: null }])).toMatchObject({ ok: false, error: 'not_found' });
    expect(applyOps(room, [{ type: 'setFinish', finish: { wall: 'white', floor: 'oak' } }])).toMatchObject({ ok: false, error: 'invalid' });
    expect(applyOps(room, [{ type: 'setFinish', finish: { wall: '#fff', floor: 'lino' as 'oak' } }])).toMatchObject({ ok: false, error: 'invalid' });
    // A locked item keeps its place, not its finish, so it can still be recolored.
    room.items = [{ ...room.items[0]!, locked: true }];
    expect(applyOps(room, [{ type: 'recolor', id: 's', color: '#8c9a7a' }]).ok).toBe(true);
  });

  it('summarises ops', () => {
    const room = makeDemoRoom();
    expect(describeOps(room, [{ type: 'place', item: placeTest(room, 'desk-120', 60, 30, 0, 'a') }])).toBe('Placed Desk 120 at (60, 30)');
    room.items = [placeTest(room, 'sofa-2', 180, 45, 0, 's')];
    expect(describeOps(room, [{ type: 'recolor', id: 's', color: '#8c9a7a' }])).toBe('Recolored Two-seat sofa to #8c9a7a');
    expect(describeOps(room, [{ type: 'recolor', id: 's', color: null }])).toBe('Reset the color of Two-seat sofa');
    expect(describeOps(room, [{ type: 'setFinish', finish: { wall: '#d8d2c4', floor: 'walnut' } }])).toBe('Finish set to walnut floor and #d8d2c4 walls');
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

describe('moveOpening', () => {
  it('slides a window along its wall, and the inverse puts it back', () => {
    const room = makeDemoRoom();
    const win = room.openings.find((o) => o.kind === 'window')!;
    const r = applyOps(room, [{ type: 'moveOpening', id: win.id, wall: win.wall, offset: win.offset + 40 }]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.room.openings.find((o) => o.id === win.id)).toMatchObject({ wall: win.wall, offset: win.offset + 40, width: win.width });
    const back = applyOps(r.room, r.inverse);
    expect(back.ok && back.room.openings).toEqual(room.openings);
    expect(describeOps(room, [{ type: 'moveOpening', id: win.id, wall: win.wall, offset: 200 }])).toBe(`Moved window to 200 cm on the ${win.wall} wall`);
  });

  it('carries a window to another wall', () => {
    const room = makeDemoRoom();
    const win = room.openings.find((o) => o.kind === 'window')!;
    const other = win.wall === 'top' ? 'bottom' : 'top';
    const r = applyOps(room, [{ type: 'moveOpening', id: win.id, wall: other, offset: 10 }]);
    expect(r.ok, JSON.stringify(r)).toBe(true);
  });

  it('refuses to run past the end of the wall or through another opening', () => {
    const room = makeDemoRoom();
    const win = room.openings.find((o) => o.kind === 'window')!;
    const length = win.wall === 'top' || win.wall === 'bottom' ? room.width : room.depth;
    const off = applyOps(room, [{ type: 'moveOpening', id: win.id, wall: win.wall, offset: length - win.width + 1 }]);
    expect(off.ok).toBe(false);
    if (!off.ok) expect(off.message).toMatch(/past the end/);
    const door = room.openings.find((o) => o.kind === 'door')!;
    const clash = applyOps(room, [{ type: 'moveOpening', id: win.id, wall: door.wall, offset: door.offset }]);
    expect(clash.ok).toBe(false);
    if (!clash.ok) expect(clash.message).toMatch(/overlap the door/);
    expect(openingFits(room, win).ok).toBe(true);
  });

  it('leaves a doorway half where it is', () => {
    const room = makeDemoRoom();
    const door = room.openings.find((o) => o.kind === 'door')!;
    const joined = { ...room, openings: room.openings.map((o) => (o.id === door.id ? { ...o, doorwayId: 'dw1' } : o)) };
    const r = applyOps(joined, [{ type: 'moveOpening', id: door.id, wall: door.wall, offset: door.offset + 20 }]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/Home plan/);
  });
});
