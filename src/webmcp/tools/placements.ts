// src/webmcp/tools/placements.ts
import type { Op, Room, Rotation } from '../../engine/types';
import { findCatalogItem } from '../../engine/catalog';
import { newId } from '../../engine/ids';

export type Placement = { action: 'place' | 'move' | 'remove' | 'swap'; catalogId?: string; id?: string; x?: number; y?: number; rotation?: Rotation };

export function placementsToOps(room: Room, placements: Placement[]): { ok: true; ops: Op[] } | { ok: false; error: string; hint: string } {
  const ops: Op[] = [];
  const known = new Map(room.items.map((i) => [i.id, i]));
  for (const [idx, p] of placements.entries()) {
    const at = `placements[${idx}]`;
    switch (p.action) {
      case 'place': {
        if (!p.catalogId || p.x === undefined || p.y === undefined) return { ok: false, error: 'invalid_input', hint: `${at}: place needs catalogId, x and y` };
        if (!findCatalogItem(room, p.catalogId)) return { ok: false, error: 'invalid_input', hint: `${at}: unknown catalogId ${p.catalogId}; call get_catalog` };
        const item = { id: p.id ?? newId('item'), catalogId: p.catalogId, x: p.x, y: p.y, rotation: p.rotation ?? 0, locked: false };
        known.set(item.id, item);
        ops.push({ type: 'place', item });
        break;
      }
      case 'move': {
        if (!p.id || p.x === undefined || p.y === undefined) return { ok: false, error: 'invalid_input', hint: `${at}: move needs id, x and y` };
        const cur = known.get(p.id);
        if (!cur) return { ok: false, error: 'not_found', hint: `${at}: no item ${p.id}; call get_room for ids` };
        ops.push({ type: 'move', id: p.id, x: p.x, y: p.y, rotation: p.rotation ?? cur.rotation });
        known.set(p.id, { ...cur, x: p.x, y: p.y, rotation: p.rotation ?? cur.rotation });
        break;
      }
      case 'remove': {
        if (!p.id) return { ok: false, error: 'invalid_input', hint: `${at}: remove needs id` };
        if (!known.has(p.id)) return { ok: false, error: 'not_found', hint: `${at}: no item ${p.id}` };
        ops.push({ type: 'remove', id: p.id });
        known.delete(p.id);
        break;
      }
      case 'swap': {
        if (!p.id || !p.catalogId) return { ok: false, error: 'invalid_input', hint: `${at}: swap needs id and catalogId` };
        if (!known.has(p.id)) return { ok: false, error: 'not_found', hint: `${at}: no item ${p.id}` };
        if (!findCatalogItem(room, p.catalogId)) return { ok: false, error: 'invalid_input', hint: `${at}: unknown catalogId ${p.catalogId}` };
        ops.push({ type: 'swap', id: p.id, catalogId: p.catalogId });
        break;
      }
    }
  }
  return { ok: true, ops };
}
