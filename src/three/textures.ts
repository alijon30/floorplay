// src/three/textures.ts
// Procedural textures drawn to a canvas at runtime. Nothing here is fetched, so the
// app keeps working offline and ships no binary assets.
import * as THREE from 'three';
import type { FloorFinish } from '../engine/types';

/** Side length in meters of one plank tile. The floor repeats it room-size / this. */
export const PLANK_TILE_M = 2;
/** Side length in meters of one tile-floor patch: a 4×4 grid of 30 cm tiles. */
export const TILE_TILE_M = 1.2;
/** Plank rows per meter, so one tile holds PLANKS_PER_M * PLANK_TILE_M rows. */
const PLANKS_PER_M = 8;
const SIZE = 1024;

/** How wide one repeat of a finish's texture is, in meters. */
export function floorTileM(finish: FloorFinish): number {
  return finish === 'tile' ? TILE_TILE_M : PLANK_TILE_M;
}

/**
 * The wood a plank finish is cut from: a base fill plus the HSL band its boards vary within.
 *
 * `hue`/`sat`/`light` are the low end of each band and the `*Spread` values are how far a
 * board may drift above it, so one deterministic random per board lands it somewhere in the
 * range. `joint` is the alpha of the dark line between boards, kept low on pale woods where a
 * near-black seam would read as dirt rather than a shadow.
 */
interface PlankSpec {
  base: string;
  hue: number; hueSpread: number;
  sat: number; satSpread: number;
  light: number; lightSpread: number;
  joint: number;
}

const PLANKS: Record<Exclude<FloorFinish, 'tile'>, PlankSpec> = {
  oak: { base: '#b18a5e', hue: 26, hueSpread: 10, sat: 26, satSpread: 12, light: 46, lightSpread: 16, joint: 0.45 },
  walnut: { base: '#6b4a32', hue: 18, hueSpread: 8, sat: 30, satSpread: 10, light: 24, lightSpread: 14, joint: 0.5 },
  ash: { base: '#d6c6ac', hue: 36, hueSpread: 8, sat: 16, satSpread: 8, light: 70, lightSpread: 12, joint: 0.22 },
  grey: { base: '#9a9a99', hue: 32, hueSpread: 6, sat: 3, satSpread: 5, light: 54, lightSpread: 14, joint: 0.3 },
};

