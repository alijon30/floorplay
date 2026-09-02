// src/engine/scriptRunner.ts
import type { Room, Rotation } from './types';
import { catalogFor } from './catalog';
import { evaluateOps } from './evaluate';
import { nearestValid } from './nearest';
import { bestSpots } from './daylight';
import { newId } from './ids';

type Placement = { action: 'place' | 'move' | 'remove' | 'swap'; catalogId?: string; id?: string; x?: number; y?: number; rotation?: Rotation };

function toOps(room: Room, placements: Placement[]) {
  const ops = [];
  for (const p of placements) {
    if (p.action === 'place' && p.catalogId && p.x !== undefined && p.y !== undefined) ops.push({ type: 'place' as const, item: { id: p.id ?? newId('tmp'), catalogId: p.catalogId, x: p.x, y: p.y, rotation: p.rotation ?? 0, locked: false } });
    else if (p.action === 'move' && p.id && p.x !== undefined && p.y !== undefined) ops.push({ type: 'move' as const, id: p.id, x: p.x, y: p.y, rotation: p.rotation ?? (room.items.find((i) => i.id === p.id)?.rotation ?? 0) });
    else if (p.action === 'remove' && p.id) ops.push({ type: 'remove' as const, id: p.id });
    else if (p.action === 'swap' && p.id && p.catalogId) ops.push({ type: 'swap' as const, id: p.id, catalogId: p.catalogId });
  }
  return ops;
}

export function runLayoutScript(code: string, room: Room): { ok: true; placements: Placement[] } | { ok: false; error: string } {
  const api = {
    room: { width: room.width, depth: room.depth, height: room.height, northWall: room.northWall, openings: room.openings, items: room.items, brief: room.brief },
    catalog: catalogFor(room),
    evaluate(placements: Placement[]) {
      const r = evaluateOps(room, toOps(room, placements));
      if (!r.ok) return { metrics: null, violations: [{ kind: 'error', message: r.message }] };
      return { metrics: r.analysis.metrics, violations: r.analysis.violations.map((v) => ({ kind: v.kind, itemIds: v.itemIds, message: v.message })) };
    },
    nearestValid(catalogId: string, x: number, y: number, rotation: Rotation = 0) { return nearestValid(room, catalogId, x, y, rotation); },
    bestSpots(hour: number, count = 5) { return bestSpots(room, hour, count); },
  };
  try {
    const fn = new Function('api', code) as (api: unknown) => unknown;
    const result = fn(api);
    if (!Array.isArray(result)) return { ok: false, error: 'Script must return an array of placements' };
    return { ok: true, placements: result as Placement[] };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
