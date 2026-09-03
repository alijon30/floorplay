import { describe, it, expect } from 'vitest';
import { makeDemoRoom } from '../rooms';
import { placeTest } from '../validate';
import { applyOps } from '../ops';
import { findCatalogItem } from '../catalog';
import { shoppingList, shoppingListText } from '../shopping';
import type { Op, Room } from '../types';

/** A room with nothing in it, so a test's own placements are the whole list. */
function emptyRoom(): Room {
  const room = makeDemoRoom();
  return { ...room, items: [] };
}

function place(room: Room, catalogId: string, x: number, y: number, id: string): Op {
  return { type: 'place', item: placeTest(room, catalogId, x, y, 0, id) };
}

describe('shoppingList', () => {
  it('groups placements by catalog id and counts them as one line', () => {
    const base = emptyRoom();
    const r = applyOps(base, [
      place(base, 'chair-dining', 100, 100, 'c1'),
      place(base, 'chair-dining', 160, 100, 'c2'),
      place(base, 'desk-120', 100, 300, 'd1'),
    ]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const list = shoppingList(r.room);
    expect(list.lines).toHaveLength(2);
    const chairs = list.lines.find((l) => l.catalogId === 'chair-dining')!;
    const chairPrice = findCatalogItem(r.room, 'chair-dining')!.price;
    expect(chairs.qty).toBe(2);
    expect(chairs.unitPrice).toBe(chairPrice);
    expect(chairs.lineTotal).toBe(chairPrice * 2);
    expect(chairs.itemIds).toEqual(['c1', 'c2']);
    // Nobody has said anything about buying yet, so everything reads as still to buy.
    expect(chairs.status).toBe('to-buy');
    expect(list.toBuy).toBe(list.total);
    expect(list.owned).toBe(0);
    expect(list.remaining).toBe(list.budget - list.toBuy);
  });

  it('splits the totals by status and takes the least finished status for a mixed line', () => {
    const base = emptyRoom();
    const placed = applyOps(base, [
      place(base, 'chair-dining', 100, 100, 'c1'),
      place(base, 'chair-dining', 160, 100, 'c2'),
      place(base, 'desk-120', 100, 300, 'd1'),
    ]);
    if (!placed.ok) throw new Error('setup failed');

    const marked = applyOps(placed.room, [
      { type: 'setPurchase', id: 'c1', purchase: { status: 'owned' } },
      { type: 'setPurchase', id: 'd1', purchase: { status: 'ordered', source: 'IKEA', url: 'https://example.test/desk' } },
    ]);
    if (!marked.ok) throw new Error('marking failed');

    const list = shoppingList(marked.room);
    const chairs = list.lines.find((l) => l.catalogId === 'chair-dining')!;
    const desk = list.lines.find((l) => l.catalogId === 'desk-120')!;
    // One chair is owned and one is not, so the line is still something to buy.
    expect(chairs.status).toBe('to-buy');
    expect(desk.status).toBe('ordered');
    expect(desk.source).toBe('IKEA');
    expect(desk.url).toBe('https://example.test/desk');
    expect(list.ordered).toBe(desk.lineTotal);
    expect(list.owned).toBe(0);
    expect(list.toBuy).toBe(chairs.lineTotal);
    expect(list.total).toBe(chairs.lineTotal + desk.lineTotal);
  });

  it('writes a plain-text list a person can read', () => {
    const base = emptyRoom();
    const placed = applyOps(base, [place(base, 'desk-120', 100, 300, 'd1')]);
    if (!placed.ok) throw new Error('setup failed');
    const marked = applyOps(placed.room, [{ type: 'setPurchase', id: 'd1', purchase: { status: 'owned', source: 'Already have it' } }]);
    if (!marked.ok) throw new Error('marking failed');

    const text = shoppingListText(marked.room);
    expect(text).toContain('[owned]');
    expect(text).toContain('Already have it');
    expect(text).toContain('Still to buy: $0');
  });
});

describe('setPurchase', () => {
  it('has an exact inverse, both setting and clearing', () => {
    const base = emptyRoom();
    const placed = applyOps(base, [place(base, 'desk-120', 100, 300, 'd1')]);
    if (!placed.ok) throw new Error('setup failed');
    const before = placed.room;

    const set = applyOps(before, [{ type: 'setPurchase', id: 'd1', purchase: { status: 'ordered', source: 'IKEA' } }]);
    if (!set.ok) throw new Error('set failed');
    expect(set.room.items[0]!.purchase).toEqual({ status: 'ordered', source: 'IKEA' });

    const undone = applyOps(set.room, set.inverse);
    if (!undone.ok) throw new Error('undo failed');
    // Deeply equal, not merely similar: the key is dropped rather than left as undefined.
    expect(undone.room).toEqual(before);
    expect('purchase' in undone.room.items[0]!).toBe(false);

    const cleared = applyOps(set.room, [{ type: 'setPurchase', id: 'd1', purchase: null }]);
    if (!cleared.ok) throw new Error('clear failed');
    const restored = applyOps(cleared.room, cleared.inverse);
    if (!restored.ok) throw new Error('restore failed');
    expect(restored.room).toEqual(set.room);
  });

  it('refuses an unknown item and an unknown status', () => {
    const base = emptyRoom();
    const placed = applyOps(base, [place(base, 'desk-120', 100, 300, 'd1')]);
    if (!placed.ok) throw new Error('setup failed');

    expect(applyOps(placed.room, [{ type: 'setPurchase', id: 'nope', purchase: { status: 'owned' } }])).toMatchObject({ ok: false, error: 'not_found' });
    expect(applyOps(placed.room, [{ type: 'setPurchase', id: 'd1', purchase: { status: 'maybe' as never } }])).toMatchObject({ ok: false, error: 'invalid' });
  });
});
