import { describe, it, expect } from 'vitest';
import { WALL_SWATCHES, closestByHue, dominantTone, hexToHsl, hueDistance, suggestPalettes } from '../palette';
import { buildTemplateRoom } from '../templates';
import { makeEmptyRoom } from '../rooms';
import { findCatalogItem } from '../catalog';
import { FLOOR_FINISHES } from '../types';
import { placeTest } from '../validate';

const HEX = /^#[0-9a-f]{6}$/;

describe('color helpers', () => {
  it('hexToHsl reads 3 and 6 digit hex and rejects anything else', () => {
    expect(hexToHsl('#ff0000')).toMatchObject({ h: 0, s: 1 });
    expect(hexToHsl('#0f0')).toMatchObject({ h: 120, s: 1 });
    expect(hexToHsl('#808080')).toMatchObject({ h: 0, s: 0 });
    expect(hexToHsl('#0000ff')!.h).toBeCloseTo(240);
    expect(hexToHsl('red')).toBeNull();
    expect(hexToHsl('#12345')).toBeNull();
  });

  it('hueDistance goes the short way round the wheel', () => {
    expect(hueDistance(10, 350)).toBe(20);
    expect(hueDistance(350, 10)).toBe(20);
    expect(hueDistance(0, 180)).toBe(180);
  });

  it('closestByHue picks the nearest hue and breaks ties on the earlier entry', () => {
    expect(closestByHue(['#0000ff', '#ff0000', '#00ff00'], '#ff2200')).toBe('#ff0000');
    // Both candidates sit 120 degrees away, so the first one wins.
    expect(closestByHue(['#00ff00', '#0000ff'], '#ff0000')).toBe('#00ff00');
    expect(closestByHue([], '#ff0000')).toBeNull();
  });
});

describe('suggestPalettes', () => {
  it('returns exactly three schemes in a fixed order with valid colors', () => {
    const room = buildTemplateRoom('living');
    const palettes = suggestPalettes(room);
    expect(palettes.map((p) => p.name)).toEqual(['warm', 'cool', 'neutral']);
    for (const p of palettes) {
      expect(WALL_SWATCHES.map((w) => w.hex)).toContain(p.wall);
      expect(FLOOR_FINISHES).toContain(p.floor);
      expect(p.accents).toHaveLength(3);
      for (const a of p.accents) expect(a).toMatch(HEX);
    }
  });

  it('is stable across calls and across rooms built from the same template', () => {
    const room = buildTemplateRoom('bedroom');
    expect(suggestPalettes(room)).toEqual(suggestPalettes(room));
    const twin = buildTemplateRoom('bedroom');
    const strip = (p: ReturnType<typeof suggestPalettes>) => p.map(({ recolor: _r, ...rest }) => rest);
    expect(strip(suggestPalettes(twin))).toEqual(strip(suggestPalettes(room)));
  });

  it('every recolor names a real item and one of that item\'s own colors', () => {
    for (const key of ['living', 'bedroom', 'kids', 'studio'] as const) {
      const room = buildTemplateRoom(key);
      for (const p of suggestPalettes(room)) {
        for (const r of p.recolor) {
          const item = room.items.find((i) => i.id === r.id);
          expect(item, `${key}/${p.name}/${r.id}`).toBeDefined();
          const cat = findCatalogItem(room, item!.catalogId)!;
          expect(cat.colors, `${key}/${p.name}/${cat.id}`).toContain(r.color);
        }
      }
    }
  });

  it('never proposes a recolor an item is already wearing', () => {
    const room = buildTemplateRoom('living');
    for (const p of suggestPalettes(room)) {
      for (const r of p.recolor) {
        const item = room.items.find((i) => i.id === r.id)!;
        const cat = findCatalogItem(room, item.catalogId)!;
        expect(item.color ?? cat.color).not.toBe(r.color);
      }
    }
  });

  it('the three schemes really differ, and warm and cool pull an item opposite ways', () => {
    const room = buildTemplateRoom('bedroom');
    const [warm, cool, neutral] = suggestPalettes(room);
    const bed = room.items.find((i) => findCatalogItem(room, i.catalogId)?.category === 'bed')!;
    const pick = (p: typeof warm, id: string) => p!.recolor.find((r) => r.id === id)?.color;
    expect(pick(warm, bed.id)).not.toBe(pick(cool, bed.id));
    expect(new Set([warm!.wall, cool!.wall, neutral!.wall]).size).toBeGreaterThan(1);
  });

  it('reads an empty room as flat and paints color onto the walls', () => {
    const room = makeEmptyRoom('Empty', 300, 300, 250);
    expect(dominantTone(room).s).toBe(0);
    const [warm, cool] = suggestPalettes(room);
    expect(warm!.wall).toBe('#c98f76');
    expect(cool!.wall).toBe('#aebecd');
    expect(warm!.recolor).toEqual([]);
  });

  it('gives the neutral scheme a tiled floor when the room has kitchen fittings', () => {
    const room = makeEmptyRoom('Kitchenette', 300, 300, 250);
    room.items = [placeTest(room, 'counter-120', 60, 30, 0, 'c')];
    expect(suggestPalettes(room).find((p) => p.name === 'neutral')!.floor).toBe('tile');
    expect(suggestPalettes(buildTemplateRoom('bedroom')).find((p) => p.name === 'neutral')!.floor).not.toBe('tile');
  });
});
