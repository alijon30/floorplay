import { describe, it, expect } from 'vitest';
import { createRoomStore } from '../../store/roomStore';
import { installWebMCP } from '../install';
import { FakeModelContext } from '../shim';
import { parseResult } from '../results';
import { placeTest } from '../../engine/validate';
import { alternativesFor } from '../../engine/alternatives';

describe('installWebMCP', () => {
  it('registers 20 static tools and swaps dynamic groups with state', async () => {
    const store = createRoomStore();
    const mc = new FakeModelContext();
    const { registry, isNative } = installWebMCP(store, mc);
    expect(isNative).toBe(false);
    expect(mc.getTools()).toHaveLength(20);

    const room = store.getState().current();
    store.getState().dispatch({ ops: [{ type: 'place', item: placeTest(room, 'wardrobe-100', 300, 100, 90, 'w') }], actor: 'human' });
    store.getState().select('w');
    const names = () => mc.getTools().map((t) => t.name);
    expect(names()).toEqual(expect.arrayContaining(['move_selected', 'replace_selected', 'remove_selected', 'find_alternatives_for_selected']));
    expect(registry.get('move_selected')!.description).toContain('Wardrobe 100');

    const alts = parseResult(await mc.executeTool('find_alternatives_for_selected', { maxPrice: 250 })) as { items: { catalogId: string; fits: boolean }[] };
    expect(alts.items.map((a) => a.catalogId)).toEqual(expect.arrayContaining(['wardrobe-80', 'clothes-rail-100']));
    expect(alts.items.every((a) => a.catalogId !== 'wardrobe-100')).toBe(true);

    const moved = parseResult(await mc.executeTool('move_selected', { x: 300, y: 200 }));
    expect(moved).toMatchObject({ ok: true, status: 'applied' });
    expect(store.getState().current().items[0]).toMatchObject({ x: 300, y: 200 });

    store.getState().select(null);
    expect(names()).not.toContain('move_selected');
    expect(mc.getTools()).toHaveLength(20);
  });

  it('registers proposal tools while proposals exist and applies one', async () => {
    const store = createRoomStore();
    const mc = new FakeModelContext();
    installWebMCP(store, mc);
    const room = store.getState().current();
    expect(mc.getTools().map((t) => t.name)).not.toContain('apply_proposal');
    const p = store.getState().propose({ label: 'Cozy', ops: [{ type: 'place', item: placeTest(room, 'desk-120', 60, 30, 0, 'd') }] });
    if (!p.ok) throw new Error();
    expect(mc.getTools().map((t) => t.name)).toEqual(expect.arrayContaining(['apply_proposal', 'withdraw_proposal', 'apply_all_proposals']));
    const r = parseResult(await mc.executeTool('apply_proposal', { proposalId: p.proposal.id }));
    expect(r).toMatchObject({ ok: true, status: 'applied' });
    expect(store.getState().current().items).toHaveLength(1);
    expect(mc.getTools().map((t) => t.name)).not.toContain('apply_proposal');
  });
});

describe('alternativesFor', () => {
  it('lists same-category items that fit, cheapest first', () => {
    const store = createRoomStore();
    const room = store.getState().current();
    room.items = [placeTest(room, 'desk-120', 100, 35, 0, 'd')];
    const alts = alternativesFor(room, 'd');
    expect(alts.map((a) => a.catalogId)).toEqual(['desk-100', 'desk-140', 'desk-standing-120']);
    expect(alts.every((a) => a.fits)).toBe(true);
    expect(alternativesFor(room, 'd', 100).map((a) => a.catalogId)).toEqual(['desk-100']);
  });
});
