import { describe, it, expect } from 'vitest';
import { createRoomStore } from '../../store/roomStore';
import { buildReadTools } from '../tools/readTools';
import { buildMutateTools } from '../tools/mutateTools';
import { parseResult } from '../results';
import { TEMPLATES } from '../../engine/templates';
import { suggestPalettes } from '../../engine/palette';
import { placeTest } from '../../engine/validate';
import { ROOM_KINDS } from '../../engine/types';

function setup() {
  const store = createRoomStore();
  const tools = Object.fromEntries([...buildReadTools({ store }), ...buildMutateTools({ store })].map((t) => [t.name, t]));
  return { store, tools, run: async (name: string, input: Record<string, unknown> = {}) => parseResult(await tools[name]!.execute(input)) as Record<string, unknown> };
}

describe('list_templates', () => {
  it('lists every ready-made room with the numbers needed to choose one', async () => {
    const { tools, run } = setup();
    const r = await run('list_templates');
    const templates = r['templates'] as { key: string; name: string; blurb: string; width: number; items: number; budget: number }[];
    expect(templates.map((t) => t.key)).toEqual(ROOM_KINDS);
    for (const t of templates) {
      expect(t.name.length).toBeGreaterThan(0);
      expect(t.blurb.length).toBeGreaterThan(10);
      expect(t.items).toBeGreaterThanOrEqual(4);
      expect(t.budget).toBeGreaterThan(0);
    }
    expect(templates.find((t) => t.key === 'bedroom')!.width).toBe(340);
    expect(tools['list_templates']!.annotations).toMatchObject({ readOnlyHint: true });
  });
});

describe('load_template', () => {
  it('creates the room, switches to it and returns its summary', async () => {
    const { store, run } = setup();
    const before = store.getState().currentId;
    const r = await run('load_template', { key: 'kitchen' });
    expect(r).toMatchObject({ ok: true, status: 'applied', template: 'kitchen' });
    const summary = r['room'] as { room: { name: string; width: number }; items: unknown[]; violations: unknown[] };
    expect(summary.room.name).toBe('Kitchen');
    expect(summary.room.width).toBe(380);
    expect(summary.items).toHaveLength(TEMPLATES.find((t) => t.key === 'kitchen')!.items.length);
    const s = store.getState();
    expect(s.currentId).not.toBe(before);
    // The previous room is kept, not replaced.
    expect(Object.keys(s.rooms)).toHaveLength(2);
    expect(s.current().ledger).toEqual([]);
    expect(s.current().finish.floor).toBe('tile');
  });

  it('honours a name', async () => {
    const { store, run } = setup();
    const r = await run('load_template', { key: 'hall', name: 'Front hall' });
    expect(r).toMatchObject({ ok: true, status: 'applied' });
    expect(store.getState().current().name).toBe('Front hall');
  });

  it('rejects an unknown key', async () => {
    const { store, run } = setup();
    const before = store.getState().currentId;
    expect(await run('load_template', { key: 'garage' })).toMatchObject({ ok: false, error: 'invalid_input' });
    expect(store.getState().currentId).toBe(before);
  });
});

describe('suggest_palette', () => {
  it('returns the three schemes for the current room', async () => {
    const { store, tools, run } = setup();
    await run('load_template', { key: 'living' });
    const r = await run('suggest_palette');
    const palettes = r['palettes'] as { name: string; wall: string; recolor: { id: string; color: string }[] }[];
    expect(palettes.map((p) => p.name)).toEqual(['warm', 'cool', 'neutral']);
    expect(palettes).toEqual(suggestPalettes(store.getState().current()));
    expect(tools['suggest_palette']!.annotations).toMatchObject({ readOnlyHint: true });
  });

  it('its recolors are accepted by set_item_color', async () => {
    const { store, run } = setup();
    await run('load_template', { key: 'bedroom' });
    const palettes = (await run('suggest_palette'))['palettes'] as { name: string; recolor: { id: string; color: string }[] }[];
    const warm = palettes[0]!;
    expect(warm.recolor.length).toBeGreaterThan(0);
    for (const c of warm.recolor) expect(await run('set_item_color', c)).toMatchObject({ ok: true, status: 'applied' });
    const room = store.getState().current();
    for (const c of warm.recolor) expect(room.items.find((i) => i.id === c.id)!.color).toBe(c.color);
  });
});

