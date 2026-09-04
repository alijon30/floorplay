// src/webmcp/tools/readTools.ts
import type { ToolDef } from '../registry';
import { ok, fail } from '../results';
import { COORDS_NOTE, categoryProp, cm, idProp, intProp, numProp, placementSchema, roomKindProp, strProp } from '../schemas';
import type { ToolContext } from './context';
import { catalogEntry, roomSummary, shortMetrics, shortViolations } from './context';
import { placementsToOps, type Placement } from './placements';
import { catalogFor, findCatalogItem } from '../../engine/catalog';
import { evaluateOps } from '../../engine/evaluate';
import { metricsDelta } from '../../engine/metrics';
import { bestSpots, computeDaylight, sunAzimuth } from '../../engine/daylight';
import { suggestPositions, type Near } from '../../engine/anchors';
import { TEMPLATES } from '../../engine/templates';
import { suggestPalettes } from '../../engine/palette';
import { suggestFurniture } from '../../engine/furniture';
import type { RoomKind } from '../../engine/types';

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
      description: 'List furniture available to place, with dimensions in cm, price in USD, clearance rules, the room kinds each item suits, its alternative `colors` and, for wall-mounted things, the `mountHeight` it hangs at. Filter by category, room kind, maximum footprint, maximum price or a name query. Items added with add_catalog_item are included. Returns at most 60 items, cheapest first; narrow the filters if `truncated` is true.',
      inputSchema: {
        type: 'object',
        properties: { category: categoryProp, room: roomKindProp, maxWidth: cm('Maximum width'), maxDepth: cm('Maximum depth'), maxPrice: numProp('Maximum price in USD'), query: strProp('Case-insensitive substring of the name or category') },
      },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: (input) => {
        const room = state().current();
        const q = typeof input['query'] === 'string' ? (input['query'] as string).toLowerCase() : null;
        const matches = catalogFor(room)
          .filter((c) => !input['category'] || c.category === input['category'])
          .filter((c) => !input['room'] || c.rooms.includes(input['room'] as RoomKind))
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
      name: 'list_templates',
      description: 'Ready-made rooms you can start from, with their key, dimensions, item count and budget. Call this before load_template to learn the keys.',
      inputSchema: { type: 'object', properties: {} },
      annotations: { readOnlyHint: true },
      execute: () => ok({
        templates: TEMPLATES.map((t) => ({
          key: t.key, name: t.name, blurb: t.blurb, width: t.width, depth: t.depth, height: t.height,
          items: t.items.length, budget: t.brief.budget,
        })),
      }),
    },
    {
      name: 'suggest_palette',
      description: 'Three color schemes for the current room, warm, cool and neutral, derived from what is already in it. Each returns a wall color, a floor finish, three accent tones and the exact set_item_color changes that would carry it out. Use it when the user asks how the room could look, then apply one with set_finish and set_item_color.',
      inputSchema: { type: 'object', properties: {} },
      annotations: { readOnlyHint: true },
      execute: () => ok({ palettes: suggestPalettes(state().current()) }),
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
    {
      name: 'suggest_furniture',
      description: 'Turn the brief into a priced shopping list that fits the room and the budget: which catalog items cover each need (sleep, work, host, storage, dine, read, kids, kitchen, hall), the total, what remains, needs that could not be met, and cheaper or pricier alternatives per pick. Call it before propose_layout so the budget shapes the layout. Defaults to the room brief; pass budget or needs to explore.',
      inputSchema: { type: 'object', properties: { budget: numProp('Budget in USD; defaults to the brief', 0), needs: { type: 'array', description: 'Needs to cover; defaults to the brief', items: strProp('Need, e.g. "work from home"') } } },
      annotations: { readOnlyHint: true },
      execute: (input) => {
        const room = state().current();
        const plan = suggestFurniture(room, { ...(input['budget'] !== undefined ? { budget: input['budget'] as number } : {}), ...(input['needs'] !== undefined ? { needs: input['needs'] as string[] } : {}) });
        return ok({ budget: (input['budget'] as number | undefined) ?? room.brief.budget, ...plan });
      },
    },
    {
      name: 'list_rooms',
      description: 'Every room in this session, with its id, dimensions in cm and item count. The one flagged `current: true` is what get_room and every editing tool acts on. Use it before switch_room, delete_room or when the user names a room you have not seen.',
      inputSchema: { type: 'object', properties: {} },
      annotations: { readOnlyHint: true },
      execute: () => {
        const s = state();
        return ok({
          rooms: Object.values(s.rooms).map((r) => ({
            id: r.id, name: r.name, width: r.width, depth: r.depth, height: r.height,
            items: r.items.length, current: r.id === s.currentId,
          })),
        });
      },
    },
    {
      name: 'get_guide',
      description: 'How to design a room with these tools: the recommended order of calls, the coordinate conventions, and the habits that avoid rework. Call it once at the start of a design task.',
      inputSchema: { type: 'object', properties: {} },
      annotations: { readOnlyHint: true },
      execute: () => ok({
        workflow: [
          '1. get_room — read the shell, openings, brief, what is already placed, metrics and violations before changing anything.',
          '2. suggest_furniture and suggest_positions — turn the brief and budget into a priced list, then ask where each large piece wants to go.',
          '3. evaluate_layout — score a candidate set of changes privately and iterate on it, without the user seeing half-finished work.',
          '4. propose_layout — call it once per option, with a short distinct label, so the user sees the choices side by side as ghosts with a metrics delta.',
          '5. Wait for the user to accept on screen, or call apply_proposal when they name the one they want. Do not apply on their behalf before they choose.',
          '6. fix_item and suggest_palette — clear whatever violations remain, then offer a color scheme once the layout has settled.',
        ],
        conventions: COORDS_NOTE,
        tips: [
          'Proposals: propose_layout puts options on the plan as ghosts for the user to accept or reject; every other editing tool applies at once and undo_last_action takes it back. When the user is choosing rather than instructing, propose rather than apply.',
          'Wall snapping: place_item and move_item pull a position within 15 cm of a wall flush against it and turn wall furniture to face the room. The result reports `snapped` and the wall, so trust that over your own arithmetic.',
          'Selection-scoped tools: when the user selects an item, move_selected, replace_selected, remove_selected and find_alternatives_for_selected appear and act on it with no id. Use select_item to point the user at what you are discussing.',
          'Every editing result carries `violations` and `metrics`. Read them and act: call fix_item on a blocking violation rather than reporting it and moving on.',
          'Batch related changes. apply_layout and propose_layout write one ledger entry, so a single undo or revert_to_entry takes the whole idea back.',
        ],
      }),
    },
  ];
}
