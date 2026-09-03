import { describe, it, expect } from 'vitest';
import { WALL_PALETTES, findWallPalette } from '../wallPalettes';
import { hexToHsl } from '../palette';

const HEX = /^#[0-9a-f]{6}$/;

describe('WALL_PALETTES', () => {
  it('offers eleven regions, six named colors each', () => {
    expect(WALL_PALETTES).toHaveLength(11);
    expect(WALL_PALETTES.map((p) => p.region)).toEqual(expect.arrayContaining([
      'Japan', 'China', 'Europe', 'American', 'Italy', 'Egypt', 'Middle East', 'Scandinavia', 'Morocco', 'India', 'Mexico',
    ]));
    for (const p of WALL_PALETTES) {
      expect(p.swatches, p.region).toHaveLength(6);
      expect(p.note.length, p.region).toBeGreaterThan(10);
    }
  });

  it('gives every swatch a valid six-digit hex and a real name', () => {
    for (const p of WALL_PALETTES) {
      for (const s of p.swatches) {
        expect(s.hex, `${p.region} ${s.name}`).toMatch(HEX);
        expect(s.name.trim().length, `${p.region} ${s.hex}`).toBeGreaterThan(2);
        // A name, not a hex repeated: nobody asks for #b7410e, they ask for Venetian red.
        expect(s.name.startsWith('#'), `${p.region} ${s.name}`).toBe(false);
      }
    }
  });

  it('keys and swatch names are unique, and every key is findable', () => {
    const keys = WALL_PALETTES.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const p of WALL_PALETTES) {
      const names = p.swatches.map((s) => s.name);
      expect(new Set(names).size, p.region).toBe(names.length);
      const hexes = p.swatches.map((s) => s.hex);
      expect(new Set(hexes).size, p.region).toBe(hexes.length);
      expect(findWallPalette(p.key)).toBe(p);
    }
    expect(findWallPalette('atlantis')).toBeUndefined();
  });

  it('keeps every color readable as a wall: never black, never neon', () => {
    for (const p of WALL_PALETTES) {
      for (const s of p.swatches) {
        const hsl = hexToHsl(s.hex)!;
        expect(hsl, `${p.region} ${s.name}`).not.toBeNull();
        // A wall this dark stops reading as a painted room; this pale stops being a colour.
        expect(hsl.l, `${p.region} ${s.name} lightness`).toBeGreaterThan(0.16);
        expect(hsl.l, `${p.region} ${s.name} lightness`).toBeLessThan(0.97);
        // Fully saturated paint does not exist; a neon wall would read as a rendering bug.
        expect(hsl.s, `${p.region} ${s.name} saturation`).toBeLessThan(0.85);
      }
    }
  });
});
