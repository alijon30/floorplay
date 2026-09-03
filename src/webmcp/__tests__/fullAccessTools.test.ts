import { describe, it, expect } from 'vitest';
import { createRoomStore } from '../../store/roomStore';
import { buildReadTools } from '../tools/readTools';
import { buildMutateTools } from '../tools/mutateTools';
import { parseResult } from '../results';
import { placeTest } from '../../engine/validate';

/**
 * The tools added so an agent can reach everything a human can: the room list and the guide,
 * the room lifecycle, batch layout and palette application, clearing, reverting, selection
 * and the view toggles. Each one is exercised on its happy path and on one failure.
 */
function setup() {
  const store = createRoomStore();
  const tools = Object.fromEntries([...buildReadTools({ store }), ...buildMutateTools({ store })].map((t) => [t.name, t]));
  return {
    store,
    tools,
    run: async (name: string, input: Record<string, unknown> = {}) => parseResult(await tools[name]!.execute(input)) as Record<string, unknown>,
  };
}

/** Places a desk and a lamp so the batch tools have something real to work on. */
function furnish(store: ReturnType<typeof createRoomStore>) {
  const room = store.getState().current();
  store.getState().dispatch({
    ops: [
      { type: 'place', item: placeTest(room, 'desk-120', 100, 40, 0, 'd') },
      { type: 'place', item: placeTest(room, 'lamp-floor', 330, 480, 0, 'l') },
    ],
    actor: 'human',
  });
}

describe('list_rooms and get_guide', () => {
  it('lists every room and flags the current one', async () => {
    const { store, run } = setup();
    const first = store.getState().currentId;
    const second = store.getState().createRoom({ name: 'Study', width: 300, depth: 300, height: 250 });

    const r = await run('list_rooms');
    const rooms = r['rooms'] as { id: string; name: string; items: number; current: boolean }[];
    expect(rooms).toHaveLength(2);
    expect(rooms.find((x) => x.id === second.id)).toMatchObject({ name: 'Study', items: 0, current: true });
    expect(rooms.find((x) => x.id === first)!.current).toBe(false);
  });

  it('list_rooms and get_guide are read-only and take no input', () => {
    const { tools } = setup();
    expect(tools['list_rooms']!.annotations).toMatchObject({ readOnlyHint: true });
    expect(tools['get_guide']!.annotations).toMatchObject({ readOnlyHint: true });
    // No required fields means an agent that sends stray keys still gets an answer rather than an error.
    expect(tools['list_rooms']!.inputSchema.required).toBeUndefined();
  });

  it('get_guide returns a workflow, the coordinate conventions and tips', async () => {
    const { run } = setup();
    const g = await run('get_guide');
    const workflow = g['workflow'] as string[];
    expect(workflow).toHaveLength(6);
    expect(workflow[0]).toContain('get_room');
    expect(workflow.join(' ')).toContain('propose_layout');
    expect(g['conventions']).toContain('centimeters');
    expect((g['tips'] as string[]).length).toBeGreaterThanOrEqual(4);
    expect((g['tips'] as string[]).join(' ')).toContain('Propose-first');
  });
});

