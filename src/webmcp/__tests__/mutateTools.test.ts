import { describe, it, expect } from 'vitest';
import { createRoomStore } from '../../store/roomStore';
import { buildMutateTools } from '../tools/mutateTools';
import { parseResult } from '../results';
import { itemViolations, placeTest } from '../../engine/validate';
import { BLOCKING_KINDS } from '../../engine/nearest';

function setup() {
  const store = createRoomStore();
  const tools = Object.fromEntries(buildMutateTools({ store }).map((t) => [t.name, t]));
  return { store, tools, run: async (name: string, input: Record<string, unknown> = {}) => parseResult(await tools[name]!.execute(input)) as Record<string, unknown> };
}

describe('mutating tools', () => {
  it('exposes the documented tool names', () => {
    const { tools } = setup();
    expect(Object.keys(tools).sort()).toEqual(['add_catalog_item', 'add_opening', 'apply_layout', 'apply_palette', 'clear_items', 'create_room', 'delete_room', 'fix_item', 'load_template', 'move_item', 'move_opening', 'place_item', 'propose_layout', 'remove_item', 'remove_opening', 'rename_room', 'revert_to_entry', 'rotate_item', 'select_item', 'set_brief', 'set_camera', 'set_daylight_hour', 'set_finish', 'set_item_color', 'set_item_locked', 'set_room_shell', 'set_view', 'swap_item', 'switch_room', 'undo_last_action']);
    expect(tools['place_item']!.annotations).toBeUndefined();
  });

  it('place_item applies, records the ledger, and reports violations with a suggestion', async () => {
    const { store, run } = setup();
    const r = await run('place_item', { catalogId: 'desk-120', x: 60, y: 30 });
    expect(r).toMatchObject({ ok: true, status: 'applied' });
    expect(store.getState().current().items).toHaveLength(1);
    expect(store.getState().current().ledger[0]).toMatchObject({ actor: 'agent', tool: 'place_item' });
    const bad = await run('place_item', { catalogId: 'desk-120', x: 30, y: 30 });
    expect(bad['status']).toBe('applied');
    expect((bad['violations'] as unknown[]).length).toBeGreaterThan(0);
    expect(bad['suggestion']).toMatchObject({ x: expect.any(Number), y: expect.any(Number) });
    expect(await run('place_item', { catalogId: 'nope', x: 0, y: 0 })).toMatchObject({ ok: false, error: 'invalid_input' });
  });


  it('move, rotate, swap, lock and remove', async () => {
    const { store, run } = setup();
    const room = store.getState().current();
    store.getState().dispatch({ ops: [{ type: 'place', item: placeTest(room, 'desk-120', 60, 30, 0, 'd') }], actor: 'human' });
    expect(await run('move_item', { id: 'd', x: 200, y: 30 })).toMatchObject({ ok: true });
    expect(store.getState().current().items[0]).toMatchObject({ x: 200, rotation: 0 });
    expect(await run('rotate_item', { id: 'd', rotation: 90 })).toMatchObject({ ok: true });
    expect(store.getState().current().items[0]!.rotation).toBe(90);
    expect(await run('swap_item', { id: 'd', catalogId: 'desk-100' })).toMatchObject({ ok: true });
    expect(await run('set_item_locked', { id: 'd', locked: true })).toMatchObject({ ok: true });
    expect(await run('move_item', { id: 'd', x: 10, y: 10 })).toMatchObject({ ok: false, error: 'locked', itemId: 'd' });
    expect(await run('remove_item', { id: 'd' })).toMatchObject({ ok: false, error: 'locked' });
    expect(await run('set_item_locked', { id: 'd', locked: false })).toMatchObject({ ok: true });
    expect(await run('remove_item', { id: 'd' })).toMatchObject({ ok: true });
    expect(await run('remove_item', { id: 'd' })).toMatchObject({ ok: false, error: 'not_found' });
  });

  it('fix_item moves a blocked item to the nearest clear spot', async () => {
    const { store, run, tools } = setup();
    const room = store.getState().current();
    store.getState().dispatch({
      ops: [
        { type: 'place', item: placeTest(room, 'desk-120', 60, 30, 0, 'a') },
        { type: 'place', item: placeTest(room, 'desk-120', 100, 30, 0, 'b') },
      ],
      actor: 'human',
    });
    expect(tools['fix_item']!.annotations).toBeUndefined();
    const before = store.getState().current().items.find((i) => i.id === 'b')!;
    const r = await run('fix_item', { id: 'b' });
    expect(r).toMatchObject({ ok: true, status: 'applied' });
    const after = store.getState().current().items.find((i) => i.id === 'b')!;
    expect(after.x !== before.x || after.y !== before.y).toBe(true);
    expect(after.rotation).toBe(before.rotation);
    expect(itemViolations(store.getState().current(), after).filter((v) => BLOCKING_KINDS.has(v.kind))).toEqual([]);
    const ledger = store.getState().current().ledger;
    expect(ledger[ledger.length - 1]).toMatchObject({ actor: 'agent', tool: 'fix_item', summary: 'Moved Desk 120 to the nearest clear spot' });

    expect(await run('fix_item', { id: 'b' })).toMatchObject({ ok: false, error: 'already_clear', hint: 'Item has no blocking violations' });
    expect(store.getState().current().ledger).toHaveLength(2);
    expect(await run('fix_item', { id: 'zz' })).toMatchObject({ ok: false, error: 'not_found' });
  });

  it('place_item and move_item snap a position within 15 cm of a wall', async () => {
    const { store, run } = setup();
    const placed = await run('place_item', { catalogId: 'desk-120', x: 100, y: 42, rotation: 90 });
    expect(placed).toMatchObject({ ok: true, status: 'applied', snapped: true, wall: 'top' });
    const desk = store.getState().current().items[0]!;
    expect(desk).toMatchObject({ x: 100, y: 30, rotation: 0 });

    const moved = await run('move_item', { id: desk.id, x: 200, y: 44, rotation: 90 });
    expect(moved).toMatchObject({ ok: true, status: 'applied', snapped: true, wall: 'top' });
    expect(store.getState().current().items[0]).toMatchObject({ x: 200, y: 30, rotation: 0 });

    const away = await run('move_item', { id: desk.id, x: 180, y: 260 });
    expect(away).toMatchObject({ ok: true, snapped: false });
    expect(away).not.toHaveProperty('wall');
    expect(store.getState().current().items[0]).toMatchObject({ x: 180, y: 260 });
  });


  it('keeps the caller position when the snapped one would leave the room', async () => {
    const { store, run } = setup();
    const r = await run('place_item', { catalogId: 'desk-120', x: 30, y: 42 });
    expect(r).toMatchObject({ ok: true, snapped: false });
    expect(r).not.toHaveProperty('wall');
    expect(store.getState().current().items[0]).toMatchObject({ x: 30, y: 42, rotation: 0 });
  });

  it('shell, openings, brief and catalog additions', async () => {
    const { store, run } = setup();
    expect(await run('set_room_shell', { width: 400, depth: 500, height: 260 })).toMatchObject({ ok: true });
    expect(store.getState().current()).toMatchObject({ width: 400, northWall: 'top' });
    const o = await run('add_opening', { kind: 'window', wall: 'top', offset: 100, width: 100 });
    expect(o['ok']).toBe(true);
    const win = store.getState().current().openings.find((x) => x.wall === 'top')!;
    expect(win).toMatchObject({ height: 120, sill: 90 });
    expect(await run('remove_opening', { id: win.id })).toMatchObject({ ok: true });
    expect(await run('set_brief', { budget: 900 })).toMatchObject({ ok: true });
    expect(store.getState().current().brief).toMatchObject({ budget: 900, needs: ['sleep', 'work from home', 'host two friends'] });
    const c = await run('add_catalog_item', { name: 'Paper lamp', category: 'lamp', width: 30, depth: 30, height: 150, price: 25 });
    expect(c['ok']).toBe(true);
    const id = c['catalogId'] as string;
    expect(store.getState().current().catalogExtras[0]).toMatchObject({ id, source: 'agent', blocksLight: false });
    expect(await run('place_item', { catalogId: id, x: 40, y: 40 })).toMatchObject({ ok: true });
  });

  it('every mutating result carries status, violations and metrics', async () => {
    const { run } = setup();
    const uniform = (r: Record<string, unknown>, label: string) => {
      expect(typeof r['status'], label).toBe('string');
      expect(Array.isArray(r['violations']), label).toBe(true);
      expect(typeof (r['metrics'] as { budgetUsed: unknown }).budgetUsed, label).toBe('number');
    };
    uniform(await run('set_daylight_hour', { hour: 12 }), 'set_daylight_hour');
    uniform(await run('set_camera', { preset: 'overview' }), 'set_camera');
    uniform(await run('set_brief', { budget: 900 }), 'set_brief');
    const proposed = await run('propose_layout', { label: 'One', placements: [{ action: 'place', catalogId: 'desk-120', x: 60, y: 30 }] });
    uniform(proposed, 'propose_layout');
    expect(proposed).not.toHaveProperty('violationsAfter');
    await run('place_item', { catalogId: 'desk-120', x: 60, y: 30 });
    uniform(await run('undo_last_action'), 'undo_last_action');
    expect(await run('undo_last_action')).toHaveProperty('items');
  });


  it('propose_layout, set_camera and undo', async () => {
    const { store, run } = setup();
    const p = await run('propose_layout', { label: 'Cozy', placements: [{ action: 'place', catalogId: 'bed-queen-160', x: 260, y: 300 }, { action: 'place', catalogId: 'desk-120', x: 60, y: 30 }] });
    expect(p).toMatchObject({ ok: true, status: 'proposed' });
    expect(store.getState().current().proposals[0]!.label).toBe('Cozy');
    store.getState().acceptProposal(store.getState().current().proposals[0]!.id);
    const cam = await run('set_camera', { preset: 'at_desk' });
    expect(cam).toMatchObject({ ok: true, camera: { mode: 'walk', yaw: 0 } });
    expect((cam['itemsInView'] as { id: string }[]).length).toBeGreaterThan(0);
    expect(await run('set_camera', { preset: 'nope' })).toMatchObject({ ok: false, error: 'invalid_input' });
    expect(await run('set_camera', { x: 100, y: 100, yaw: 90 })).toMatchObject({ ok: true });
    const u = await run('undo_last_action');
    expect(u).toMatchObject({ ok: true });
    expect(store.getState().current().items).toHaveLength(0);
  });
});

describe('move_opening', () => {
  it('moves a window by id and explains a bad offset', async () => {
    const { store, run } = setup();
    const win = store.getState().current().openings.find((o) => o.kind === 'window')!;
    expect(await run('move_opening', { id: win.id, offset: win.offset + 30 })).toMatchObject({ ok: true, status: 'applied' });
    expect(store.getState().current().openings.find((o) => o.id === win.id)?.offset).toBe(win.offset + 30);

    const bad = await run('move_opening', { id: win.id, offset: 100000 });
    expect(bad['ok']).toBe(false);
    expect(String(bad['hint'] ?? bad['error'])).toMatch(/past the end/);
    expect(await run('move_opening', { id: 'nope', offset: 10 })).toMatchObject({ ok: false, error: 'not_found' });
  });
});
