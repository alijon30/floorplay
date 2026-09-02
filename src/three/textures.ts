// src/three/textures.ts
// Procedural textures drawn to a canvas at runtime. Nothing here is fetched, so the
// app keeps working offline and ships no binary assets.
import * as THREE from 'three';

/** Side length in meters of one plank tile. The floor repeats it room-size / this. */
export const PLANK_TILE_M = 2;
/** Plank rows per meter, so one tile holds PLANKS_PER_M * PLANK_TILE_M rows. */
const PLANKS_PER_M = 8;
const SIZE = 1024;

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

function drawPlanks(): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null; // node tests and any SSR pass
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const rows = PLANKS_PER_M * PLANK_TILE_M;
  const rowH = SIZE / rows;
  ctx.fillStyle = '#b18a5e';
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
      const hue = 26 + t * 10;
      const sat = 26 + rnd(r * 13 + k, 5) * 12;
      const light = 46 + t * 16;
      ctx.fillStyle = `hsl(${hue} ${sat}% ${light}%)`;
      fillSpan(ctx, u0, u1, y, rowH);
    }

    // Grain runs the full width so it wraps whatever the joints do.
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, y, SIZE, rowH);
    ctx.clip();
    for (let s = 0; s < 7; s++) {
      const sy = y + rowH * (0.1 + 0.8 * rnd(r * 31 + s, 6));
      const dark = rnd(r * 31 + s, 7) > 0.45;
      ctx.strokeStyle = dark ? 'rgba(60,38,20,0.16)' : 'rgba(255,236,206,0.14)';
      ctx.lineWidth = 1 + rnd(r * 31 + s, 8) * 2.5;
      ctx.beginPath();
      ctx.moveTo(0, sy);
      for (let x = 0; x <= SIZE; x += 64) {
        // A whole number of periods keeps the wobble continuous across the wrap.
        ctx.lineTo(x, sy + Math.sin((x / SIZE) * Math.PI * 4 + s) * rowH * 0.05);
      }
      ctx.stroke();
    }
    ctx.restore();

    // Butt joints, then the seam between this row and the next.
    ctx.fillStyle = 'rgba(48,30,16,0.45)';
    for (const c of cuts) ctx.fillRect(c - 1, y, 2, rowH);
    ctx.fillStyle = 'rgba(44,28,14,0.42)';
    ctx.fillRect(0, y + rowH - 2, SIZE, 2);
    ctx.fillStyle = 'rgba(255,240,214,0.16)';
    ctx.fillRect(0, y, SIZE, 1.5);
  }
  return canvas;
}

let cached: THREE.CanvasTexture | null | undefined;

/**
 * Wood plank texture for the floor, drawn once and shared. Returns null when there is no
 * `document` (the vitest node environment imports these modules), so callers fall back to
 * a flat color.
 */
export function makePlankTexture(): THREE.CanvasTexture | null {
  if (cached !== undefined) return cached;
  const canvas = drawPlanks();
  if (!canvas) { cached = null; return cached; }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  cached = tex;
  return cached;
}
