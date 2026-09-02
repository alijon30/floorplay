import { describe, it, expect, vi } from 'vitest';
import type { StateStorage } from 'zustand/middleware';
import { createRoomStore } from '../roomStore';
import { placeTest } from '../../engine/validate';
import { STORAGE_KEY } from '../../config';

function memoryStorage(): StateStorage {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) };
}

describe('roomStore', () => {
  it('starts on the demo room', () => {
    const s = createRoomStore().getState();
    expect(s.current().name).toBe('Demo studio');
    expect(s.analysis.metrics.freeFloorPct).toBe(100);
  });

  it('dispatches ops, records the ledger, and undoes', () => {
    const store = createRoomStore();
    const s = store.getState();
    const r = s.dispatch({ ops: [{ type: 'place', item: placeTest(s.current(), 'desk-120', 60, 30, 0, 'a') }], actor: 'agent', tool: 'place_item' });
    expect(r.ok).toBe(true);
    expect(store.getState().current().items).toHaveLength(1);
    expect(store.getState().current().ledger).toHaveLength(1);
    expect(store.getState().current().ledger[0]).toMatchObject({ actor: 'agent', tool: 'place_item', summary: 'Placed Desk 120 at (60, 30)' });
    expect(store.getState().analysis.metrics.budgetUsed).toBe(129);
    const u = store.getState().undo();
    expect(u?.ok).toBe(true);
    expect(store.getState().current().items).toHaveLength(0);
    expect(store.getState().current().ledger).toHaveLength(2);
    expect(store.getState().current().ledger[1]!.summary).toMatch(/^Undid/);
  });

  it('returns failures without touching state', () => {
    const store = createRoomStore();
    const r = store.getState().dispatch({ ops: [{ type: 'move', id: 'zz', x: 0, y: 0, rotation: 0 }], actor: 'human' });
    expect(r).toMatchObject({ ok: false, error: 'not_found' });
    expect(store.getState().current().ledger).toHaveLength(0);
  });

  it('proposes, accepts one, and discards the rest', () => {
    const store = createRoomStore();
    const room = store.getState().current();
    const p1 = store.getState().propose({ label: 'A', ops: [{ type: 'place', item: placeTest(room, 'desk-120', 60, 30, 0, 'a') }] });
    const p2 = store.getState().propose({ label: 'B', ops: [{ type: 'place', item: placeTest(room, 'sofa-2', 180, 300, 0, 'b') }] });
    expect(p1.ok && p2.ok).toBe(true);
    expect(store.getState().current().proposals).toHaveLength(2);
    if (!p1.ok) return;
    expect(p1.proposal.metricsAfter.budgetUsed).toBe(129);
    const r = store.getState().acceptProposal(p1.proposal.id);
    expect(r.ok).toBe(true);
    expect(store.getState().current().items.map((i) => i.id)).toEqual(['a']);
    expect(store.getState().current().proposals).toHaveLength(0);
    expect(store.getState().current().ledger[0]!.summary).toContain('A');
  });

  it('updates a proposal op and rejects', () => {
    const store = createRoomStore();
    const room = store.getState().current();
    const p = store.getState().propose({ label: 'A', ops: [{ type: 'place', item: placeTest(room, 'desk-120', 60, 30, 0, 'a') }] });
    if (!p.ok) throw new Error('propose failed');
    store.getState().updateProposalOp(p.proposal.id, 0, { type: 'place', item: placeTest(room, 'desk-120', 200, 30, 0, 'a') });
    const updated = store.getState().current().proposals[0]!;
    expect((updated.ops[0] as { item: { x: number } }).item.x).toBe(200);
    expect(store.getState().rejectProposal(p.proposal.id)).toBe(true);
    expect(store.getState().current().proposals).toHaveLength(0);
  });

  it('reverts to an earlier ledger entry as one new entry', () => {
    const store = createRoomStore();
    const room = store.getState().current();
    const e1 = store.getState().dispatch({ ops: [{ type: 'place', item: placeTest(room, 'desk-120', 60, 30, 0, 'a') }], actor: 'human' });
    store.getState().dispatch({ ops: [{ type: 'place', item: placeTest(room, 'sofa-2', 180, 300, 0, 'b') }], actor: 'agent' });
    store.getState().dispatch({ ops: [{ type: 'move', id: 'a', x: 200, y: 30, rotation: 0 }], actor: 'agent' });
    if (!e1.ok) throw new Error();
    const r = store.getState().revertTo(e1.entry.id);
    expect(r?.ok).toBe(true);
    const cur = store.getState().current();
    expect(cur.items).toHaveLength(1);
    expect(cur.items[0]).toMatchObject({ id: 'a', x: 60 });
    expect(cur.ledger).toHaveLength(4);
    expect(cur.ledger[3]!.summary).toMatch(/^Reverted to/);
  });

  it('manages rooms and ui state', () => {
    const store = createRoomStore();
    const first = store.getState().currentId;
    const demo = store.getState().loadDemo();
    expect(store.getState().currentId).toBe(demo.id);
    expect(Object.keys(store.getState().rooms)).toHaveLength(2);
    store.getState().switchRoom(first);
    expect(store.getState().currentId).toBe(first);
    store.getState().deleteRoom(demo.id);
    expect(Object.keys(store.getState().rooms)).toHaveLength(1);
    store.getState().select('x');
    store.getState().setProposeFirst(true);
    store.getState().setDaylightHour(16);
    expect(store.getState().ui).toMatchObject({ selectedItemId: 'x', proposeFirst: true });
    expect(store.getState().current().daylightHour).toBe(16);
    const created = store.getState().createRoom({ name: 'Office', width: 300, depth: 300, height: 250 });
    expect(store.getState().current().id).toBe(created.id);
  });

  it('persists rooms through storage and recomputes analysis on load', () => {
    vi.useFakeTimers();
    try {
      const storage = memoryStorage();
      const a = createRoomStore({ storage });
      const room = a.getState().current();
      a.getState().dispatch({ ops: [{ type: 'place', item: placeTest(room, 'desk-120', 60, 30, 0, 'a') }], actor: 'human' });
      vi.advanceTimersByTime(300);
      const b = createRoomStore({ storage });
      expect(b.getState().current().items).toHaveLength(1);
      expect(b.getState().analysis.metrics.budgetUsed).toBe(129);
    } finally {
      vi.useRealTimers();
    }
  });

  it('coalesces rapid writes', () => {
    vi.useFakeTimers();
    try {
      const base = memoryStorage();
      const setItem = vi.fn(base.setItem);
      const storage: StateStorage = { ...base, setItem };
      const store = createRoomStore({ storage });
      for (const id of ['a', 'b', 'c', 'd', 'e']) store.getState().select(id);
      expect(setItem).not.toHaveBeenCalled();
      vi.advanceTimersByTime(300);
      expect(setItem).toHaveBeenCalledTimes(1);
      expect(store.getState().ui.selectedItemId).toBe('e');
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps working when storage throws', () => {
    vi.useFakeTimers();
    try {
      const storage: StateStorage = {
        getItem: () => null,
        setItem: () => { throw new Error('QuotaExceededError'); },
        removeItem: () => {},
      };
      const store = createRoomStore({ storage });
      const room = store.getState().current();
      const r = store.getState().dispatch({ ops: [{ type: 'place', item: placeTest(room, 'desk-120', 60, 30, 0, 'a') }], actor: 'human' });
      expect(r.ok).toBe(true);
      expect(store.getState().current().items).toHaveLength(1);
      vi.advanceTimersByTime(300);
      expect(store.getState().persistError).toContain('Quota');
    } finally {
      vi.useRealTimers();
    }
  });

  it('survives corrupt persisted JSON', () => {
    const storage = memoryStorage();
    storage.setItem(STORAGE_KEY, '{not json');
    const store = createRoomStore({ storage });
    expect(store.getState().current().name).toBe('Demo studio');
    expect(store.getState().current().items).toHaveLength(0);
  });
});
