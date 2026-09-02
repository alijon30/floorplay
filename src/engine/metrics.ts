// src/engine/metrics.ts
import type { Daylight, Metrics, Room, Violation } from './types';
import { CELL } from './types';
import { gridDims, largestFreeRegion, occupancy } from './grid';
import { budgetUsed } from './validate';
import type { Reach } from './reach';

export function computeMetrics(room: Room, violations: Violation[], daylight: Daylight, reach: Reach): Metrics {
  const { cols, rows } = gridDims(room);
  const occ = occupancy(room);
  let blocked = 0;
  for (const v of occ) if (v) blocked++;
  const total = cols * rows;
  const used = budgetUsed(room);
  return {
    freeFloorPct: Math.round(((total - blocked) / total) * 100),
    openAreaCm2: largestFreeRegion(occ, cols, rows) * CELL * CELL,
    minWalkwayCm: reach.minWalkwayCm,
    budgetUsed: used,
    budgetRemaining: room.brief.budget - used,
    lightByItem: daylight.lightByItem,
    violationCount: violations.length,
  };
}

export function metricsDelta(before: Metrics, after: Metrics): Record<string, { before: number; after: number }> {
  const keys: (keyof Metrics)[] = ['freeFloorPct', 'openAreaCm2', 'minWalkwayCm', 'budgetUsed', 'budgetRemaining', 'violationCount'];
  const out: Record<string, { before: number; after: number }> = {};
  for (const k of keys) {
    const b = before[k] as number;
    const a = after[k] as number;
    if (a !== b) out[k] = { before: b, after: a };
  }
  return out;
}
