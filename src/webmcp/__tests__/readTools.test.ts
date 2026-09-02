import { describe, it, expect } from 'vitest';
import { createRoomStore } from '../../store/roomStore';
import { buildReadTools } from '../tools/readTools';
import { placementsToOps } from '../tools/placements';
import { parseResult } from '../results';
import { itemViolations, placeTest } from '../../engine/validate';
import { BLOCKING_KINDS } from '../../engine/nearest';
import type { CatalogItem, Rotation } from '../../engine/types';

function setup() {
  const store = createRoomStore();
  const room = store.getState().current();
  store.getState().dispatch({ ops: [{ type: 'place', item: placeTest(room, 'desk-120', 60, 30, 0, 'desk') }], actor: 'human' });
  const tools = Object.fromEntries(buildReadTools({ store }).map((t) => [t.name, t]));
  return { store, tools };
}

describe('read tools', () => {
  it('get_room reports items, metrics, violations and conventions', async () => {
    const { tools } = setup();
    const r = parseResult(await tools['get_room']!.execute({})) as Record<string, unknown>;
    expect(r['ok']).toBe(true);
    const room = r['room'] as { width: number; openings: { kind: string; facing: number }[] };
    expect(room.width).toBe(360);
    expect(room.openings.find((o) => o.kind === 'window')?.facing).toBe(90);
    const items = r['items'] as { id: string; name: string; w: number; d: number }[];
    expect(items[0]).toMatchObject({ id: 'desk', name: 'Desk 120', w: 120, d: 60 });
    expect((r['metrics'] as { budgetUsed: number }).budgetUsed).toBe(129);
    expect(r['violations']).toEqual([]);
    expect(tools['get_room']!.annotations).toEqual({ readOnlyHint: true, untrustedContentHint: true });
    expect(tools['get_room']!.description).toContain('top-left');
  });

  it('get_catalog filters by category, size and price', async () => {
    const { tools } = setup();
    const all = parseResult(await tools['get_catalog']!.execute({})) as { count: number; truncated: boolean; items: unknown[] };
    expect(all.count).toBeGreaterThanOrEqual(110);
    // The seed catalog is bigger than one page now, so an unfiltered call is truncated by design.
    expect(all.truncated).toBe(true);
    expect(all.items).toHaveLength(60);
    const narrowed = parseResult(await tools['get_catalog']!.execute({ category: 'rug' })) as { truncated: boolean };
    expect(narrowed.truncated).toBe(false);
    const beds = parseResult(await tools['get_catalog']!.execute({ category: 'bed', maxPrice: 400 })) as { items: { id: string }[] };
    expect(beds.items.map((b) => b.id).sort()).toEqual(['bed-daybed-90', 'bed-double-140', 'bed-single-90']);
    const narrow = parseResult(await tools['get_catalog']!.execute({ category: 'desk', maxWidth: 100 })) as { items: { id: string }[] };
    expect(narrow.items.map((b) => b.id)).toEqual(['desk-100']);
    const q = parseResult(await tools['get_catalog']!.execute({ query: 'rug' })) as { items: { category: string }[] };
    expect(q.items.every((i) => i.category === 'rug')).toBe(true);
  });

  it('get_catalog reports the full match count and flags truncation', async () => {
    const { store, tools } = setup();
    const extras: CatalogItem[] = Array.from({ length: 70 }, (_, i) => ({
      id: `agent-other-${i}`, name: `Agent find ${i}`, category: 'other',
      width: 40, depth: 40, height: 40, price: 1000 + i, color: '#8c6f5a',
      shape: 'box', clearance: {}, blocksLight: false, source: 'agent', rooms: ['living'],
    }));
    store.getState().current().catalogExtras = extras;
    const r = parseResult(await tools['get_catalog']!.execute({ category: 'other' })) as { count: number; truncated: boolean; items: { id: string }[] };
    expect(r.items).toHaveLength(60);
    expect(r.count).toBe(73);
    expect(r.truncated).toBe(true);
  });

  it('evaluate_layout scores a candidate without mutating', async () => {
    const { store, tools } = setup();
    const r = parseResult(await tools['evaluate_layout']!.execute({
      placements: [{ action: 'place', catalogId: 'bed-queen-160', x: 80, y: 300 }, { action: 'move', id: 'desk', x: 200, y: 30 }],
    })) as { metrics: { budgetUsed: number }; violations: unknown[]; delta: Record<string, unknown> };
    expect(r.metrics.budgetUsed).toBe(628);
    expect(r.delta['budgetUsed']).toEqual({ before: 129, after: 628 });
    expect(store.getState().current().items).toHaveLength(1);
    const bad = parseResult(await tools['evaluate_layout']!.execute({ placements: [{ action: 'place', catalogId: 'nope', x: 0, y: 0 }] }));
    expect(bad).toMatchObject({ ok: false, error: 'invalid_input' });
  });

  it('get_daylight reports light per item and best spots', async () => {
    const { tools } = setup();
    const r = parseResult(await tools['get_daylight']!.execute({ hour: 9 })) as { hour: number; items: { id: string; light: number }[]; bestSpots: { morning: unknown[]; afternoon: unknown[] } };
    expect(r.hour).toBe(9);
    expect(r.items[0]!.id).toBe('desk');
    expect(r.bestSpots.morning.length).toBeGreaterThan(0);
  });

  it('suggest_positions returns valid, ranked placements', async () => {
    const { store, tools } = setup();
    const tool = tools['suggest_positions']!;
    expect(tool.annotations).toMatchObject({ readOnlyHint: true });
    expect(tool.description).toContain('before place_item');

    const r = parseResult(await tool.execute({ catalogId: 'bed-queen-160' })) as {
      catalogId: string;
      suggestions: { x: number; y: number; rotation: Rotation; reason: string; light: number; score: number }[];
    };
    expect(r.catalogId).toBe('bed-queen-160');
    expect(r.suggestions).toHaveLength(5);
    const room = store.getState().current();
    for (const s of r.suggestions) {
      expect(s.reason.length).toBeGreaterThan(0);
      const probe = placeTest(room, 'bed-queen-160', s.x, s.y, s.rotation, '__suggestion');
      expect(itemViolations(room, probe).filter((v) => BLOCKING_KINDS.has(v.kind))).toEqual([]);
    }
    const scores = r.suggestions.map((s) => s.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));

    const few = parseResult(await tool.execute({ catalogId: 'bed-queen-160', near: 'window', count: 2, hour: 16 })) as { suggestions: unknown[] };
    expect(few.suggestions).toHaveLength(2);

    expect(parseResult(await tool.execute({ catalogId: 'nope' }))).toMatchObject({ ok: false, error: 'invalid_input', hint: 'Unknown catalogId; call get_catalog' });
  });

  it('get_ledger lists recent entries', async () => {
    const { tools } = setup();
    const r = parseResult(await tools['get_ledger']!.execute({ limit: 5 })) as { entries: { actor: string; summary: string }[] };
    expect(r.entries).toHaveLength(1);
    expect(r.entries[0]).toMatchObject({ actor: 'human', summary: 'Placed Desk 120 at (60, 30)' });
  });
});

describe('placementsToOps', () => {
  it('maps placements and defaults rotation from the existing item', () => {
    const store = createRoomStore();
    const room = store.getState().current();
    room.items = [placeTest(room, 'desk-120', 60, 30, 90, 'desk')];
    const r = placementsToOps(room, [{ action: 'move', id: 'desk', x: 100, y: 100 }, { action: 'remove', id: 'desk' }]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.ops[0]).toEqual({ type: 'move', id: 'desk', x: 100, y: 100, rotation: 90 });
    expect(placementsToOps(room, [{ action: 'move', id: 'zz', x: 1, y: 1 }])).toMatchObject({ ok: false, error: 'not_found' });
    expect(placementsToOps(room, [{ action: 'place', catalogId: 'desk-120' }])).toMatchObject({ ok: false, error: 'invalid_input' });
  });
});
