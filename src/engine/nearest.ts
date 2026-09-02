// src/engine/nearest.ts
import type { Room, Rotation, ViolationKind } from './types';
import { findCatalogItem } from './catalog';
import { itemViolations } from './validate';

export const BLOCKING_KINDS: ReadonlySet<ViolationKind> = new Set<ViolationKind>(['out_of_bounds', 'overlap', 'blocks_door', 'blocks_window', 'clearance']);

export function nearestValid(room: Room, catalogId: string, x: number, y: number, rotation: Rotation, exceptId?: string): { x: number; y: number } | null {
  if (!findCatalogItem(room, catalogId)) return null;
  const others = room.items.filter((i) => i.id !== exceptId);
  const ok = (px: number, py: number) =>
    itemViolations(room, { id: '__probe', catalogId, x: px, y: py, rotation, locked: false }, others).every((v) => !BLOCKING_KINDS.has(v.kind));
  if (ok(x, y)) return { x, y };
  for (let radius = 5; radius <= 200; radius += 5) {
    for (let dx = -radius; dx <= radius; dx += 5) {
      for (const dy of [-radius, radius]) if (ok(x + dx, y + dy)) return { x: x + dx, y: y + dy };
    }
    for (let dy = -radius + 5; dy <= radius - 5; dy += 5) {
      for (const dx of [-radius, radius]) if (ok(x + dx, y + dy)) return { x: x + dx, y: y + dy };
    }
  }
  return null;
}
