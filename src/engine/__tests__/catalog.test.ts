import { describe, it, expect } from 'vitest';
import { SEED_CATALOG, catalogFor, findCatalogItem, isFloorSolid } from '../catalog';
import { makeDemoRoom, makeEmptyRoom } from '../rooms';
import { CATEGORIES, ROOM_KINDS, DEFAULT_FINISH } from '../types';
import { wallFacing } from '../geometry';

describe('catalog', () => {
  it('has unique ids, positive dimensions and prices', () => {
    const ids = new Set(SEED_CATALOG.map((i) => i.id));
    expect(ids.size).toBe(SEED_CATALOG.length);
    expect(SEED_CATALOG.length).toBeGreaterThanOrEqual(110);
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

  it('tags every item with at least one known room kind', () => {
    for (const i of SEED_CATALOG) {
      expect(i.rooms.length, i.id).toBeGreaterThan(0);
      for (const r of i.rooms) expect(ROOM_KINDS, `${i.id} room ${r}`).toContain(r);
    }
    for (const kind of ROOM_KINDS) expect(SEED_CATALOG.some((i) => i.rooms.includes(kind)), kind).toBe(true);
  });

  it('offers 2 to 4 alternative colors led by the default one', () => {
    const withColors = SEED_CATALOG.filter((i) => i.colors);
    expect(withColors.length).toBeGreaterThan(20);
    for (const i of withColors) {
      expect(i.colors!.length, i.id).toBeGreaterThanOrEqual(2);
      expect(i.colors!.length, i.id).toBeLessThanOrEqual(4);
      expect(i.colors![0], i.id).toBe(i.color);
      expect(new Set(i.colors).size, i.id).toBe(i.colors!.length);
      for (const c of i.colors!) expect(c, `${i.id} ${c}`).toMatch(/^#[0-9a-f]{6}$/);
    }
    // The categories a swatch row is worth showing for all carry alternatives.
    for (const cat of ['sofa', 'armchair', 'bed', 'chair', 'rug', 'wardrobe', 'dresser', 'decor'] as const) {
      expect(SEED_CATALOG.filter((i) => i.category === cat).every((i) => i.colors), cat).toBe(true);
    }
    expect(SEED_CATALOG.filter((i) => i.category === 'wall' && i.shape === 'picture').every((i) => i.colors)).toBe(true);
  });

  it('marks wall-mounted items with a mount height and keeps them off the floor', () => {
    const mounted = SEED_CATALOG.filter((i) => i.mountHeight !== undefined);
    expect(mounted.length).toBeGreaterThanOrEqual(16);
    for (const i of mounted) {
      expect(i.mountHeight, i.id).toBeGreaterThan(0);
      expect(isFloorSolid(i), i.id).toBe(false);
    }
    // Every item in the wall category hangs; rugs are the only other thing that is not solid floor.
    expect(SEED_CATALOG.filter((i) => i.category === 'wall').every((i) => i.mountHeight !== undefined)).toBe(true);
    expect(SEED_CATALOG.filter((i) => !isFloorSolid(i) && i.mountHeight === undefined).every((i) => i.category === 'rug')).toBe(true);
  });

  it('keeps the ids, dimensions and prices other tests are written against', () => {
    // Frozen on purpose: tests across the repo place these by id and assert on the numbers.
    const frozen = [
      { id: 'desk-120', width: 120, depth: 60, height: 75, price: 129 },
      { id: 'wardrobe-100', width: 100, depth: 60, height: 200, price: 299 },
      { id: 'wardrobe-150', width: 150, depth: 60, height: 200, price: 449 },
      { id: 'bed-queen-160', width: 160, depth: 200, height: 45, price: 499 },
      { id: 'rug-160x230', width: 160, depth: 230, height: 1, price: 89 },
      { id: 'chair-office', width: 60, depth: 60, height: 100, price: 129 },
      { id: 'shelf-80', width: 80, depth: 30, height: 180, price: 99 },
      { id: 'sofa-2', width: 160, depth: 85, height: 80, price: 449 },
    ];
    for (const f of frozen) {
      expect(SEED_CATALOG.find((i) => i.id === f.id), f.id).toMatchObject(f);
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
    expect(r.finish).toEqual({ wall: '#efe9df', floor: 'oak' });
    expect(r.finish).not.toBe(DEFAULT_FINISH);
  });
});
