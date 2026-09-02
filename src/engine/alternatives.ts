// src/engine/alternatives.ts
import type { Room } from './types';
import { catalogFor, findCatalogItem } from './catalog';
import { itemViolations } from './validate';
import { BLOCKING_KINDS } from './nearest';

export function alternativesFor(room: Room, itemId: string, maxPrice?: number) {
  const item = room.items.find((i) => i.id === itemId);
  const cat = item && findCatalogItem(room, item.catalogId);
  if (!item || !cat) return [];
  return catalogFor(room)
    .filter((c) => c.category === cat.category && c.id !== cat.id)
    .filter((c) => maxPrice === undefined || c.price <= maxPrice)
    .map((c) => {
      const probe = { ...item, catalogId: c.id };
      const fits = itemViolations(room, probe).every((v) => !BLOCKING_KINDS.has(v.kind));
      return { catalogId: c.id, name: c.name, price: c.price, width: c.width, depth: c.depth, height: c.height, fits };
    })
    .sort((a, b) => Number(b.fits) - Number(a.fits) || a.price - b.price)
    .slice(0, 10);
}
