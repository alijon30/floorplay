// src/engine/palette.ts
import type { CatalogItem, FloorFinish, Room } from './types';
import { findCatalogItem, itemColor } from './catalog';

export interface Hsl { h: number; s: number; l: number }

export interface Palette {
  name: 'warm' | 'cool' | 'neutral';
  /** Wall paint, one of `WALL_SWATCHES`. */
  wall: string;
  floor: FloorFinish;
  /** Three hexes: the scheme's dominant, secondary and accent tone, in that order. */
  accents: [string, string, string];
  /** One entry per placed item the scheme would repaint, skipping items already that color. */
  recolor: { id: string; color: string }[];
}

/** The eight curated wall colors, shared by the style popover and `suggest_palette`. */
export const WALL_SWATCHES: { name: string; hex: string }[] = [
  { name: 'Warm white', hex: '#efe9df' },
  { name: 'Cool white', hex: '#eef1f4' },
  { name: 'Sage', hex: '#c3cdb9' },
  { name: 'Dusty blue', hex: '#aebecd' },
  { name: 'Terracotta', hex: '#c98f76' },
  { name: 'Charcoal', hex: '#4a4f57' },
  { name: 'Sand', hex: '#e4d7c2' },
  { name: 'Blush', hex: '#e8cfc9' },
];

const WALL = {
  warmWhite: '#efe9df', coolWhite: '#eef1f4', sage: '#c3cdb9', dustyBlue: '#aebecd',
  terracotta: '#c98f76', charcoal: '#4a4f57', sand: '#e4d7c2', blush: '#e8cfc9',
} as const;

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function hexToHsl(hex: string): Hsl | null {
  const m = HEX.exec(hex);
  if (!m) return null;
  const raw = m[1]!;
  const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === r) h = 60 * (((g - b) / d) % 6);
  else if (max === g) h = 60 * ((b - r) / d + 2);
  else h = 60 * ((r - g) / d + 4);
  return { h: (h + 360) % 360, s, l };
}

/** Shortest way round the color wheel between two hues, 0 to 180 degrees. */
export function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/**
 * The room's prevailing color, taken from its largest non-rug items.
 *
 * Rugs are left out because a rug is a deliberate splash rather than the tone of the room, and
 * area weighting means a three-seat sofa speaks louder than a nightstand. Hue is averaged around
 * the circle and weighted by saturation, so a wall of white carcasses cannot drag the average
 * toward its arbitrary hue; when nothing in the room is saturated the result reports `s: 0` and
 * every scheme reads the room as flat and brings color in itself.
 */
export function dominantTone(room: Room): Hsl {
  const solids = room.items
    .flatMap((i) => {
      const cat = findCatalogItem(room, i.catalogId);
      if (!cat || cat.category === 'rug') return [];
      const hsl = hexToHsl(itemColor(cat, i.color));
      return hsl ? [{ area: cat.width * cat.depth, hsl }] : [];
    })
    .sort((a, b) => b.area - a.area || a.hsl.h - b.hsl.h)
    .slice(0, 3);
  if (solids.length === 0) return { h: 30, s: 0, l: 0.6 };
  let x = 0;
  let y = 0;
  let sat = 0;
  let light = 0;
  let total = 0;
  for (const s of solids) {
    const rad = (s.hsl.h * Math.PI) / 180;
    const w = s.area * s.hsl.s;
    x += Math.cos(rad) * w;
    y += Math.sin(rad) * w;
    sat += s.hsl.s * s.area;
    light += s.hsl.l * s.area;
    total += s.area;
  }
  const h = x === 0 && y === 0 ? 30 : ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  return { h, s: sat / total, l: light / total };
}

/** Below this the room reads as flat, so a scheme brings its color in through the walls. */
const FLAT_SATURATION = 0.12;
/** Above this the furniture is pale enough that the neutral scheme answers with a dark wall. */
const PALE_LIGHTNESS = 0.6;
/** A dark room gets a light floor and a light room a darker one, so the two never merge. */
const DARK_LIGHTNESS = 0.55;

