// src/webmcp/tools/readTools.ts
import type { ToolDef } from '../registry';
import { ok, fail } from '../results';
import { COORDS_NOTE, categoryProp, cm, intProp, numProp, placementSchema, strProp } from '../schemas';
import type { ToolContext } from './context';
import { catalogEntry, roomSummary, shortMetrics, shortViolations } from './context';
import { placementsToOps, type Placement } from './placements';
import { catalogFor, findCatalogItem } from '../../engine/catalog';
import { evaluateOps } from '../../engine/evaluate';
import { metricsDelta } from '../../engine/metrics';
import { bestSpots, computeDaylight, sunAzimuth } from '../../engine/daylight';

const round2 = (n: number) => Math.round(n * 100) / 100;

export function buildReadTools(ctx: ToolContext): ToolDef[] {
  const state = () => ctx.store.getState();
  return [
    {
      name: 'get_room',
      description: `Read the current room: shell, openings (with compass facing), brief, placed items with positions and light scores, the user's selection, open proposals, metrics and violations. ${COORDS_NOTE}`,
      inputSchema: { type: 'object', properties: {} },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: () => ok(roomSummary(ctx.store)),
    },
    {
      name: 'get_catalog',
      description: 'List furniture available to place, with dimensions in cm, price in USD and clearance rules. Filter by category, maximum footprint, maximum price or a name query. Items added with add_catalog_item are included.',
      inputSchema: {
        type: 'object',
        properties: { category: categoryProp, maxWidth: cm('Maximum width'), maxDepth: cm('Maximum depth'), maxPrice: numProp('Maximum price in USD'), query: strProp('Case-insensitive substring of the name or category') },
      },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: (input) => {
        const room = state().current();
        const q = typeof input['query'] === 'string' ? (input['query'] as string).toLowerCase() : null;
        const items = catalogFor(room)
          .filter((c) => !input['category'] || c.category === input['category'])
          .filter((c) => input['maxWidth'] === undefined || c.width <= (input['maxWidth'] as number))
          .filter((c) => input['maxDepth'] === undefined || c.depth <= (input['maxDepth'] as number))
          .filter((c) => input['maxPrice'] === undefined || c.price <= (input['maxPrice'] as number))
          .filter((c) => !q || c.name.toLowerCase().includes(q) || c.category.includes(q))
          .sort((a, b) => a.price - b.price)
          .slice(0, 60)
          .map(catalogEntry);
        return ok({ count: items.length, items });
      },
    },
    {
      name: 'evaluate_layout',
      description: `Score a candidate set of changes WITHOUT applying them. Returns metrics, violations and the delta versus the current room. Use it to iterate privately before place_item or propose_layout. ${COORDS_NOTE}`,
      inputSchema: { type: 'object', properties: { placements: placementSchema }, required: ['placements'] },
      annotations: { readOnlyHint: true },
      execute: (input) => {
        const s = state();
        const room = s.current();
        const mapped = placementsToOps(room, input['placements'] as Placement[]);
        if (!mapped.ok) return fail(mapped.error, mapped.hint);
        const ev = evaluateOps(room, mapped.ops);
        if (!ev.ok) return fail(ev.error, ev.message);
        return ok({ metrics: shortMetrics(ev.analysis.metrics), violations: shortViolations(ev.analysis.violations), delta: metricsDelta(s.analysis.metrics, ev.analysis.metrics) });
      },
    },
    {
      name: 'get_daylight',
      description: 'Approximate daylight at a given hour (6 to 20): light score 0..1 per item and the brightest free spots for morning (09:00) and afternoon (16:00). Use it to place a desk in morning light or a bed away from glare.',
      inputSchema: { type: 'object', properties: { hour: intProp('Hour of day, 6 to 20. Defaults to the current slider value', 6, 20) } },
      annotations: { readOnlyHint: true },
      execute: (input) => {
        const room = state().current();
        const hour = (input['hour'] as number | undefined) ?? room.daylightHour;
        const d = computeDaylight(room, hour);
        const items = room.items.map((i) => ({ id: i.id, name: findCatalogItem(room, i.catalogId)?.name ?? i.catalogId, light: round2(d.lightByItem[i.id] ?? 0) }));
        return ok({ hour, sunAzimuth: sunAzimuth(hour), items, bestSpots: { morning: bestSpots(room, 9, 5), afternoon: bestSpots(room, 16, 5) } });
      },
    },
    {
      name: 'get_ledger',
      description: 'Recent actions by the user and by you, newest last, with the number of violations after each.',
      inputSchema: { type: 'object', properties: { limit: intProp('How many entries, default 20', 1, 200) } },
      annotations: { readOnlyHint: true },
      execute: (input) => {
        const room = state().current();
        const limit = (input['limit'] as number | undefined) ?? 20;
        const entries = room.ledger.slice(-limit).map((e) => ({ id: e.id, at: e.at, actor: e.actor, ...(e.tool ? { tool: e.tool } : {}), summary: e.summary, violationsAfter: e.violationsAfter }));
        return ok({ entries });
      },
    },
  ];
}
