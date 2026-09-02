// src/webmcp/tools/context.ts
import type { Analysis, CatalogItem, Metrics, Room, Violation } from '../../engine/types';
import type { RoomStore } from '../../store/roomStore';
import { findCatalogItem } from '../../engine/catalog';
import { rotatedDims, wallFacing } from '../../engine/geometry';
import { metricsDelta } from '../../engine/metrics';

export interface ToolContext { store: RoomStore }

const round2 = (n: number) => Math.round(n * 100) / 100;

export function shortMetrics(m: Metrics) {
  return { freeFloorPct: m.freeFloorPct, openAreaCm2: m.openAreaCm2, minWalkwayCm: m.minWalkwayCm, budgetUsed: m.budgetUsed, budgetRemaining: m.budgetRemaining, violationCount: m.violationCount };
}

export function shortViolations(v: Violation[]) {
  return v.map((x) => ({ kind: x.kind, itemIds: x.itemIds, message: x.message }));
}

export function itemsSummary(room: Room, analysis: Analysis) {
  return room.items.map((i) => {
    const c = findCatalogItem(room, i.catalogId);
    const dims = c ? rotatedDims(c, i.rotation) : { w: 0, h: 0 };
    return {
      id: i.id, catalogId: i.catalogId, name: c?.name ?? i.catalogId, category: c?.category ?? 'other',
      x: i.x, y: i.y, rotation: i.rotation, w: dims.w, d: dims.h, height: c?.height ?? 0, price: c?.price ?? 0,
      locked: i.locked, light: round2(analysis.metrics.lightByItem[i.id] ?? 0),
    };
  });
}

export function catalogEntry(c: CatalogItem) {
  return {
    id: c.id, name: c.name, category: c.category, width: c.width, depth: c.depth, height: c.height, price: c.price,
    clearance: c.clearance, blocksLight: c.blocksLight, source: c.source, rooms: c.rooms,
    ...(c.colors ? { colors: c.colors } : {}),
    // Present only on wall-mounted items, where it is also the signal that the item hangs.
    ...(c.mountHeight !== undefined ? { mountHeight: c.mountHeight } : {}),
    ...(c.url ? { url: c.url } : {}),
  };
}

export function roomSummary(store: RoomStore) {
  const s = store.getState();
  const room = s.current();
  const a = s.analysis;
  return {
    room: {
      id: room.id, name: room.name, width: room.width, depth: room.depth, height: room.height, northWall: room.northWall, daylightHour: room.daylightHour,
      openings: room.openings.map((o) => ({ id: o.id, kind: o.kind, wall: o.wall, offset: o.offset, width: o.width, height: o.height, ...(o.sill !== undefined ? { sill: o.sill } : {}), ...(o.swing ? { swing: o.swing } : {}), facing: wallFacing(o.wall, room.northWall) })),
    },
    brief: room.brief,
    items: itemsSummary(room, a),
    selection: s.ui.selectedItemId,
    proposeFirst: s.ui.proposeFirst,
    proposals: room.proposals.map((p) => ({ id: p.id, label: p.label, changes: p.ops.length, delta: metricsDelta(p.metricsBefore, p.metricsAfter), violationsAfter: p.violationsAfter.length })),
    metrics: shortMetrics(a.metrics),
    violations: shortViolations(a.violations),
  };
}
