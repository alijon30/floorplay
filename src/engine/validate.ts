// src/engine/validate.ts
import type { PlacedItem, Rect, Room, Rotation, Violation } from './types';
import { WINDOW_TOUCH_CM } from './types';
import { findCatalogItem } from './catalog';
import { clearanceGroups, containsRect, doorZones, footprint, intersection, intersects, openingSpan } from './geometry';

export function placeTest(room: Room, catalogId: string, x: number, y: number, rotation: Rotation = 0, id = `t_${catalogId}`): PlacedItem {
  if (!findCatalogItem(room, catalogId)) throw new Error(`unknown catalog id ${catalogId}`);
  return { id, catalogId, x, y, rotation, locked: false };
}

export function roomRect(room: Room): Rect {
  return { x: 0, y: 0, w: room.width, h: room.depth };
}

export function budgetUsed(room: Room): number {
  return room.items.reduce((sum, i) => sum + (findCatalogItem(room, i.catalogId)?.price ?? 0), 0);
}

function solidFootprints(room: Room, items: PlacedItem[]): { item: PlacedItem; rect: Rect; name: string }[] {
  const out: { item: PlacedItem; rect: Rect; name: string }[] = [];
  for (const o of items) {
    const cat = findCatalogItem(room, o.catalogId);
    if (!cat || cat.category === 'rug') continue;
    out.push({ item: o, rect: footprint(o, cat), name: cat.name });
  }
  return out;
}

export function itemViolations(room: Room, item: PlacedItem, others: PlacedItem[] = room.items.filter((i) => i.id !== item.id)): Violation[] {
  const cat = findCatalogItem(room, item.catalogId);
  if (!cat) return [];
  const fp = footprint(item, cat);
  const out: Violation[] = [];
  const bounds = roomRect(room);

  if (!containsRect(bounds, fp)) {
    out.push({ kind: 'out_of_bounds', itemIds: [item.id], message: `${cat.name} extends outside the room`, zone: fp });
  }
  if (cat.category === 'rug') return out;

  const solids = solidFootprints(room, others);
  for (const s of solids) {
    const ix = intersection(fp, s.rect);
    if (ix) out.push({ kind: 'overlap', itemIds: [item.id, s.item.id], message: `${cat.name} overlaps ${s.name}`, zone: ix });
  }

  for (const o of room.openings) {
    if (o.kind === 'door') {
      const z = doorZones(room, o);
      if (z.swing && intersects(fp, z.swing)) {
        out.push({ kind: 'blocks_door', itemIds: [item.id], message: `${cat.name} blocks the door swing`, zone: z.swing });
      } else if (intersects(fp, z.approach)) {
        out.push({ kind: 'blocks_door', itemIds: [item.id], message: `${cat.name} blocks the space in front of the door`, zone: z.approach });
      }
    } else if (cat.blocksLight) {
      const strip = openingSpan(room, o, WINDOW_TOUCH_CM);
      if (intersects(fp, strip)) out.push({ kind: 'blocks_window', itemIds: [item.id], message: `${cat.name} blocks the window`, zone: strip });
    }
  }

  for (const g of clearanceGroups(item, cat)) {
    const isClear = (r: Rect) => containsRect(bounds, r) && !solids.some((s) => intersects(r, s.rect));
    const results = g.rects.map(isClear);
    const pass = g.mode === 'all' ? results.every(Boolean) : results.some(Boolean);
    if (!pass) {
      const zone = g.mode === 'all' ? g.rects[0] : g.rects[results.indexOf(false)] ?? g.rects[0];
      out.push({ kind: 'clearance', itemIds: [item.id], message: `${cat.name} needs ${g.cm} cm clear on its ${g.label}`, zone });
    }
  }
  return out;
}

export function validateRoom(room: Room): Violation[] {
  const out: Violation[] = [];
  const seenPairs = new Set<string>();
  for (const item of room.items) {
    for (const v of itemViolations(room, item)) {
      if (v.kind === 'overlap') {
        const key = [...v.itemIds].sort().join('|');
        if (seenPairs.has(key)) continue;
        seenPairs.add(key);
      }
      out.push(v);
    }
  }
  const used = budgetUsed(room);
  if (room.brief.budget > 0 && used > room.brief.budget) {
    out.push({ kind: 'over_budget', itemIds: [], message: `Over budget by $${used - room.brief.budget}` });
  }
  return out;
}