/** Deterministic [0,1) noise, so every reload draws exactly the same floor. */
function rnd(i: number, salt: number): number {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** Fill a span that may wrap past the right edge of the tile. */
function fillSpan(ctx: CanvasRenderingContext2D, u0: number, u1: number, y: number, h: number): void {
  if (u1 >= u0) ctx.fillRect(u0, y, u1 - u0, h);
  else { ctx.fillRect(u0, y, SIZE - u0, h); ctx.fillRect(0, y, u1, h); }
}

function newCanvas(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
  if (typeof document === 'undefined') return null; // node tests and any SSR pass
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  return ctx ? { canvas, ctx } : null;
}

function drawPlanks(spec: PlankSpec): HTMLCanvasElement | null {
  const made = newCanvas();
  if (!made) return null;
  const { canvas, ctx } = made;

  const rows = PLANKS_PER_M * PLANK_TILE_M;
  const rowH = SIZE / rows;
  ctx.fillStyle = spec.base;
  ctx.fillRect(0, 0, SIZE, SIZE);

  for (let r = 0; r < rows; r++) {
    const y = r * rowH;
    // Butt joints sit on a circle so the tile still wraps: the plank crossing u = 0 is
    // one plank drawn as two pieces, which keeps the repeat seamless while the joints
    // stagger from row to row.
    const n = 2 + Math.floor(rnd(r, 1) * 2);
    const phase = rnd(r, 2);
    const cuts = Array.from({ length: n }, (_, k) => ((k / n + phase + (rnd(r * 7 + k, 3) - 0.5) / (n * 2)) % 1) * SIZE).sort((a, b) => a - b);

    for (let k = 0; k < n; k++) {
      const u0 = cuts[k]!, u1 = cuts[(k + 1) % n]!;
      const t = rnd(r * 13 + k, 4);
      const hue = spec.hue + t * spec.hueSpread;
      const sat = spec.sat + rnd(r * 13 + k, 5) * spec.satSpread;
      const light = spec.light + t * spec.lightSpread;
      ctx.fillStyle = `hsl(${hue} ${sat}% ${light}%)`;
      fillSpan(ctx, u0, u1, y, rowH);
    }

    // Grain runs the full width so it wraps whatever the joints do. Many fine strokes read
    // as timber; a handful of thick ones read as a painted-on pattern, so the count is high
    // and the alpha low.
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, y, SIZE, rowH);
    ctx.clip();
    for (let s = 0; s < 16; s++) {
      const sy = y + rowH * (0.06 + 0.88 * rnd(r * 31 + s, 6));
      const dark = rnd(r * 31 + s, 7) > 0.45;
      ctx.strokeStyle = dark ? 'rgba(60,38,20,0.09)' : 'rgba(255,236,206,0.08)';
      ctx.lineWidth = 0.6 + rnd(r * 31 + s, 8) * 1.6;
      ctx.beginPath();
      ctx.moveTo(0, sy);
      for (let x = 0; x <= SIZE; x += 32) {
        // A whole number of periods keeps the wobble continuous across the wrap.
        ctx.lineTo(x, sy + Math.sin((x / SIZE) * Math.PI * 4 + s) * rowH * 0.05);
      }
      ctx.stroke();
    }
    // A soft lengthwise wash per row, so no two boards catch the light identically.
    const tint = rnd(r, 9);
    const wash = ctx.createLinearGradient(0, y, SIZE, y);
    wash.addColorStop(0, `rgba(255,244,224,${0.02 + tint * 0.03})`);
    wash.addColorStop(0.5, 'rgba(255,244,224,0)');
    wash.addColorStop(1, `rgba(52,34,18,${0.02 + tint * 0.03})`);
    ctx.fillStyle = wash;
    ctx.fillRect(0, y, SIZE, rowH);
    ctx.restore();

    // Butt joints, then the seam between this row and the next.
    ctx.fillStyle = `rgba(48,30,16,${spec.joint})`;
    for (const c of cuts) ctx.fillRect(c - 1, y, 2, rowH);
    ctx.fillStyle = `rgba(44,28,14,${spec.joint * 0.93})`;
    ctx.fillRect(0, y + rowH - 2, SIZE, 2);
    ctx.fillStyle = 'rgba(255,240,214,0.16)';
    ctx.fillRect(0, y, SIZE, 1.5);
  }
  return canvas;
}

/** A 4×4 grid of 30 cm porcelain tiles with a grout line and a little per-tile variation. */
function drawTiles(): HTMLCanvasElement | null {
  const made = newCanvas();
  if (!made) return null;
  const { canvas, ctx } = made;

  const n = 4;
  const cell = SIZE / n;
  const grout = SIZE * 0.008;
  ctx.fillStyle = '#9ea6ab';
  ctx.fillRect(0, 0, SIZE, SIZE);

  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const t = rnd(r * 17 + c, 11);
      ctx.fillStyle = `hsl(${200 + t * 14} ${5 + t * 5}% ${78 + t * 8}%)`;
      ctx.fillRect(c * cell + grout / 2, r * cell + grout / 2, cell - grout, cell - grout);
      // A soft diagonal streak keeps a large tile floor from reading as flat paint.
      ctx.save();
      ctx.beginPath();
      ctx.rect(c * cell + grout / 2, r * cell + grout / 2, cell - grout, cell - grout);
      ctx.clip();
      ctx.strokeStyle = `rgba(255,255,255,${0.06 + t * 0.06})`;
      ctx.lineWidth = cell * 0.18;
      ctx.beginPath();
      ctx.moveTo(c * cell - cell * 0.1, (r + 1) * cell);
      ctx.lineTo((c + 1) * cell, r * cell - cell * 0.1);
      ctx.stroke();
      ctx.restore();
    }
  }
  return canvas;
}

