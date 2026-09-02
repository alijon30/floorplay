// src/engine/reach.ts
import type { Room } from './types';
import { CELL } from './types';
import { findCatalogItem, isFloorSolid } from './catalog';
import { doorInsidePoint, expandRect, footprint } from './geometry';
import { cellIndex, dilate, flood, gridDims, occupancy, rectCells } from './grid';

export interface Reach { unreachable: string[]; minWalkwayCm: number; hasDoor: boolean }

export function reachability(room: Room): Reach {
  const door = room.openings.find((o) => o.kind === 'door');
  const { cols, rows } = gridDims(room);
  const targets = room.items.flatMap((item) => {
    const cat = findCatalogItem(room, item.catalogId);
    return !cat || !isFloorSolid(cat) ? [] : [{ id: item.id, fp: footprint(item, cat) }];
  });
  if (!door) return { unreachable: [], minWalkwayCm: 120, hasDoor: false };

  const base = occupancy(room);
  const p = doorInsidePoint(room, door);
  const start = cellIndex(p.x, p.y, cols, rows);

  const unreachableAt = (r: number): string[] => {
    const occ = dilate(base, cols, rows, r);
    if (start === null || occ[start]) return targets.map((t) => t.id);
    const reached = flood(occ, cols, rows, start);
    return targets
      .filter((t) => {
        const own = new Set(rectCells(t.fp, cols, rows));
        const ring = rectCells(expandRect(t.fp, (r + 1) * CELL), cols, rows);
        return !ring.some((i) => !own.has(i) && reached[i]);
      })
      .map((t) => t.id);
  };

  const unreachable = unreachableAt(3);
  let minWalkwayCm = 0;
  for (const r of [6, 5, 4, 3, 2, 1, 0]) {
    if (unreachableAt(r).length === 0) { minWalkwayCm = r * 2 * CELL; break; }
  }
  return { unreachable, minWalkwayCm, hasDoor: true };
}