describe('room lifecycle tools', () => {
  it('create_room makes an empty room, switches to it and keeps the old one', async () => {
    const { store, run } = setup();
    const before = store.getState().currentId;
    const r = await run('create_room', { name: 'Loft', width: 400, depth: 500, height: 260 });
    expect(r).toMatchObject({ ok: true, status: 'applied' });
    expect((r['room'] as { room: { name: string; width: number } }).room).toMatchObject({ name: 'Loft', width: 400 });
    expect(store.getState().current().items).toHaveLength(0);
    expect(store.getState().currentId).not.toBe(before);
    expect(store.getState().rooms[before]).toBeDefined();
    expect(r['violations']).toEqual([]);
    expect(r['metrics']).toMatchObject({ violationCount: 0 });
  });

  it('create_room records a setShell entry when northWall is given', async () => {
    const { store, run } = setup();
    const r = await run('create_room', { name: 'Loft', width: 400, depth: 500, height: 260, northWall: 'left' });
    expect(r).toMatchObject({ ok: true, status: 'applied', ledgerId: expect.any(String) });
    expect(store.getState().current().northWall).toBe('left');
    expect(store.getState().current().ledger).toHaveLength(1);
  });

  it('create_room rejects a side outside the allowed range', async () => {
    const { store, run } = setup();
    const before = Object.keys(store.getState().rooms).length;
    expect(await run('create_room', { name: 'Cupboard', width: 40, depth: 300, height: 250 })).toMatchObject({ ok: false, error: 'invalid_input' });
    expect(await run('create_room', { name: '  ', width: 300, depth: 300, height: 250 })).toMatchObject({ ok: false, error: 'invalid_input' });
    expect(Object.keys(store.getState().rooms)).toHaveLength(before);
  });

  it('switch_room moves between rooms and keeps what each holds', async () => {
    const { store, run } = setup();
    const first = store.getState().currentId;
    furnish(store);
    store.getState().createRoom({ name: 'Study', width: 300, depth: 300, height: 250 });

    const r = await run('switch_room', { id: first });
    expect(r).toMatchObject({ ok: true, status: 'applied' });
    expect(store.getState().currentId).toBe(first);
    expect((r['room'] as { items: unknown[] }).items.length).toBeGreaterThan(0);
  });

  it('switch_room reports not_found for an unknown id', async () => {
    const { store, run } = setup();
    const before = store.getState().currentId;
    expect(await run('switch_room', { id: 'room-nope' })).toMatchObject({ ok: false, error: 'not_found' });
    expect(store.getState().currentId).toBe(before);
  });

  it('rename_room renames the current room', async () => {
    const { store, run } = setup();
    expect(await run('rename_room', { name: 'Guest bedroom' })).toMatchObject({ ok: true, status: 'applied' });
    expect(store.getState().current().name).toBe('Guest bedroom');
  });

  it('rename_room rejects a blank name', async () => {
    const { store, run } = setup();
    const before = store.getState().current().name;
    expect(await run('rename_room', { name: '   ' })).toMatchObject({ ok: false, error: 'invalid_input' });
    expect(store.getState().current().name).toBe(before);
  });

  it('delete_room removes a room and returns the one now current', async () => {
    const { store, run } = setup();
    const first = store.getState().currentId;
    const second = store.getState().createRoom({ name: 'Study', width: 300, depth: 300, height: 250 });

    const r = await run('delete_room', { id: second.id });
    expect(r).toMatchObject({ ok: true, status: 'applied', deleted: second.id });
    expect(store.getState().rooms[second.id]).toBeUndefined();
    expect(store.getState().currentId).toBe(first);
    expect((r['room'] as { room: { id: string } }).room.id).toBe(first);
  });

  it('delete_room refuses the last room and an unknown id', async () => {
    const { store, run } = setup();
    const only = store.getState().currentId;
    expect(await run('delete_room', { id: 'room-nope' })).toMatchObject({ ok: false, error: 'not_found' });
    expect(await run('delete_room', { id: only })).toMatchObject({ ok: false, error: 'last_room' });
    expect(store.getState().rooms[only]).toBeDefined();
  });
});

