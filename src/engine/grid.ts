// src/engine/grid.ts
import type { Rect, Room, RoomShell } from './types';
import { CELL } from './types';
import { findCatalogItem } from './catalog';
import { footprint } from './geometry';

export function gridDims(room: RoomShell): { cols: number; rows: number } {
  return { cols: Math.ceil(room.width / CELL), rows: Math.ceil(room.depth / CELL) };
}

export function rectCells(r: Rect, cols: number, rows: number): number[] {
  const c0 = Math.max(0, Math.floor(r.x / CELL));
  const c1 = Math.min(cols - 1, Math.ceil((r.x + r.w) / CELL) - 1);
  const r0 = Math.max(0, Math.floor(r.y / CELL));
  const r1 = Math.min(rows - 1, Math.ceil((r.y + r.h) / CELL) - 1);
  const out: number[] = [];
  for (let rr = r0; rr <= r1; rr++) for (let cc = c0; cc <= c1; cc++) out.push(rr * cols + cc);
  return out;
}

export function cellIndex(x: number, y: number, cols: number, rows: number): number | null {
  const c = Math.floor(x / CELL);
  const r = Math.floor(y / CELL);
  if (c < 0 || r < 0 || c >= cols || r >= rows) return null;
  return r * cols + c;
}

export function occupancy(room: Room, opts: { exceptId?: string } = {}): Uint8Array {
  const { cols, rows } = gridDims(room);
  const occ = new Uint8Array(cols * rows);
  for (const item of room.items) {
    if (item.id === opts.exceptId) continue;
    const cat = findCatalogItem(room, item.catalogId);
    if (!cat || cat.category === 'rug') continue;
    for (const i of rectCells(footprint(item, cat), cols, rows)) occ[i] = 1;
  }
  return occ;
}

export function dilate(occ: Uint8Array, cols: number, rows: number, r: number): Uint8Array {
  if (r === 0) return occ.slice();
  const out = new Uint8Array(occ.length);
  for (let i = 0; i < occ.length; i++) {
    if (!occ[i]) continue;
    const c = i % cols;
    const rr = (i - c) / cols;
    for (let dy = -r; dy <= r; dy++) {
      const y = rr + dy;
      if (y < 0 || y >= rows) continue;
      for (let dx = -r; dx <= r; dx++) {
        const x = c + dx;
        if (x < 0 || x >= cols) continue;
        out[y * cols + x] = 1;
      }
    }
  }
  return out;
}

export function flood(occ: Uint8Array, cols: number, rows: number, start: number): Uint8Array {
  const reached = new Uint8Array(occ.length);
  if (occ[start]) return reached;
  const stack = [start];
  reached[start] = 1;
  while (stack.length) {
    const i = stack.pop()!;
    const c = i % cols;
    const r = (i - c) / cols;
    const next = [
      c > 0 ? i - 1 : -1,
      c < cols - 1 ? i + 1 : -1,
      r > 0 ? i - cols : -1,
      r < rows - 1 ? i + cols : -1,
    ];
    for (const n of next) {
      if (n < 0 || reached[n] || occ[n]) continue;
      reached[n] = 1;
      stack.push(n);
    }
  }
  return reached;
}

export function largestFreeRegion(occ: Uint8Array, cols: number, rows: number): number {
  const seen = new Uint8Array(occ.length);
  let best = 0;
  for (let i = 0; i < occ.length; i++) {
    if (occ[i] || seen[i]) continue;
    const reached = flood(occ, cols, rows, i);
    let count = 0;
    for (let j = 0; j < reached.length; j++) if (reached[j]) { seen[j] = 1; count++; }
    best = Math.max(best, count);
  }
  return best;
}
