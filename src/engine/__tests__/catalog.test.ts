import { describe, it, expect } from 'vitest';
import { SEED_CATALOG, catalogFor, findCatalogItem } from '../catalog';
import { makeDemoRoom, makeEmptyRoom } from '../rooms';
import { CATEGORIES } from '../types';
import { wallFacing } from '../geometry';

describe('catalog', () => {
  it('has unique ids, positive dimensions and prices', () => {
    const ids = new Set(SEED_CATALOG.map((i) => i.id));
    expect(ids.size).toBe(SEED_CATALOG.length);
    expect(SEED_CATALOG.length).toBeGreaterThanOrEqual(45);
    for (const i of SEED_CATALOG) {
      expect(i.width).toBeGreaterThan(0);
      expect(i.depth).toBeGreaterThan(0);
      expect(i.height).toBeGreaterThan(0);
      expect(i.price).toBeGreaterThan(0);
      expect(i.source).toBe('seed');
    }
  });

  it('covers every category', () => {
    for (const c of CATEGORIES) expect(SEED_CATALOG.some((i) => i.category === c)).toBe(true);
  });

  it('includes ids used elsewhere', () => {
    for (const id of ['desk-120', 'wardrobe-100', 'wardrobe-150', 'bed-queen-160', 'rug-160x230', 'chair-office', 'shelf-80', 'sofa-2']) {
      expect(SEED_CATALOG.find((i) => i.id === id), id).toBeDefined();
    }
  });

  it('merges room extras', () => {
    const room = makeDemoRoom();
    room.catalogExtras.push({ ...SEED_CATALOG[0]!, id: 'agent-1', source: 'agent' });
    expect(catalogFor(room).some((i) => i.id === 'agent-1')).toBe(true);
    expect(findCatalogItem(room, 'agent-1')?.source).toBe('agent');
    expect(findCatalogItem(room, 'missing')).toBeUndefined();
  });
});

describe('rooms', () => {
  it('builds the demo studio per spec', () => {
    const r = makeDemoRoom();
    expect([r.width, r.depth, r.height]).toEqual([360, 520, 260]);
    expect(r.openings.filter((o) => o.kind === 'door')).toHaveLength(1);
    const win = r.openings.find((o) => o.kind === 'window')!;
    expect(wallFacing(win.wall, r.northWall)).toBe(90);
    expect(r.brief.budget).toBe(1200);
    expect(r.items).toEqual([]);
    expect(r.daylightHour).toBe(9);
  });

  it('builds an empty room', () => {
    const r = makeEmptyRoom('Test', 300, 400, 250);
    expect(r.name).toBe('Test');
    expect(r.openings).toEqual([]);
    expect(r.ledger).toEqual([]);
  });
});