const cache = new Map<FloorFinish, THREE.CanvasTexture | null>();

/**
 * The floor texture for one finish, drawn once and shared.
 *
 * Returns null when there is no `document` (the vitest node environment imports these
 * modules), so callers fall back to a flat color.
 */
export function makeFloorTexture(finish: FloorFinish): THREE.CanvasTexture | null {
  const hit = cache.get(finish);
  if (hit !== undefined) return hit;
  const canvas = finish === 'tile' ? drawTiles() : drawPlanks(PLANKS[finish]);
  if (!canvas) { cache.set(finish, null); return null; }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  cache.set(finish, tex);
  return tex;
}

/** The flat color a finish falls back to when no canvas is available. */
export const FLOOR_FALLBACK: Record<FloorFinish, string> = {
  oak: '#c8b79a', walnut: '#6b4a32', ash: '#d6c6ac', grey: '#9a9a99', tile: '#cfd6da',
};

/*
 * Furniture-scale detail maps.
 *
 * The floor above is one big surface that wants a metre-accurate tile. These three are the
 * opposite: they are what stops a sofa reading as a coloured box, so they are drawn small,
 * kept very low in contrast, and mapped straight onto a part's own 0..1 UVs. One repeat per
 * face means an oak table top and an oak leg both wear a full sheet of grain, which is what a
 * veneered panel actually looks like, and it means no per-mesh texture state to keep in sync.
 *
 * Each is cached by the exact hex it is drawn in. The catalog paints from twenty-two named
 * finishes, so the caches settle at a few dozen entries; the limit is only there to stop a
 * colour picker dragged through a thousand hues from filling GPU memory.
 */
const DETAIL = 256;
const CACHE_LIMIT = 96;

function newDetail(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = DETAIL;
  const ctx = canvas.getContext('2d');
  return ctx ? { canvas, ctx } : null;
}

/** Wrap a finished canvas as a repeating sRGB texture. */
function detailTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Shared plumbing for the three per-hex caches: draw once, hand the same texture back after. */
function cached(
  cache: Map<string, THREE.CanvasTexture | null>,
  hex: string,
  draw: (ctx: CanvasRenderingContext2D) => void,
): THREE.CanvasTexture | null {
  const key = hex.toLowerCase();
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  if (cache.size >= CACHE_LIMIT) return null;
  const made = newDetail();
  if (!made) { cache.set(key, null); return null; }
  made.ctx.fillStyle = key;
  made.ctx.fillRect(0, 0, DETAIL, DETAIL);
  draw(made.ctx);
  const tex = detailTexture(made.canvas);
  cache.set(key, tex);
  return tex;
}

const woodCache = new Map<string, THREE.CanvasTexture | null>();
const fabricCache = new Map<string, THREE.CanvasTexture | null>();
const plasterCache = new Map<string, THREE.CanvasTexture | null>();

/**
 * Wood grain in one finish: fine lengthwise figure with a couple of open pores.
 *
 * Held to roughly two to three percent either side of the base colour. Above that it stops
 * reading as timber and starts reading as a wood-effect sticker.
 */