describe('apply_layout', () => {
  it('applies places, moves and removes as one ledger entry', async () => {
    const { store, run } = setup();
    furnish(store);
    const before = store.getState().current().ledger.length;

    const r = await run('apply_layout', {
      placements: [
        { action: 'move', id: 'd', x: 200, y: 40 },
        { action: 'remove', id: 'l' },
        { action: 'place', catalogId: 'sofa-2', x: 180, y: 300, id: 's' },
      ],
    });
    expect(r).toMatchObject({ ok: true, status: 'applied', ledgerId: expect.any(String) });
    const room = store.getState().current();
    expect(room.items.map((x) => x.id).sort()).toEqual(['d', 's']);
    expect(room.items.find((x) => x.id === 'd')).toMatchObject({ x: 200, y: 40 });
    // One entry for three changes, so a single undo takes the whole idea back.
    expect(room.ledger).toHaveLength(before + 1);
    expect(room.ledger[room.ledger.length - 1]!.summary).toBe('Applied layout (3 changes)');
  });

  it('becomes a proposal under propose-first mode', async () => {
    const { store, run } = setup();
    furnish(store);
    store.getState().setProposeFirst(true);
    const r = await run('apply_layout', { placements: [{ action: 'move', id: 'd', x: 200, y: 40 }] });
    expect(r).toMatchObject({ ok: true, status: 'proposed' });
    expect(store.getState().current().items.find((x) => x.id === 'd')).toMatchObject({ x: 100 });
  });

  it('rejects an empty batch and an unknown id', async () => {
    const { run } = setup();
    expect(await run('apply_layout', { placements: [] })).toMatchObject({ ok: false, error: 'invalid_input' });
    expect(await run('apply_layout', { placements: [{ action: 'move', id: 'nope', x: 10, y: 10 }] })).toMatchObject({ ok: false, error: 'not_found' });
  });
});

describe('apply_palette', () => {
  it('sets the wall, the floor and every recolor in one entry', async () => {
    const { store, run } = setup();
    furnish(store);
    const before = store.getState().current().ledger.length;

    const r = await run('apply_palette', { name: 'cool' });
    expect(r).toMatchObject({ ok: true, status: 'applied' });
    const palette = r['palette'] as { name: string; wall: string; floor: string; recolored: number };
    expect(palette.name).toBe('cool');
    const room = store.getState().current();
    expect(room.finish).toMatchObject({ wall: palette.wall, floor: palette.floor });
    expect(room.ledger).toHaveLength(before + 1);
    expect(room.ledger[room.ledger.length - 1]!.summary).toBe('Applied cool palette');
  });

  it('applies even under propose-first mode, because color is easy to change back', async () => {
    const { store, run } = setup();
    store.getState().setProposeFirst(true);
    expect(await run('apply_palette', { name: 'warm' })).toMatchObject({ ok: true, status: 'applied' });
    expect(store.getState().current().proposals).toHaveLength(0);
  });

  it('rejects a scheme it does not offer', async () => {
    const { store, run } = setup();
    const before = store.getState().current().finish;
    expect(await run('apply_palette', { name: 'lavender' })).toMatchObject({ ok: false, error: 'invalid_input' });
    expect(store.getState().current().finish).toEqual(before);
  });
});

describe('clear_items', () => {
  it('removes every unlocked item as one entry and leaves locked ones', async () => {
    const { store, run } = setup();
    furnish(store);
    store.getState().dispatch({ ops: [{ type: 'setLocked', id: 'l', locked: true }], actor: 'human' });
    const before = store.getState().current().ledger.length;

    const r = await run('clear_items');
    expect(r).toMatchObject({ ok: true, status: 'applied' });
    const room = store.getState().current();
    expect(room.items.map((x) => x.id)).toEqual(['l']);
    expect(room.ledger).toHaveLength(before + 1);
    expect(room.ledger[room.ledger.length - 1]!.summary).toBe('Cleared 1 item');
  });

  it('reports nothing_to_clear on an empty room and on an all-locked one', async () => {
    const { store, run } = setup();
    expect(await run('clear_items')).toMatchObject({ ok: false, error: 'nothing_to_clear' });
    furnish(store);
    store.getState().dispatch({ ops: [{ type: 'setLocked', id: 'd', locked: true }, { type: 'setLocked', id: 'l', locked: true }], actor: 'human' });
    expect(await run('clear_items')).toMatchObject({ ok: false, error: 'nothing_to_clear' });
    expect(store.getState().current().items).toHaveLength(2);
  });
});

