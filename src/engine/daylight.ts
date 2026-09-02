// src/engine/daylight.ts
import type { Daylight, Opening, Room, RoomShell } from './types';
import { CELL } from './types';
import { findCatalogItem, isFloorSolid } from './catalog';
import { doorZones, footprint, openingSpan, pointInRect, wallFacing } from './geometry';
import { gridDims, occupancy, rectCells } from './grid';

export function sunAzimuth(hour: number): number | null {
  if (hour < 6 || hour > 20) return null;
  return 90 + (hour - 6) * 15;
}

export function dayFactor(hour: number): number {
  if (hour <= 6 || hour >= 20) return 0;
  return Math.min(1, Math.sin((Math.PI * (hour - 6)) / 14) * 1.6);
}

export function windowIntensity(room: RoomShell, o: Opening, hour: number): number {
  const az = sunAzimuth(hour);
  if (az === null) return 0;
  const facing = wallFacing(o.wall, room.northWall);
  const diff = ((az - facing + 540) % 360) - 180;
  return Math.max(0, Math.cos((diff * Math.PI) / 180)) * dayFactor(hour);
}

function windowMidpoint(room: RoomShell, o: Opening): { x: number; y: number } {
  const s = openingSpan(room, o, 1);
  return { x: s.x + s.w / 2, y: s.y + s.h / 2 };
}

/** Diffuse skylight a window lets in regardless of where the sun is, as a share of full sun. */
const SKY = 0.3;
/** Cells this close to a window get the window's full contribution. */
const FULL_CM = 100;
/** What is left of that contribution at the far wall. */
const FAR = 0.15;

/**
 * Light per 10 cm cell, 0 to 1.
 *
 * Each window contributes a direct term (how square-on the sun hits that wall, see
 * `windowIntensity`) plus a diffuse skylight term of `SKY * dayFactor(hour)`, so a room with a
 * window is dim but never black while the sun is up, even when no window faces the sun. Both
 * terms fade with distance: full within `FULL_CM`, down to `FAR` at the far wall. Light-blocking
 * furniture between the window and the cell cuts both terms to zero, and each cell keeps the
 * brightest window rather than summing, so two windows never read brighter than full sun.
 */
export function computeDaylight(room: Room, hour: number = room.daylightHour): Daylight {
  const { cols, rows } = gridDims(room);
  const grid = new Float32Array(cols * rows);
  const blockers = room.items.flatMap((item) => {
    const cat = findCatalogItem(room, item.catalogId);
    return cat && cat.blocksLight && isFloorSolid(cat) ? [footprint(item, cat)] : [];
  });
  const sky = SKY * dayFactor(hour);
  const windows = room.openings
    .filter((o) => o.kind === 'window')
    .map((o) => ({ mid: windowMidpoint(room, o), intensity: Math.min(1, windowIntensity(room, o, hour) + sky) }))
    .filter((w) => w.intensity > 0);
  const maxDim = Math.max(room.width, room.depth);

  const clearLine = (ax: number, ay: number, bx: number, by: number): boolean => {
    const len = Math.hypot(bx - ax, by - ay);
    const steps = Math.max(1, Math.ceil(len / 5));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const px = ax + (bx - ax) * t;
      const py = ay + (by - ay) * t;
      if (blockers.some((b) => pointInRect(px, py, b))) return false;
    }
    return true;
  };

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cx = c * CELL + CELL / 2;
      const cy = r * CELL + CELL / 2;
      let best = 0;
      for (const w of windows) {
        const d = Math.hypot(cx - w.mid.x, cy - w.mid.y);
        const falloff = d <= FULL_CM ? 1 : 1 - (1 - FAR) * Math.min(1, (d - FULL_CM) / Math.max(1, maxDim - FULL_CM));
        const v = w.intensity * falloff;
        if (v <= best) continue;
        if (clearLine(w.mid.x, w.mid.y, cx, cy)) best = v;
      }
      grid[r * cols + c] = best;
    }
  }

  const lightByItem: Record<string, number> = {};
  for (const item of room.items) {
    const cat = findCatalogItem(room, item.catalogId);
    if (!cat) continue;
    const cells = rectCells(footprint(item, cat), cols, rows);
    lightByItem[item.id] = cells.length ? cells.reduce((s, i) => s + grid[i]!, 0) / cells.length : 0;
  }
  return { cellCm: 10, cols, rows, grid, lightByItem };
}

/** Brightest free cells at `hour`, at least 60 cm apart, excluding door zones. */
export function bestSpots(room: Room, hour: number, count = 5): { x: number; y: number; light: number }[] {
  const d = computeDaylight(room, hour);
  const occ = occupancy(room);
  const doorCells = new Set<number>();
  for (const o of room.openings) {
    if (o.kind !== 'door') continue;
    const z = doorZones(room, o);
    for (const rect of [z.swing, z.approach]) if (rect) for (const i of rectCells(rect, d.cols, d.rows)) doorCells.add(i);
  }
  const candidates: { x: number; y: number; light: number }[] = [];
  for (let i = 0; i < d.grid.length; i++) {
    if (occ[i] || doorCells.has(i) || d.grid[i]! <= 0) continue;
    const c = i % d.cols;
    const r = (i - c) / d.cols;
    candidates.push({ x: c * CELL + CELL / 2, y: r * CELL + CELL / 2, light: d.grid[i]! });
  }
  candidates.sort((a, b) => b.light - a.light);
  const picked: { x: number; y: number; light: number }[] = [];
  for (const cnd of candidates) {
    if (picked.every((p) => Math.hypot(p.x - cnd.x, p.y - cnd.y) >= 60)) picked.push(cnd);
    if (picked.length >= count) break;
  }
  return picked.map((p) => ({ ...p, light: Math.round(p.light * 100) / 100 }));
}
