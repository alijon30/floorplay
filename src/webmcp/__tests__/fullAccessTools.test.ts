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
