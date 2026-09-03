import { describe, it, expect } from 'vitest';
import { createRoomStore } from '../../store/roomStore';
import { installWebMCP } from '../install';
import { FakeModelContext } from '../shim';
import { parseResult } from '../results';
import { placeTest } from '../../engine/validate';
import { alternativesFor } from '../../engine/alternatives';

describe('installWebMCP', () => {
  it('registers 58 static tools and swaps dynamic groups with state', async () => {
    const store = createRoomStore();
    const mc = new FakeModelContext();
    const { registry, isNative } = installWebMCP(store, mc);
    expect(isNative).toBe(false);
    expect(mc.getTools()).toHaveLength(58);

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
    expect(mc.getTools()).toHaveLength(58);
  });

  it('proposal tools are always registered and apply atomically', async () => {
    const store = createRoomStore();
    const mc = new FakeModelContext();
    installWebMCP(store, mc);
    const s = () => store.getState();

    expect(mc.getTools().map((t) => t.name)).toEqual(expect.arrayContaining(['apply_proposal', 'withdraw_proposal', 'apply_all_proposals']));
    expect(parseResult(await mc.executeTool('apply_proposal', { proposalId: 'nope' }))).toMatchObject({ ok: false, error: 'not_found' });

    const a = s().propose({ label: 'A', ops: [{ type: 'place', item: placeTest(s().current(), 'desk-120', 60, 30, 0, 'a') }] });
    const b = s().propose({ label: 'B', ops: [{ type: 'place', item: placeTest(s().current(), 'sofa-2', 180, 300, 0, 'b') }] });
    if (!a.ok || !b.ok) throw new Error();

    const all = parseResult(await mc.executeTool('apply_all_proposals', {}));
    expect(all).toMatchObject({ ok: true, status: 'applied' });
    expect(s().current().items).toHaveLength(2);
    expect(s().current().proposals).toHaveLength(0);
    const ledger = s().current().ledger;
    expect(ledger[ledger.length - 1]!.summary).toContain('A');
    expect(ledger[ledger.length - 1]!.summary).toContain('B');

    const c = s().propose({ label: 'C', ops: [{ type: 'place', item: placeTest(s().current(), 'lamp-floor', 330, 480, 0, 'c') }] });
    if (!c.ok) throw new Error();
    const one = parseResult(await mc.executeTool('apply_proposal', { proposalId: c.proposal.id })) as { items: unknown[] };
    expect(one).toMatchObject({ ok: true, status: 'applied' });
    expect(one.items).toHaveLength(3);
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