const isPinkRed = (h: number) => h >= 330 || h < 20;
const isGreen = (h: number) => h >= 60 && h < 180;

const ACCENTS: Record<Palette['name'], [string, string, string]> = {
  // dominant, secondary, accent
  warm: ['#b56b5a', '#c9a227', '#8c6f5a'],
  cool: ['#6b7c93', '#7d8aa0', '#8c9a7a'],
  neutral: ['#b9a48b', '#d8cbb3', '#3e3e46'],
};

/** Which of a scheme's three tones an item takes: statement pieces, then woodwork, then the rest. */
function accentIndex(cat: CatalogItem): 0 | 1 | 2 {
  switch (cat.category) {
    case 'bed': case 'sofa': case 'armchair': case 'rug':
      return 0;
    case 'wardrobe': case 'dresser': case 'shelf': case 'table': case 'desk': case 'storage': case 'nightstand': case 'kitchen':
      return 1;
    default:
      return 2;
  }
}

/** The entry of `colors` closest in hue to `accent`; ties go to the earlier entry. */
export function closestByHue(colors: string[], accent: string): string | null {
  const target = hexToHsl(accent);
  const first = colors[0];
  if (!first) return null;
  if (!target) return first;
  let best = first;
  let bestD = Infinity;
  for (const c of colors) {
    const hsl = hexToHsl(c);
    if (!hsl) continue;
    const d = hueDistance(hsl.h, target.h);
    if (d < bestD) {
      best = c;
      bestD = d;
    }
  }
  return best;
}

function wallFor(name: Palette['name'], tone: Hsl): string {
  switch (name) {
    case 'warm':
      if (tone.s < FLAT_SATURATION) return WALL.terracotta;
      return isPinkRed(tone.h) ? WALL.blush : WALL.sand;
    case 'cool':
      if (tone.s < FLAT_SATURATION) return WALL.dustyBlue;
      return isGreen(tone.h) ? WALL.sage : WALL.coolWhite;
    case 'neutral':
      return tone.l >= PALE_LIGHTNESS ? WALL.charcoal : WALL.warmWhite;
  }
}

function floorFor(name: Palette['name'], tone: Hsl, hasKitchen: boolean): FloorFinish {
  switch (name) {
    case 'warm': return tone.l < DARK_LIGHTNESS ? 'oak' : 'walnut';
    case 'cool': return tone.l < DARK_LIGHTNESS ? 'ash' : 'grey';
    case 'neutral':
      if (hasKitchen) return 'tile';
      return tone.l >= PALE_LIGHTNESS ? 'ash' : 'oak';
  }
}

/**
 * Three complete schemes for the room, always in the order warm, cool, neutral.
 *
 * Each one answers what is already in the room rather than ignoring it: the wall reacts to the
 * dominant hue and the floor to its lightness, and every item that offers alternative finishes is
 * repainted to whichever of them sits closest in hue to the tone its role calls for. Items already
 * wearing that color are left out of `recolor`, so applying a scheme changes only what it must.
 *
 * Deterministic: the same room always yields the same three palettes.
 */
export function suggestPalettes(room: Room): Palette[] {
  const tone = dominantTone(room);
  const hasKitchen = room.items.some((i) => {
    const cat = findCatalogItem(room, i.catalogId);
    return cat?.category === 'kitchen' || cat?.category === 'appliance';
  });
  return (['warm', 'cool', 'neutral'] as const).map((name) => {
    const accents = ACCENTS[name];
    const recolor: { id: string; color: string }[] = [];
    for (const item of room.items) {
      const cat = findCatalogItem(room, item.catalogId);
      if (!cat?.colors?.length) continue;
      const color = closestByHue(cat.colors, accents[accentIndex(cat)]);
      if (color && color !== itemColor(cat, item.color)) recolor.push({ id: item.id, color });
    }
    return { name, wall: wallFor(name, tone), floor: floorFor(name, tone, hasKitchen), accents, recolor };
  });
}
