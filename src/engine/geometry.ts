// src/engine/geometry.ts
import type { CatalogItem, ClearanceGroup, Opening, PlacedItem, Rect, RoomShell, Rotation, Wall } from './types';
import { DOOR_APPROACH_CM, WALLS } from './types';

export function rotatedDims(cat: CatalogItem, rotation: Rotation): { w: number; h: number } {
  return rotation === 90 || rotation === 270 ? { w: cat.depth, h: cat.width } : { w: cat.width, h: cat.depth };
}

export function footprint(item: PlacedItem, cat: CatalogItem): Rect {
  const { w, h } = rotatedDims(cat, item.rotation);
  return { x: item.x - w / 2, y: item.y - h / 2, w, h };
}

export function intersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function intersection(a: Rect, b: Rect): Rect | null {
  if (!intersects(a, b)) return null;
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  return { x, y, w: Math.min(a.x + a.w, b.x + b.w) - x, h: Math.min(a.y + a.h, b.y + b.h) - y };
}

export function containsRect(outer: Rect, inner: Rect): boolean {
  return inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.w <= outer.x + outer.w && inner.y + inner.h <= outer.y + outer.h;
}

export function expandRect(r: Rect, by: number): Rect {
  return { x: r.x - by, y: r.y - by, w: r.w + 2 * by, h: r.h + 2 * by };
}

/** Rotate a rect given in item-local coordinates (origin at item center, rotation 0) clockwise by `rotation`. */
function rotateLocalRect(r: Rect, rotation: Rotation): Rect {
  const corners = [
    [r.x, r.y],
    [r.x + r.w, r.y + r.h],
  ].map(([x, y]) => {
    switch (rotation) {
      case 0: return [x!, y!];
      case 90: return [-y!, x!];
      case 180: return [-x!, -y!];
      case 270: return [y!, -x!];
    }
  });
  const xs = corners.map((c) => c[0]!);
  const ys = corners.map((c) => c[1]!);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

export function clearanceGroups(item: PlacedItem, cat: CatalogItem): ClearanceGroup[] {
  const w = cat.width;
  const d = cat.depth;
  const c = cat.clearance;
  const local: ClearanceGroup[] = [];
  if (c.front) local.push({ label: 'front', mode: 'all', cm: c.front, rects: [{ x: -w / 2, y: d / 2, w, h: c.front }] });
  if (c.back) local.push({ label: 'back', mode: 'all', cm: c.back, rects: [{ x: -w / 2, y: -d / 2 - c.back, w, h: c.back }] });
  if (c.left) local.push({ label: 'left', mode: 'all', cm: c.left, rects: [{ x: -w / 2 - c.left, y: -d / 2, w: c.left, h: d }] });
  if (c.right) local.push({ label: 'right', mode: 'all', cm: c.right, rects: [{ x: w / 2, y: -d / 2, w: c.right, h: d }] });
  if (c.anyLongSide) {
    const s = c.anyLongSide;
    const rects: Rect[] = w >= d
      ? [{ x: -w / 2, y: -d / 2 - s, w, h: s }, { x: -w / 2, y: d / 2, w, h: s }]
      : [{ x: -w / 2 - s, y: -d / 2, w: s, h: d }, { x: w / 2, y: -d / 2, w: s, h: d }];
    local.push({ label: 'one long side', mode: 'any', cm: s, rects });
  }
  return local.map((g) => ({
    ...g,
    rects: g.rects.map((r) => {
      const rr = rotateLocalRect(r, item.rotation);
      return { x: rr.x + item.x, y: rr.y + item.y, w: rr.w, h: rr.h };
    }),
  }));
}

export function openingSpan(room: RoomShell, o: Opening, depth: number): Rect {
  switch (o.wall) {
    case 'top': return { x: o.offset, y: 0, w: o.width, h: depth };
    case 'bottom': return { x: o.offset, y: room.depth - depth, w: o.width, h: depth };
    case 'left': return { x: 0, y: o.offset, w: depth, h: o.width };
    case 'right': return { x: room.width - depth, y: o.offset, w: depth, h: o.width };
  }
}

export function doorZones(room: RoomShell, o: Opening): { swing: Rect | null; approach: Rect } {
  const swing = o.swing === 'out' ? null : openingSpan(room, o, o.width);
  return { swing, approach: openingSpan(room, o, DOOR_APPROACH_CM) };
}

export function doorInsidePoint(room: RoomShell, o: Opening): { x: number; y: number } {
  const mid = o.offset + o.width / 2;
  switch (o.wall) {
    case 'top': return { x: mid, y: 15 };
    case 'bottom': return { x: mid, y: room.depth - 15 };
    case 'left': return { x: 15, y: mid };
    case 'right': return { x: room.width - 15, y: mid };
  }
}

export function wallFacing(wall: Wall, northWall: Wall): number {
  return ((WALLS.indexOf(wall) - WALLS.indexOf(northWall)) * 90 + 360) % 360;
}

export function frontVector(rotation: Rotation): { dx: number; dy: number } {
  switch (rotation) {
    case 0: return { dx: 0, dy: 1 };
    case 90: return { dx: -1, dy: 0 };
    case 180: return { dx: 0, dy: -1 };
    case 270: return { dx: 1, dy: 0 };
  }
}

export function pointInRect(x: number, y: number, r: Rect): boolean {
  return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
}

export function rectArea(r: Rect): number { return r.w * r.h; }
