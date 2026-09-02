// src/webmcp/tools/readTools.ts
import type { ToolDef } from '../registry';
import { ok, fail } from '../results';
import { COORDS_NOTE, categoryProp, cm, idProp, intProp, numProp, placementSchema, strProp } from '../schemas';
import type { ToolContext } from './context';
import { catalogEntry, roomSummary, shortMetrics, shortViolations } from './context';
import { placementsToOps, type Placement } from './placements';
import { catalogFor, findCatalogItem } from '../../engine/catalog';
import { evaluateOps } from '../../engine/evaluate';
import { metricsDelta } from '../../engine/metrics';
import { bestSpots, computeDaylight, sunAzimuth } from '../../engine/daylight';
import { suggestPositions, type Near } from '../../engine/anchors';

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Most catalog entries returned in one get_catalog call. `count` and `truncated` describe the full match set. */
const CATALOG_PAGE = 60;

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
      description: 'List furniture available to place, with dimensions in cm, price in USD and clearance rules. Filter by category, maximum footprint, maximum price or a name query. Items added with add_catalog_item are included. Returns at most 60 items, cheapest first; narrow the filters if `truncated` is true.',
      inputSchema: {
        type: 'object',
        properties: { category: categoryProp, maxWidth: cm('Maximum width'), maxDepth: cm('Maximum depth'), maxPrice: numProp('Maximum price in USD'), query: strProp('Case-insensitive substring of the name or category') },
      },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: (input) => {
        const room = state().current();
        const q = typeof input['query'] === 'string' ? (input['query'] as string).toLowerCase() : null;
        const matches = catalogFor(room)
          .filter((c) => !input['category'] || c.category === input['category'])
          .filter((c) => input['maxWidth'] === undefined || c.width <= (input['maxWidth'] as number))
          .filter((c) => input['maxDepth'] === undefined || c.depth <= (input['maxDepth'] as number))
          .filter((c) => input['maxPrice'] === undefined || c.price <= (input['maxPrice'] as number))
          .filter((c) => !q || c.name.toLowerCase().includes(q) || c.category.includes(q))
          .sort((a, b) => a.price - b.price);
        const items = matches.slice(0, CATALOG_PAGE).map(catalogEntry);
        return ok({ count: matches.length, truncated: matches.length > CATALOG_PAGE, items });
      },
    },
    {
      name: 'suggest_positions',
      description: `Best positions for a catalog item given the room, walls, door, window and daylight. Call this before place_item for beds, desks, sofas, wardrobes and shelves. Each suggestion is a valid placement with a reason and a score. ${COORDS_NOTE}`,
      inputSchema: {
        type: 'object',
        properties: {
          catalogId: idProp('Catalog id from get_catalog'),
          near: { type: 'string', description: 'Prefer positions close to this feature', enum: ['window', 'door', 'corner', 'any'] },
          count: intProp('How many suggestions to return, default 5', 1, 10),
          hour: intProp('Hour of day used for the light score, 6 to 20. Defaults to 9', 6, 20),
        },
        required: ['catalogId'],
      },
      annotations: { readOnlyHint: true },
      execute: (input) => {
        const room = state().current();
        const catalogId = input['catalogId'] as string;
        if (!findCatalogItem(room, catalogId)) return fail('invalid_input', 'Unknown catalogId; call get_catalog');
        const suggestions = suggestPositions(room, catalogId, {
          ...(input['near'] !== undefined ? { near: input['near'] as Near } : {}),
          ...(input['count'] !== undefined ? { count: input['count'] as number } : {}),
          ...(input['hour'] !== undefined ? { hour: input['hour'] as number } : {}),
        });
        return ok({ catalogId, suggestions });
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
