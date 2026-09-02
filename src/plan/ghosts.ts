// src/plan/ghosts.ts
import type { PlacedItem, Proposal, Rect, Room, Rotation } from '../engine/types';
import { findCatalogItem } from '../engine/catalog';
import { footprint } from '../engine/geometry';

export interface Ghost {
  proposalId: string; opIndex: number; kind: 'place' | 'move' | 'swap' | 'remove';
  rect: Rect; x: number; y: number; rotation: Rotation; catalogId: string; label: string; color: string; itemId?: string;
}

export function ghostsFor(room: Room, proposals: Proposal[], hoveredId: string | null): Ghost[] {
  const out: Ghost[] = [];
  for (const p of proposals) {
    if (hoveredId && p.id !== hoveredId) continue;
    const scratch = new Map<string, PlacedItem>(room.items.map((i) => [i.id, { ...i }]));
    p.ops.forEach((op, opIndex) => {
      const push = (kind: Ghost['kind'], item: PlacedItem) => {
        const cat = findCatalogItem(room, item.catalogId);
        if (!cat) return;
        out.push({ proposalId: p.id, opIndex, kind, rect: footprint(item, cat), x: item.x, y: item.y, rotation: item.rotation, catalogId: item.catalogId, label: cat.name, color: cat.color, itemId: item.id });
      };
      switch (op.type) {
        case 'place': scratch.set(op.item.id, { ...op.item }); push('place', op.item); break;
        case 'move': { const it = scratch.get(op.id); if (!it) return; const moved = { ...it, x: op.x, y: op.y, rotation: op.rotation }; scratch.set(op.id, moved); push('move', moved); break; }
        case 'swap': { const it = scratch.get(op.id); if (!it) return; const swapped = { ...it, catalogId: op.catalogId }; scratch.set(op.id, swapped); push('swap', swapped); break; }
        case 'remove': { const it = scratch.get(op.id); if (!it) return; push('remove', it); scratch.delete(op.id); break; }
        default: return;
      }
    });
  }
  return out;
}