describe('set_item_color', () => {
  it('recolors an item, clears the override and records the change', async () => {
    const { store, run } = setup();
    const room = store.getState().current();
    store.getState().dispatch({ ops: [{ type: 'place', item: placeTest(room, 'sofa-2', 180, 300, 0, 's') }], actor: 'human' });

    const r = await run('set_item_color', { id: 's', color: '#8c9a7a' });
    expect(r).toMatchObject({ ok: true, status: 'applied' });
    expect(store.getState().current().items[0]!.color).toBe('#8c9a7a');
    expect(store.getState().current().ledger.at(-1)).toMatchObject({ actor: 'agent', tool: 'set_item_color' });

    expect(await run('set_item_color', { id: 's', color: null })).toMatchObject({ ok: true });
    expect(store.getState().current().items[0]).not.toHaveProperty('color');
    // Omitting the colour clears it too, so an agent that cannot send null is not stuck.
    await run('set_item_color', { id: 's', color: '#8c9a7a' });
    expect(await run('set_item_color', { id: 's' })).toMatchObject({ ok: true });
    expect(store.getState().current().items[0]).not.toHaveProperty('color');
  });

  it('refuses a bad hex or an unknown id', async () => {
    const { store, run } = setup();
    const room = store.getState().current();
    store.getState().dispatch({ ops: [{ type: 'place', item: placeTest(room, 'sofa-2', 180, 300, 0, 's') }], actor: 'human' });

    expect(await run('set_item_color', { id: 's', color: 'olive' })).toMatchObject({ ok: false, error: 'invalid_input' });
    expect(await run('set_item_color', { id: 'nope', color: '#8c9a7a' })).toMatchObject({ ok: false, error: 'not_found' });
    expect(store.getState().current().items[0]).not.toHaveProperty('color');
  });
});

describe('set_finish', () => {
  it('sets wall and floor and keeps what it is not given', async () => {
    const { store, run } = setup();
    const r = await run('set_finish', { wall: '#c3cdb9', floor: 'walnut' });
    expect(r).toMatchObject({ ok: true, status: 'applied', finish: { wall: '#c3cdb9', floor: 'walnut' } });
    expect(store.getState().current().finish).toEqual({ wall: '#c3cdb9', floor: 'walnut' });

    expect(await run('set_finish', { floor: 'tile' })).toMatchObject({ ok: true });
    expect(store.getState().current().finish).toEqual({ wall: '#c3cdb9', floor: 'tile' });

    expect(await run('set_finish', { wall: '#efe9df' })).toMatchObject({ ok: true, status: 'applied' });
    expect(store.getState().current().finish.wall).toBe('#efe9df');
  });

  it('refuses a bad hex and an empty call', async () => {
    const { store, run } = setup();
    expect(await run('set_finish', { wall: 'sage' })).toMatchObject({ ok: false, error: 'invalid_input' });
    expect(await run('set_finish', {})).toMatchObject({ ok: false, error: 'invalid_input' });
    expect(store.getState().current().finish).toEqual({ wall: '#efe9df', floor: 'oak' });
  });
});

describe('get_catalog room filter', () => {
  it('filters by room kind and reports rooms, colors and mountHeight', async () => {
    const { run } = setup();
    const kitchen = await run('get_catalog', { room: 'kitchen', category: 'appliance' });
    const items = kitchen['items'] as { id: string; rooms: string[]; colors?: string[]; mountHeight?: number }[];
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((i) => i.rooms.includes('kitchen'))).toBe(true);
    expect(items.find((i) => i.id === 'microwave-50')!.mountHeight).toBe(150);
    expect(items.find((i) => i.id === 'fridge-60')).not.toHaveProperty('mountHeight');

    const beds = await run('get_catalog', { room: 'kids', category: 'bed' });
    const bedIds = (beds['items'] as { id: string; colors?: string[] }[]);
    expect(bedIds.map((b) => b.id)).toContain('bed-bunk-90');
    expect(bedIds.map((b) => b.id)).not.toContain('bed-king-180');
    expect(bedIds.find((b) => b.id === 'bed-bunk-90')!.colors!.length).toBeGreaterThan(1);

    const bad = await run('get_catalog', { room: 'garage' });
    expect((bad['items'] as unknown[]).length).toBe(0);
  });
});