export function makeWoodTexture(hex: string): THREE.CanvasTexture | null {
  return cached(woodCache, hex, (ctx) => {
    for (let i = 0; i < 90; i++) {
      const y = rnd(i, 41) * DETAIL;
      const dark = rnd(i, 42) > 0.42;
      ctx.strokeStyle = dark ? 'rgba(46,28,12,0.05)' : 'rgba(255,246,228,0.045)';
      ctx.lineWidth = 0.5 + rnd(i, 43) * 1.4;
      ctx.beginPath();
      ctx.moveTo(0, y);
      // Whole periods, so the figure meets itself at the wrap.
      for (let x = 0; x <= DETAIL; x += 16) ctx.lineTo(x, y + Math.sin((x / DETAIL) * Math.PI * 2 * 2 + i) * 3.5);
      ctx.stroke();
    }
    // Two cathedral figures: the wider arcs a flat-sawn board shows.
    for (let k = 0; k < 2; k++) {
      const y = (0.3 + 0.4 * k) * DETAIL;
      ctx.strokeStyle = 'rgba(46,28,12,0.055)';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= DETAIL; x += 8) ctx.lineTo(x, y + Math.sin((x / DETAIL) * Math.PI * 2 + k * 2) * 10);
      ctx.stroke();
    }
  });
}

/**
 * A woven cloth in one finish: a plain over-and-under weave, softened by a little slub.
 *
 * The threads are drawn at two pixels so a cushion carries a visible tooth up close and
 * dissolves into an even matte from across the room.
 */
export function makeFabricTexture(hex: string): THREE.CanvasTexture | null {
  return cached(fabricCache, hex, (ctx) => {
    const pitch = 4;
    for (let i = 0; i * pitch < DETAIL; i++) {
      const u = i * pitch;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.045)';
      ctx.fillRect(u, 0, 2, DETAIL);
      ctx.fillStyle = i % 2 === 0 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.04)';
      ctx.fillRect(0, u, DETAIL, 2);
    }
    // Slub: the thicker threads any real weave has, scattered but repeatable.
    for (let i = 0; i < 130; i++) {
      const x = Math.floor(rnd(i, 51) * (DETAIL / pitch)) * pitch;
      const y = rnd(i, 52) * DETAIL;
      ctx.fillStyle = rnd(i, 53) > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
      ctx.fillRect(x, y, 2, 4 + rnd(i, 54) * 8);
    }
  });
}

/**
 * Painted plaster in one wall colour: fine roll texture, nothing more.
 *
 * A wall is the largest flat thing on screen and the one most obviously fake when it is a
 * single flat value. The speckle is barely above one percent, which is enough for the sun to
 * find something to graze.
 */
export function makePlasterTexture(hex: string): THREE.CanvasTexture | null {
  const tex = cached(plasterCache, hex, (ctx) => {
    for (let i = 0; i < 1600; i++) {
      const x = rnd(i, 61) * DETAIL, y = rnd(i, 62) * DETAIL;
      ctx.fillStyle = rnd(i, 63) > 0.5 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.03)';
      ctx.fillRect(x, y, 1 + rnd(i, 64) * 1.6, 1 + rnd(i, 65) * 1.6);
    }
  });
  // Walls are metres across; a single sheet stretched over one would blur to nothing.
  if (tex) tex.repeat.set(6, 4);
  return tex;
}

let groundFade: THREE.CanvasTexture | null | undefined;

/**
 * The soft pool of light the room stands in.
 *
 * Without it the floor ends at a hard rectangle and the room reads as a cutout floating in
 * front of the background. One radial gradient, drawn once, sitting a millimetre under the
 * floor and spilling well past it — light rather than shade, because a shadow on a near-black
 * backdrop is a shadow nobody can see.
 */
export function makeGroundFadeTexture(): THREE.CanvasTexture | null {
  if (groundFade !== undefined) return groundFade;
  const made = newCanvas();
  if (!made) { groundFade = null; return null; }
  const { canvas, ctx } = made;
  const half = SIZE / 2;
  const g = ctx.createRadialGradient(half, half, SIZE * 0.14, half, half, half);
  g.addColorStop(0, 'rgba(255,255,255,0.14)');
  g.addColorStop(0.42, 'rgba(255,255,255,0.05)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, SIZE, SIZE);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  groundFade = tex;
  return tex;
}
