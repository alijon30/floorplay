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
    store.getState().setDaylightHour(16);
    expect(store.getState().ui).toMatchObject({ selectedItemId: 'x' });
    expect(store.getState().current().daylightHour).toBe(16);
    const created = store.getState().createRoom({ name: 'Office', width: 300, depth: 300, height: 250 });
    expect(store.getState().current().id).toBe(created.id);
  });

  it('loadTemplate adds a furnished room, switches to it and clears the selection', () => {
    const store = createRoomStore();
    const first = store.getState().currentId;
    store.getState().select('x');
    const room = store.getState().loadTemplate('bedroom', 'Guest room');
    const s = store.getState();
    expect(s.currentId).toBe(room.id);
    expect(s.current().name).toBe('Guest room');
    expect(s.current().items.length).toBeGreaterThanOrEqual(4);
    expect(s.ui.selectedItemId).toBeNull();
    expect(s.analysis.metrics.budgetUsed).toBe(1491);
    expect(s.analysis.violations).toEqual([]);
    // The room it was called from is kept alongside the new one.
    expect(Object.keys(s.rooms)).toEqual(expect.arrayContaining([first, room.id]));
    expect(store.getState().loadTemplate('bedroom').name).toBe('Bedroom');
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

  it('persists the onboarding dismissal, the daylight and shadow toggles and the room panel', () => {
    vi.useFakeTimers();
    try {
      const storage = memoryStorage();
      const a = createRoomStore({ storage });
      expect(a.getState().ui.onboardingDismissed).toBe(false);
      expect(a.getState().ui).toMatchObject({ showDaylight: true, showShadows: true, roomPanelOpen: true });
      a.getState().dismissOnboarding();
      a.getState().setShowDaylight(false);
      a.getState().setShowShadows(false);
      a.getState().setRoomPanelOpen(false);
      vi.advanceTimersByTime(300);
      const b = createRoomStore({ storage });
      expect(b.getState().ui).toMatchObject({ onboardingDismissed: true, showDaylight: false, showShadows: false, roomPanelOpen: false });
    } finally {
      vi.useRealTimers();
    }
  });

  it('clears the selection when the room panel opens, since they share the rail', () => {
    const store = createRoomStore();
    const s = store.getState();
    const r = s.dispatch({ ops: [{ type: 'place', item: placeTest(s.current(), 'desk-120', 60, 30, 0, 'a') }], actor: 'human' });
    expect(r.ok).toBe(true);
    store.getState().select('a');
    store.getState().setRoomPanelOpen(true);
    expect(store.getState().ui).toMatchObject({ roomPanelOpen: true, selectedItemId: null });
    // Closing it is not a reason to touch the selection.
    store.getState().select('a');
    store.getState().setRoomPanelOpen(false);
    expect(store.getState().ui).toMatchObject({ roomPanelOpen: false, selectedItemId: 'a' });
  });

  it('opens and closes the shared dialogs, and never persists which one is open', () => {
    vi.useFakeTimers();
    try {
      const storage = memoryStorage();
      const a = createRoomStore({ storage });
      expect(a.getState().ui.dialog).toBeNull();
      a.getState().openDialog('shell');
      expect(a.getState().ui.dialog).toBe('shell');
      a.getState().closeDialog();
      expect(a.getState().ui.dialog).toBeNull();
      // An open dialog is this session's business, so a reload starts with the rail clear.
      a.getState().openDialog('shell');
      vi.advanceTimersByTime(300);
      expect(createRoomStore({ storage }).getState().ui.dialog).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('gives a room saved before finishes existed the default one', () => {
    const storage = memoryStorage();
    const legacy = {
      state: {
        rooms: {
          r1: {
            id: 'r1', name: 'Old room', width: 300, depth: 400, height: 250, northWall: 'top',
            openings: [], items: [], brief: { budget: 1000, currency: 'USD', needs: [], notes: '' },
            daylightHour: 12,
            catalogExtras: [{
              id: 'agent-1', name: 'Found lamp', category: 'lamp', width: 30, depth: 30, height: 150,
              price: 25, color: '#fff', shape: 'lamp', clearance: {}, blocksLight: false, source: 'agent',
            }],
            proposals: [], ledger: [],
          },
        },
        currentId: 'r1',
        ui: { onboardingDismissed: true },
      },
      version: 0,
    };
    storage.setItem(STORAGE_KEY, JSON.stringify(legacy));
    const store = createRoomStore({ storage });
    const room = store.getState().current();
    expect(room.name).toBe('Old room');
    expect(room.finish).toEqual({ wall: '#efe9df', floor: 'oak' });
    expect(room.catalogExtras[0]!.rooms.length).toBeGreaterThan(0);
    // A save from before the shade toggles existed keeps them on rather than restoring undefined,
    // and one from before the room panel existed opens it.
    expect(store.getState().ui).toMatchObject({ showDaylight: true, showShadows: true, roomPanelOpen: true });
  });

  it('survives corrupt persisted JSON', () => {
    const storage = memoryStorage();
    storage.setItem(STORAGE_KEY, '{not json');
    const store = createRoomStore({ storage });
    expect(store.getState().current().name).toBe('Demo studio');
    expect(store.getState().current().items).toHaveLength(0);
  });
});

describe('roomStore homes', () => {
  const store = () => createRoomStore();

  /** A store holding a home with two rooms side by side: A 300x400 at the origin, B 200x400 right of it. */
  function pair() {
    const s = createRoomStore();
    const a = s.getState().createRoom({ name: 'A', width: 300, depth: 400, height: 250 });
    const b = s.getState().createRoom({ name: 'B', width: 200, depth: 400, height: 250 });
    const home = s.getState().createHome({ name: 'Flat 3' });
    s.getState().addRoomToHome(home.id, a.id, 0, 0);
    s.getState().addRoomToHome(home.id, b.id, 300, 0);
    return { s, a, b, home };
  }

  it('creates a home and puts rooms on it, snapping an edge flush to its neighbour', () => {
    const s = store();
    const a = s.getState().createRoom({ name: 'A', width: 300, depth: 400, height: 250 });
    const b = s.getState().createRoom({ name: 'B', width: 200, depth: 400, height: 250 });
    const home = s.getState().createHome({ name: 'Flat 3' });
    expect(s.getState().homes[home.id]).toMatchObject({ name: 'Flat 3', rooms: [], doorways: [] });
    expect(s.getState().addRoomToHome(home.id, a.id, 0, 0)).toEqual({ ok: true, x: 0, y: 0, snapped: false, removedDoorways: [] });
    expect(s.getState().addRoomToHome(home.id, b.id, 312, 14)).toEqual({ ok: true, x: 300, y: 0, snapped: true, removedDoorways: [] });
    expect(s.getState().homes[home.id]!.rooms).toEqual([{ roomId: a.id, x: 0, y: 0 }, { roomId: b.id, x: 300, y: 0 }]);
    // The current room is on the plan now, so the store knows which home it is looking at.
    expect(s.getState().currentHomeId).toBe(home.id);
  });

  it('refuses a room that would sit inside one already on the plan', () => {
    const { s, home, a } = pair();
    const c = s.getState().createRoom({ name: 'C', width: 200, depth: 200, height: 250 });
    const r = s.getState().addRoomToHome(home.id, c.id, 150, 100);
    expect(r).toMatchObject({ ok: false });
    if (r.ok) return;
    expect(r.error).toContain('A');
    expect(s.getState().homes[home.id]!.rooms).toHaveLength(2);
    // A room already on another plan is not quietly stolen.
    const other = s.getState().createHome({ name: 'Flat 4' });
    expect(s.getState().addRoomToHome(other.id, a.id, 0, 0)).toMatchObject({ ok: false });
  });

  it('moves a room on the plan, snapping, and refuses a move that overlaps', () => {
    const { s, home, b } = pair();
    expect(s.getState().moveRoom(b.id, 306, 14)).toEqual({ ok: true, x: 300, y: 0, snapped: true, removedDoorways: [] });
    expect(s.getState().moveRoom(b.id, 100, 0)).toMatchObject({ ok: false });
    expect(s.getState().homes[home.id]!.rooms[1]).toEqual({ roomId: b.id, x: 300, y: 0 });
  });

  it('keeps the doorways a move leaves standing and takes out the ones it breaks', () => {
    // Three rooms in a row: A | B | C, with a doorway through each shared wall.
    const s = store();
    const a = s.getState().createRoom({ name: 'A', width: 300, depth: 400, height: 250 });
    const b = s.getState().createRoom({ name: 'B', width: 200, depth: 400, height: 250 });
    const c = s.getState().createRoom({ name: 'C', width: 250, depth: 400, height: 250 });
    const home = s.getState().createHome({ name: 'Flat 3' });
    s.getState().addRoomToHome(home.id, a.id, 0, 0);
    s.getState().addRoomToHome(home.id, b.id, 300, 0);
    s.getState().addRoomToHome(home.id, c.id, 500, 0);
    const ab = s.getState().cutDoorway({ roomId: a.id, wall: 'right', offset: 100, width: 80 });
    const bc = s.getState().cutDoorway({ roomId: b.id, wall: 'right', offset: 100, width: 80 });
    expect(ab.ok && bc.ok).toBe(true);
    if (!ab.ok || !bc.ok) return;

    // A nudge that snaps back flush changes nothing, so nothing is taken down.
    expect(s.getState().moveRoom(c.id, 508, 6)).toMatchObject({ ok: true, x: 500, y: 0, removedDoorways: [] });
    expect(s.getState().homes[home.id]!.doorways).toHaveLength(2);

    // Sliding C down its own wall keeps it flush and keeps both halves inside the shared part,
    // but they no longer meet: that is two holes, not one doorway, so it goes.
    const slid = s.getState().moveRoom(c.id, 500, 120);
    expect(slid).toMatchObject({ ok: true, x: 500, y: 120, removedDoorways: [bc.doorway.id] });
    // Only the moved room's doorways are re-read; the one between A and B is untouched.
    expect(s.getState().homes[home.id]!.doorways.map((d) => d.id)).toEqual([ab.doorway.id]);
    for (const id of [b.id, c.id]) {
      expect(s.getState().rooms[id]!.openings.map((o) => o.doorwayId).filter(Boolean)).not.toContain(bc.doorway.id);
      expect(s.getState().rooms[id]!.ledger.at(-1)!.summary).toMatch(/^Removed doorway to /);
    }
    expect(s.getState().rooms[a.id]!.openings.map((o) => o.doorwayId)).toEqual([ab.doorway.id]);

    // Pulling B clear of A takes the last doorway with it, out of both rooms.
    expect(s.getState().moveRoom(b.id, 300, 150)).toMatchObject({ ok: true, removedDoorways: [ab.doorway.id] });
    expect(s.getState().homes[home.id]!.doorways).toEqual([]);
    expect(s.getState().rooms[a.id]!.openings).toEqual([]);
    expect(s.getState().rooms[b.id]!.openings).toEqual([]);
  });

  it('cuts a doorway, writing one ledger entry and one opening in each room', () => {
    const { s, a, b, home } = pair();
    const r = s.getState().cutDoorway({ roomId: a.id, wall: 'right', offset: 100, width: 80, actor: 'agent', tool: 'cut_doorway' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const rooms = s.getState().rooms;
    expect(rooms[a.id]!.openings).toHaveLength(1);
    expect(rooms[a.id]!.openings[0]).toMatchObject({ wall: 'right', offset: 100, width: 80, swing: 'in', doorwayId: r.doorway.id });
    expect(rooms[b.id]!.openings[0]).toMatchObject({ wall: 'left', offset: 100, width: 80, swing: 'out', doorwayId: r.doorway.id });
    expect(rooms[a.id]!.ledger.map((e) => e.summary)).toEqual(['Cut doorway to B']);
    expect(rooms[b.id]!.ledger.map((e) => e.summary)).toEqual(['Cut doorway to A']);
    expect(rooms[b.id]!.ledger[0]).toMatchObject({ actor: 'agent', tool: 'cut_doorway' });
    expect(s.getState().homes[home.id]!.doorways).toEqual([r.doorway]);
    // A doorway that does not fit the shared wall is refused with something to act on.
    const bad = s.getState().cutDoorway({ roomId: a.id, wall: 'top', offset: 10 });
    expect(bad).toMatchObject({ ok: false });
    if (bad.ok) return;
    expect(bad.hint!.length).toBeGreaterThan(0);
  });

  it('removes a doorway from both rooms and from the home', () => {
    const { s, a, b, home } = pair();
    const r = s.getState().cutDoorway({ roomId: a.id, wall: 'right', offset: 100 });
    if (!r.ok) throw new Error(r.error);
    expect(s.getState().removeDoorway(r.doorway.id)).toBe(true);
    expect(s.getState().rooms[a.id]!.openings).toEqual([]);
    expect(s.getState().rooms[b.id]!.openings).toEqual([]);
    expect(s.getState().rooms[a.id]!.ledger.map((e) => e.summary)).toEqual(['Cut doorway to B', 'Removed doorway to B']);
    expect(s.getState().homes[home.id]!.doorways).toEqual([]);
    expect(s.getState().removeDoorway(r.doorway.id)).toBe(false);
  });

  it('takes a room off the plan with its doorways, leaving it standalone', () => {
    const { s, a, b, home } = pair();
    const r = s.getState().cutDoorway({ roomId: a.id, wall: 'right', offset: 100 });
    if (!r.ok) throw new Error(r.error);
    expect(s.getState().removeRoomFromHome(b.id)).toBe(true);
    expect(s.getState().homes[home.id]!.rooms.map((p) => p.roomId)).toEqual([a.id]);
    expect(s.getState().homes[home.id]!.doorways).toEqual([]);
    expect(s.getState().rooms[a.id]!.openings).toEqual([]);
    expect(s.getState().rooms[b.id]!.openings).toEqual([]);
    // The room itself survives, off the plan.
    expect(s.getState().rooms[b.id]!.name).toBe('B');
    expect(s.getState().removeRoomFromHome(b.id)).toBe(false);
  });

  it('deletes a room that is on a plan by taking it off the plan first', () => {
    const { s, a, b, home } = pair();
    const r = s.getState().cutDoorway({ roomId: a.id, wall: 'right', offset: 100 });
    if (!r.ok) throw new Error(r.error);
    s.getState().deleteRoom(b.id);
    expect(s.getState().rooms[b.id]).toBeUndefined();
    expect(s.getState().homes[home.id]!.rooms.map((p) => p.roomId)).toEqual([a.id]);
    expect(s.getState().homes[home.id]!.doorways).toEqual([]);
    expect(s.getState().rooms[a.id]!.openings).toEqual([]);
  });

  it('builds a ready-made home, opens it on the entrance and keeps every room reachable', () => {
    const s = store();
    const home = s.getState().createHomeFromTemplate('one-bedroom');
    expect(home.rooms).toHaveLength(4);
    expect(home.doorways).toHaveLength(3);
    expect(s.getState().currentHomeId).toBe(home.id);
    expect(s.getState().currentId).toBe(home.entranceRoomId);
    expect(s.getState().current().name).toBe('Entrance hall');
    expect(s.getState().ui.planView).toBe('home');
    for (const p of home.rooms) expect(s.getState().rooms[p.roomId]).toBeDefined();
    // The rooms arrive furnished and already joined, with no edits to undo.
    expect(s.getState().current().ledger).toEqual([]);
  });

  it('follows the current room in and out of its home', () => {
    const { s, a, b } = pair();
    const solo = s.getState().createRoom({ name: 'Solo', width: 300, depth: 300, height: 250 });
    expect(s.getState().currentHomeId).toBeNull();
    expect(s.getState().ui.planView).toBe('room');
    s.getState().switchRoom(a.id);
    expect(s.getState().currentHomeId).not.toBeNull();
    s.getState().setPlanView('home');
    s.getState().switchRoom(b.id);
    expect(s.getState().ui.planView).toBe('home');
    s.getState().switchRoom(solo.id);
    expect(s.getState().currentHomeId).toBeNull();
    expect(s.getState().ui.planView).toBe('room');
  });

  it('names an entrance, renames the home, and deletes it leaving the rooms behind', () => {
    const { s, a, b, home } = pair();
    const r = s.getState().cutDoorway({ roomId: a.id, wall: 'right', offset: 100 });
    if (!r.ok) throw new Error(r.error);
    s.getState().setEntrance(b.id);
    expect(s.getState().homes[home.id]!.entranceRoomId).toBe(b.id);
    s.getState().switchRoom(a.id);
    s.getState().renameHome('Flat 7');
    expect(s.getState().homes[home.id]!.name).toBe('Flat 7');
    s.getState().setDoorwayMode(true);
    expect(s.getState().ui.doorwayMode).toBe(true);
    s.getState().deleteHome(home.id);
    expect(s.getState().homes[home.id]).toBeUndefined();
    expect(s.getState().rooms[a.id]!.name).toBe('A');
    expect(s.getState().rooms[a.id]!.openings).toEqual([]);
    expect(s.getState().currentHomeId).toBeNull();
    expect(s.getState().ui.planView).toBe('room');
    expect(s.getState().ui.doorwayMode).toBe(false);
  });

  it('persists homes and the home being looked at across a reload', () => {
    vi.useFakeTimers();
    try {
      const storage = memoryStorage();
      const first = createRoomStore({ storage });
      const home = first.getState().createHomeFromTemplate('studio-hall');
      vi.advanceTimersByTime(300);
      const second = createRoomStore({ storage });
      const restored = second.getState().homes[home.id];
      expect(restored).toBeDefined();
      expect(restored!.rooms.map((p) => p.roomId)).toEqual(home.rooms.map((p) => p.roomId));
      expect(restored!.doorways.map((d) => d.id)).toEqual(home.doorways.map((d) => d.id));
      expect(second.getState().currentHomeId).toBe(home.id);
      expect(second.getState().current().openings.some((o) => o.doorwayId)).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('gives a save made before homes existed an empty set of them', () => {
    const storage = memoryStorage();
    storage.setItem(STORAGE_KEY, JSON.stringify({
      state: {
        rooms: {
          r1: {
            id: 'r1', name: 'Old room', width: 300, depth: 400, height: 250, northWall: 'top',
            openings: [], items: [], brief: { budget: 1000, currency: 'USD', needs: [], notes: '' },
            daylightHour: 12, finish: { wall: '#efe9df', floor: 'oak' }, catalogExtras: [], proposals: [], ledger: [],
          },
        },
        currentId: 'r1',
      },
      version: 0,
    }));
    const s = createRoomStore({ storage });
    expect(s.getState().homes).toEqual({});
    expect(s.getState().currentHomeId).toBeNull();
    expect(s.getState().ui.planView).toBe('room');
  });
});