describe('revert_to_entry', () => {
  it('rewinds everything recorded after the named entry', async () => {
    const { store, run } = setup();
    await run('place_item', { catalogId: 'desk-120', x: 100, y: 40 });
    const mark = store.getState().current().ledger[0]!.id;
    await run('place_item', { catalogId: 'lamp-floor', x: 330, y: 480 });
    await run('place_item', { catalogId: 'sofa-2', x: 180, y: 300 });
    expect(store.getState().current().items).toHaveLength(3);

    const r = await run('revert_to_entry', { ledgerId: mark });
    expect(r).toMatchObject({ ok: true, status: 'applied', ledgerId: expect.any(String) });
    expect(store.getState().current().items).toHaveLength(1);
    // The rewind is itself recorded, so it can be undone in turn.
    expect(r['summary']).toContain('Reverted to');
    expect(store.getState().current().ledger).toHaveLength(4);
  });

  it('separates an unknown id from an entry with nothing after it', async () => {
    const { store, run } = setup();
    expect(await run('revert_to_entry', { ledgerId: 'led-nope' })).toMatchObject({ ok: false, error: 'not_found' });
    await run('place_item', { catalogId: 'desk-120', x: 100, y: 40 });
    const newest = store.getState().current().ledger[0]!.id;
    expect(await run('revert_to_entry', { ledgerId: newest })).toMatchObject({ ok: false, error: 'nothing_to_revert' });
    expect(store.getState().current().items).toHaveLength(1);
  });
});

describe('select_item and set_view', () => {
  it('selects an item and returns its summary', async () => {
    const { store, run } = setup();
    furnish(store);
    const before = store.getState().current().ledger.length;

    const r = await run('select_item', { id: 'd' });
    expect(r).toMatchObject({ ok: true, status: 'applied' });
    expect(r['selected']).toMatchObject({ id: 'd', name: expect.any(String), x: 100 });
    expect(store.getState().ui.selectedItemId).toBe('d');
    expect(store.getState().ui.propsTab).toBe('selection');
    // Selecting is not an edit, so nothing lands in the ledger.
    expect(store.getState().current().ledger).toHaveLength(before);
  });

  it('clears the selection on null and on an omitted id', async () => {
    const { store, run } = setup();
    furnish(store);
    await run('select_item', { id: 'd' });
    expect(await run('select_item', { id: null })).toMatchObject({ ok: true, selected: null });
    expect(store.getState().ui.selectedItemId).toBeNull();
    await run('select_item', { id: 'l' });
    expect(await run('select_item')).toMatchObject({ ok: true, selected: null });
    expect(store.getState().ui.selectedItemId).toBeNull();
  });

  it('select_item reports not_found for an id the room does not hold', async () => {
    const { store, run } = setup();
    furnish(store);
    await run('select_item', { id: 'd' });
    expect(await run('select_item', { id: 'nope' })).toMatchObject({ ok: false, error: 'not_found' });
    expect(store.getState().ui.selectedItemId).toBe('d');
  });

  it('set_view toggles the daylight tint and the shadows', async () => {
    const { store, run } = setup();
    expect(store.getState().ui.showDaylight).toBe(true);
    const r = await run('set_view', { showDaylight: false });
    expect(r).toMatchObject({ ok: true, status: 'applied', showDaylight: false, showShadows: true });
    expect(store.getState().ui.showDaylight).toBe(false);
    // Omitted fields keep what is set.
    expect(await run('set_view', { showShadows: false })).toMatchObject({ showDaylight: false, showShadows: false });
  });

  it('set_view rejects a call that names neither flag', async () => {
    const { store, run } = setup();
    expect(await run('set_view', {})).toMatchObject({ ok: false, error: 'invalid_input' });
    expect(store.getState().ui.showDaylight).toBe(true);
    expect(store.getState().ui.showShadows).toBe(true);
  });
});
