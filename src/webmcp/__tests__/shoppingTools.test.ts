import { describe, it, expect } from 'vitest';
import { createRoomStore } from '../../store/roomStore';
import { installWebMCP } from '../install';
import { FakeModelContext } from '../shim';
import { parseResult } from '../results';
import { placeTest } from '../../engine/validate';

/** A store with a known, empty room, so the list under test is exactly what the test placed. */
function setup() {
  const store = createRoomStore();
  const mc = new FakeModelContext();
  installWebMCP(store, mc);
  const s = () => store.getState();
  // Clear the demo room first, so the list under test is exactly what this test placed.
  const existing = s().current().items;
  if (existing.length) s().dispatch({ actor: 'human', ops: existing.map((i) => ({ type: 'remove' as const, id: i.id })) });
  const room = s().current();
  s().dispatch({
    actor: 'human',
    ops: [
      { type: 'place', item: placeTest(room, 'chair-dining', 100, 100, 0, 'c1') },
      { type: 'place', item: placeTest(room, 'chair-dining', 160, 100, 0, 'c2') },
      { type: 'place', item: placeTest(room, 'desk-120', 100, 300, 0, 'd1') },
    ],
  });
  return { store, mc, s };
}

describe('get_shopping_list', () => {
  it('returns one line per catalog id, with a search query and the brief', async () => {
    const { mc, s } = setup();
    const list = parseResult(await mc.executeTool('get_shopping_list', {})) as {
      ok: boolean;
      lines: { catalogId: string; qty: number; lineTotal: number; status: string; searchQuery: string; itemIds: string[] }[];
      toBuy: number; total: number; budget: number; remaining: number;
      brief: { budget: number };
    };
    expect(list.ok).toBe(true);
    expect(list.lines).toHaveLength(2);
    const chairs = list.lines.find((l) => l.catalogId === 'chair-dining')!;
    expect(chairs.qty).toBe(2);
    expect(chairs.status).toBe('to-buy');
    expect(chairs.itemIds).toEqual(['c1', 'c2']);
    // The query is what makes the list actionable: a shop can be searched with it as written.
    expect(chairs.searchQuery).toMatch(/^dining chair \d+x\d+ cm under \$\d+$/);
    expect(list.toBuy).toBe(list.total);
    expect(list.budget).toBe(s().current().brief.budget);
    expect(list.brief.budget).toBe(list.budget);
    expect(list.remaining).toBe(list.budget - list.toBuy);
  });
});

describe('set_purchase_status', () => {
  it('marks every copy of a catalog id in one ledger entry', async () => {
    const { mc, s } = setup();
    const before = s().current().ledger.length;
    const r = parseResult(await mc.executeTool('set_purchase_status', { catalogId: 'chair-dining', status: 'ordered', source: 'IKEA', url: 'https://example.test/chair' }));
    expect(r).toMatchObject({ ok: true, status: 'applied' });

    const items = s().current().items;
    expect(items.filter((i) => i.purchase?.status === 'ordered')).toHaveLength(2);
    expect(items.find((i) => i.id === 'c1')!.purchase).toEqual({ status: 'ordered', source: 'IKEA', url: 'https://example.test/chair' });
    expect(s().current().ledger.length).toBe(before + 1);

    const list = parseResult(await mc.executeTool('get_shopping_list', {})) as { lines: { catalogId: string; status: string; source?: string }[]; ordered: number; toBuy: number };
    const chairs = list.lines.find((l) => l.catalogId === 'chair-dining')!;
    expect(chairs.status).toBe('ordered');
    expect(chairs.source).toBe('IKEA');
    expect(list.ordered).toBe(chairs.status === 'ordered' ? list.ordered : 0);
  });

  it('marks a single placement by id and keeps a source it was not given again', async () => {
    const { mc, s } = setup();
    await mc.executeTool('set_purchase_status', { id: 'c1', status: 'ordered', source: 'IKEA' });
    await mc.executeTool('set_purchase_status', { id: 'c1', status: 'owned' });
    expect(s().current().items.find((i) => i.id === 'c1')!.purchase).toEqual({ status: 'owned', source: 'IKEA' });
    expect(s().current().items.find((i) => i.id === 'c2')!.purchase).toBeUndefined();
  });

  it('refuses an unknown target and an unknown status', async () => {
    const { mc } = setup();
    expect(parseResult(await mc.executeTool('set_purchase_status', { catalogId: 'sofa-2', status: 'owned' }))).toMatchObject({ ok: false, error: 'not_found' });
    expect(parseResult(await mc.executeTool('set_purchase_status', { status: 'owned' }))).toMatchObject({ ok: false });
    expect(parseResult(await mc.executeTool('set_purchase_status', { id: 'c1', status: 'nope' }))).toMatchObject({ ok: false });
  });
});
