// src/webmcp/tools/mutateTools.ts
import type { ToolDef } from '../registry';
import { ok, fail, type ToolResult } from '../results';
import { COORDS_NOTE, boolProp, categoryProp, cm, idProp, intProp, numProp, placementSchema, rotationProp, strProp, wallProp } from '../schemas';
import type { ToolContext } from './context';
import { itemsSummary, shortMetrics, shortViolations } from './context';
import { placementsToOps, type Placement } from './placements';
import type { Category, Clearance, Op, PlacedItem, Room, Rotation, Shape, Wall } from '../../engine/types';
import { ROOM_KINDS } from '../../engine/types';
import { findCatalogItem } from '../../engine/catalog';
import { newId } from '../../engine/ids';
import { itemViolations } from '../../engine/validate';
import { BLOCKING_KINDS, nearestValid } from '../../engine/nearest';
import { snapToWall } from '../../engine/anchors';
import { describeOps } from '../../engine/ops';
import { metricsDelta } from '../../engine/metrics';
import { CAMERA_PRESETS, cameraPreset, itemsInView, type CameraPreset } from '../../engine/camera';

/**
 * The single write path for every mutating tool, and the one place that decides between
 * applying and proposing.
 *
 * Result shape, uniform across all mutating tools so an agent learns one set of key names:
 * every result carries `status`, `violations` and `metrics`. Applied results also carry
 * `items` and `ledgerId`; proposed results also carry `proposalId` and `delta`. On a
 * proposed result `violations` and `metrics` describe the room as it *would* be if the
 * user accepted, not the room as it stands. Individual tools may add keys on top of that
 * (`place_item` and `move_item` add `snapped`, and `wall` when it is true).
 */
export function mutate(ctx: ToolContext, args: { tool: string; ops: Op[]; summary?: string; label?: string; proposable: boolean }): ToolResult {
  const s = ctx.store.getState();
  const room = s.current();
  if (args.proposable && s.ui.proposeFirst) {
    const p = s.propose({ label: args.label ?? args.summary ?? describeOps(room, args.ops), ops: args.ops });
    if (!p.ok) return fail(p.error, p.message);
    return ok({
      status: 'proposed', proposalId: p.proposal.id, delta: metricsDelta(p.proposal.metricsBefore, p.proposal.metricsAfter),
      violations: shortViolations(p.proposal.violationsAfter), metrics: shortMetrics(p.proposal.metricsAfter),
      note: 'Propose-first mode is on. The user must accept this proposal on screen, or explicitly ask you to apply it.',
    });
  }
  const r = s.dispatch({ ops: args.ops, actor: 'agent', tool: args.tool, ...(args.summary ? { summary: args.summary } : {}) });
  if (!r.ok) {
    const hint = r.error === 'locked' ? 'Ask the user to unlock it, or work around it' : r.error === 'not_found' ? 'Call get_room for current ids' : r.message;
    return fail(r.error, hint, r.itemId ? { itemId: r.itemId } : {});
  }
  const next = ctx.store.getState();
  return ok({ status: 'applied', ledgerId: r.entry.id, violations: shortViolations(r.analysis.violations), metrics: shortMetrics(r.analysis.metrics), items: itemsSummary(next.current(), r.analysis) });
}

function withSuggestion(result: ToolResult, ctx: ToolContext, itemId: string): ToolResult {
  const payload = JSON.parse(result.content[0]!.text) as Record<string, unknown>;
  if (payload['status'] !== 'applied') return result;
  const room = ctx.store.getState().current();
  const item = room.items.find((i) => i.id === itemId);
  if (!item) return result;
  const blocking = itemViolations(room, item).filter((v) => BLOCKING_KINDS.has(v.kind));
  if (blocking.length === 0) return result;
  const near = nearestValid(room, item.catalogId, item.x, item.y, item.rotation, item.id);
  return ok({ ...payload, suggestion: near ? { ...near, note: `Placement has issues: ${blocking.map((b) => b.message).join('; ')}. Nearest clear position is (${near.x}, ${near.y}).` } : { note: 'No clear position within 200 cm; consider a smaller item or a different rotation.' } });
}

/** Extra keys on a successful mutating result, added the way `withSuggestion` adds its own. */
function withExtras(result: ToolResult, extra: Record<string, unknown>): ToolResult {
  const payload = JSON.parse(result.content[0]!.text) as Record<string, unknown>;
  if (payload['ok'] !== true) return result;
  return ok({ ...payload, ...extra });
}

/**
 * The wall snap that `place_item` and `move_item` apply to the position they were given.
 *
 * `snapToWall` only makes the axis facing the nearest wall flush and leaves the other one alone,
 * so a snap can turn a wall-backed item sideways and push its far end through another wall. The
 * snap is therefore taken only when the snapped placement stays inside the room; otherwise the
 * caller's own x, y and rotation stand and the result reports `snapped: false`.
 */
function snapPlacement(room: Room, catalogId: string, x: number, y: number, rotation: Rotation): { x: number; y: number; rotation: Rotation; snapped: boolean; wall?: Wall } {
  const s = snapToWall(room, catalogId, x, y, rotation);
  if (!s.snapped) return { x, y, rotation, snapped: false };
  const probe: PlacedItem = { id: '__snap_probe', catalogId, x: s.x, y: s.y, rotation: s.rotation, locked: false };
  // Only the room bounds decide this, so the probe is checked against no other items.
  if (itemViolations(room, probe, []).some((v) => v.kind === 'out_of_bounds')) return { x, y, rotation, snapped: false };
  return s;
}

const DEFAULT_CLEARANCE: Record<Category, Clearance> = {
  bed: { anyLongSide: 60 }, sofa: { front: 60 }, armchair: { front: 50 }, desk: { front: 90 }, chair: {}, table: { front: 60, back: 60 },
  wardrobe: { front: 60 }, shelf: { front: 40 }, dresser: { front: 60 }, nightstand: {}, rug: {}, lamp: {}, plant: {}, tv: { front: 100 },
  kitchen: { front: 60 }, appliance: { front: 60 }, storage: { front: 60 }, decor: {}, wall: {}, other: {},
};
const SHAPE_FOR: Record<Category, Shape> = {
  bed: 'bed', sofa: 'sofa', armchair: 'sofa', desk: 'desk', chair: 'chair', table: 'table', wardrobe: 'wardrobe', shelf: 'shelf',
  dresser: 'box', nightstand: 'box', rug: 'rug', lamp: 'lamp', plant: 'plant', tv: 'tv',
  kitchen: 'counter', appliance: 'appliance', storage: 'box', decor: 'pouf', wall: 'picture', other: 'box',
};
/** Categories whose items never block a window however tall they are. */
const SEE_THROUGH: Category[] = ['lamp', 'plant', 'chair', 'decor', 'wall', 'other'];

export function buildMutateTools(ctx: ToolContext): ToolDef[] {
  const state = () => ctx.store.getState();
  const room = () => state().current();
  const num = (i: Record<string, unknown>, k: string) => i[k] as number;

  return [
    {
      name: 'set_room_shell',
      description: 'Set the room dimensions in cm and optionally which wall faces north. Existing items are kept and re-validated.',
      inputSchema: { type: 'object', properties: { width: cm('Room width (x)'), depth: cm('Room depth (y)'), height: cm('Ceiling height'), northWall: wallProp }, required: ['width', 'depth', 'height'] },
      execute: (i) => mutate(ctx, { tool: 'set_room_shell', proposable: false, ops: [{ type: 'setShell', width: num(i, 'width'), depth: num(i, 'depth'), height: num(i, 'height'), northWall: (i['northWall'] as Wall | undefined) ?? room().northWall }] }),
    },
    {
      name: 'add_opening',
      description: 'Add a door or window to a wall. offset is measured from the left end of the top/bottom walls or the top end of the left/right walls. Doors default to 200 cm high swinging inward; windows default to 120 cm high with a 90 cm sill.',
      inputSchema: {
        type: 'object',
        properties: { kind: { type: 'string', description: 'door or window', enum: ['door', 'window'] }, wall: wallProp, offset: cm('Distance along the wall'), width: cm('Opening width'), height: cm('Opening height'), sill: cm('Window sill height'), swing: { type: 'string', description: 'Door swing', enum: ['in', 'out'] }, hinge: { type: 'string', description: 'Hinge side', enum: ['start', 'end'] } },
        required: ['kind', 'wall', 'offset', 'width'],
      },
      execute: (i) => {
        const kind = i['kind'] as 'door' | 'window';
        const opening = kind === 'door'
          ? { id: newId('door'), kind, wall: i['wall'] as Wall, offset: num(i, 'offset'), width: num(i, 'width'), height: (i['height'] as number | undefined) ?? 200, swing: (i['swing'] as 'in' | 'out' | undefined) ?? 'in', hinge: (i['hinge'] as 'start' | 'end' | undefined) ?? 'start' }
          : { id: newId('window'), kind, wall: i['wall'] as Wall, offset: num(i, 'offset'), width: num(i, 'width'), height: (i['height'] as number | undefined) ?? 120, sill: (i['sill'] as number | undefined) ?? 90 };
        return mutate(ctx, { tool: 'add_opening', proposable: true, ops: [{ type: 'addOpening', opening }] });
      },
    },
    {
      name: 'remove_opening',
      description: 'Remove a door or window by id (ids come from get_room).',
      inputSchema: { type: 'object', properties: { id: idProp('Opening id') }, required: ['id'] },
      execute: (i) => mutate(ctx, { tool: 'remove_opening', proposable: true, ops: [{ type: 'removeOpening', id: i['id'] as string }] }),
    },
    {
      name: 'set_brief',
      description: 'Update the design brief: budget in USD, needs (short phrases) and free-text notes. Omitted fields are kept.',
      inputSchema: { type: 'object', properties: { budget: numProp('Budget in USD', 0), needs: { type: 'array', description: 'What the room must support', items: strProp('Need') }, notes: strProp('Free text') } },
      execute: (i) => {
        const b = room().brief;
        return mutate(ctx, { tool: 'set_brief', proposable: false, ops: [{ type: 'setBrief', brief: { budget: (i['budget'] as number | undefined) ?? b.budget, currency: 'USD', needs: (i['needs'] as string[] | undefined) ?? b.needs, notes: (i['notes'] as string | undefined) ?? b.notes } }] });
      },
    },
    {
      name: 'place_item',
      description: `Place one catalog item by its center. Applies immediately (unless propose-first mode is on) and reports any violations plus the nearest clear position. Prefer suggest_positions for beds, desks, sofas, wardrobes and shelves. Positions within 15 cm of a wall are snapped flush and wall furniture is turned to face the room; the result reports snapped: true. ${COORDS_NOTE}`,
      inputSchema: { type: 'object', properties: { catalogId: idProp('Catalog id from get_catalog'), x: cm('Center x'), y: cm('Center y'), rotation: rotationProp }, required: ['catalogId', 'x', 'y'] },
      execute: (i) => {
        const catalogId = i['catalogId'] as string;
        if (!findCatalogItem(room(), catalogId)) return fail('invalid_input', `Unknown catalogId ${catalogId}; call get_catalog`);
        const snap = snapPlacement(room(), catalogId, num(i, 'x'), num(i, 'y'), (i['rotation'] as Rotation | undefined) ?? 0);
        const item = { id: newId('item'), catalogId, x: snap.x, y: snap.y, rotation: snap.rotation, locked: false };
        const r = withSuggestion(mutate(ctx, { tool: 'place_item', proposable: true, ops: [{ type: 'place', item }] }), ctx, item.id);
        return withExtras(r, { snapped: snap.snapped, ...(snap.wall ? { wall: snap.wall } : {}) });
      },
    },
    {
      name: 'move_item',
      description: `Move an existing item to a new center, optionally rotating it. Locked items cannot be moved. Prefer suggest_positions for beds, desks, sofas, wardrobes and shelves. Positions within 15 cm of a wall are snapped flush and wall furniture is turned to face the room; the result reports snapped: true. ${COORDS_NOTE}`,
      inputSchema: { type: 'object', properties: { id: idProp('Item id'), x: cm('Center x'), y: cm('Center y'), rotation: rotationProp }, required: ['id', 'x', 'y'] },
      execute: (i) => {
        const id = i['id'] as string;
        const cur = room().items.find((x) => x.id === id);
        if (!cur) return fail('not_found', 'Call get_room for current ids');
        const snap = snapPlacement(room(), cur.catalogId, num(i, 'x'), num(i, 'y'), (i['rotation'] as Rotation | undefined) ?? cur.rotation);
        const r = withSuggestion(mutate(ctx, { tool: 'move_item', proposable: true, ops: [{ type: 'move', id, x: snap.x, y: snap.y, rotation: snap.rotation }] }), ctx, id);
        return withExtras(r, { snapped: snap.snapped, ...(snap.wall ? { wall: snap.wall } : {}) });
      },
    },
    {
      name: 'rotate_item',
      description: 'Rotate an existing item in place to 0, 90, 180 or 270 degrees clockwise. At 0 the front faces the bottom wall.',
      inputSchema: { type: 'object', properties: { id: idProp('Item id'), rotation: rotationProp }, required: ['id', 'rotation'] },
      execute: (i) => {
        const id = i['id'] as string;
        const cur = room().items.find((x) => x.id === id);
        if (!cur) return fail('not_found', 'Call get_room for current ids');
        return withSuggestion(mutate(ctx, { tool: 'rotate_item', proposable: true, ops: [{ type: 'move', id, x: cur.x, y: cur.y, rotation: i['rotation'] as Rotation }] }), ctx, id);
      },
    },
    {
      name: 'fix_item',
      description: 'Move one item to the nearest position that clears its blocking violations, keeping its rotation. Use it when place_item or move_item reports an overlap, a blocked door or window, or too little clearance.',
      inputSchema: { type: 'object', properties: { id: idProp('Item id') }, required: ['id'] },
      execute: (i) => {
        const id = i['id'] as string;
        const r = room();
        const cur = r.items.find((x) => x.id === id);
        if (!cur) return fail('not_found', 'Call get_room for current ids');
        const near = nearestValid(r, cur.catalogId, cur.x, cur.y, cur.rotation, cur.id);
        if (!near) return fail('no_clear_spot', 'No clear position within 200 cm; try a smaller item or another rotation');
        if (near.x === cur.x && near.y === cur.y) return fail('already_clear', 'Item has no blocking violations');
        const name = findCatalogItem(r, cur.catalogId)?.name ?? cur.catalogId;
        return mutate(ctx, {
          tool: 'fix_item', proposable: true, summary: `Moved ${name} to the nearest clear spot`,
          ops: [{ type: 'move', id, x: near.x, y: near.y, rotation: cur.rotation }],
        });
      },
    },
    {
      name: 'remove_item',
      description: 'Remove an item from the room. Locked items cannot be removed.',
      inputSchema: { type: 'object', properties: { id: idProp('Item id') }, required: ['id'] },
      execute: (i) => mutate(ctx, { tool: 'remove_item', proposable: true, ops: [{ type: 'remove', id: i['id'] as string }] }),
    },
    {
      name: 'swap_item',
      description: 'Replace an item with a different catalog item, keeping its position and rotation. Useful for cheaper or smaller alternatives.',
      inputSchema: { type: 'object', properties: { id: idProp('Item id'), catalogId: idProp('Replacement catalog id') }, required: ['id', 'catalogId'] },
      execute: (i) => withSuggestion(mutate(ctx, { tool: 'swap_item', proposable: true, ops: [{ type: 'swap', id: i['id'] as string, catalogId: i['catalogId'] as string }] }), ctx, i['id'] as string),
    },
    {
      name: 'set_item_locked',
      description: 'Lock an item so nobody can move, swap or remove it (for example when the user says "keep the sofa"), or unlock it.',
      inputSchema: { type: 'object', properties: { id: idProp('Item id'), locked: boolProp('true to lock') }, required: ['id', 'locked'] },
      execute: (i) => mutate(ctx, { tool: 'set_item_locked', proposable: false, ops: [{ type: 'setLocked', id: i['id'] as string, locked: i['locked'] as boolean }] }),
    },
    {
      name: 'add_catalog_item',
      description: 'Add a product you researched to the catalog so it can be placed: name, category, dimensions in cm, price in USD, optional color and URL. Clearance rules are inferred from the category.',
      inputSchema: {
        type: 'object',
        properties: { name: strProp('Product name'), category: categoryProp, width: cm('Width'), depth: cm('Depth'), height: cm('Height'), price: numProp('Price in USD', 0), color: strProp('Hex color like #aabbcc'), url: strProp('Product page URL') },
        required: ['name', 'category', 'width', 'depth', 'height', 'price'],
      },
      execute: (i) => {
        const category = i['category'] as Category;
        const height = num(i, 'height');
        const id = `${(i['name'] as string).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}-${newId('c').slice(-5)}`;
        const item = {
          id, name: i['name'] as string, category, width: num(i, 'width'), depth: num(i, 'depth'), height, price: num(i, 'price'),
          color: (i['color'] as string | undefined) ?? '#9aa3ad', shape: SHAPE_FOR[category], clearance: DEFAULT_CLEARANCE[category],
          blocksLight: height > 100 && !SEE_THROUGH.includes(category), source: 'agent' as const,
          // An agent has no room-kind opinion to offer, so the item stays visible under every filter.
          rooms: [...ROOM_KINDS],
          ...(i['url'] ? { url: i['url'] as string } : {}),
        };
        const r = mutate(ctx, { tool: 'add_catalog_item', proposable: false, ops: [{ type: 'addCatalogItem', item }] });
        const payload = JSON.parse(r.content[0]!.text) as Record<string, unknown>;
        return payload['ok'] ? ok({ ...payload, catalogId: id }) : r;
      },
    },
    {
      name: 'propose_layout',
      description: `Propose a batch of changes as ghosts on the plan with a label, without applying them. The user sees a card with the metrics delta and can accept or reject. Call it several times with different labels to offer layout variants. ${COORDS_NOTE}`,
      inputSchema: { type: 'object', properties: { label: strProp('Short name for this option, e.g. "Bed by the window"'), placements: placementSchema }, required: ['label', 'placements'] },
      execute: (i) => {
        const mapped = placementsToOps(room(), i['placements'] as Placement[]);
        if (!mapped.ok) return fail(mapped.error, mapped.hint);
        const p = state().propose({ label: i['label'] as string, ops: mapped.ops });
        if (!p.ok) return fail(p.error, p.message);
        return ok({ status: 'proposed', proposalId: p.proposal.id, label: p.proposal.label, delta: metricsDelta(p.proposal.metricsBefore, p.proposal.metricsAfter), violations: shortViolations(p.proposal.violationsAfter), metrics: shortMetrics(p.proposal.metricsAfter) });
      },
    },
    {
      name: 'set_daylight_hour',
      description: 'Move the daylight time slider (6 to 20) so the user sees light at that hour in both views. Returns light per item.',
      inputSchema: { type: 'object', properties: { hour: intProp('Hour of day', 6, 20) }, required: ['hour'] },
      execute: (i) => {
        state().setDaylightHour(num(i, 'hour'));
        const s = state();
        return ok({
          status: 'applied', hour: s.current().daylightHour,
          items: itemsSummary(s.current(), s.analysis).map((x) => ({ id: x.id, name: x.name, light: x.light })),
          violations: shortViolations(s.analysis.violations), metrics: shortMetrics(s.analysis.metrics),
        });
      },
    },
    {
      name: 'set_camera',
      description: 'Move the 3D camera. Use a preset (overview, from_door, at_desk, on_bed, at_window) or give x, y and yaw (degrees clockwise, 0 faces the top wall) for a walking viewpoint at eye height. Returns the items visible from there, nearest first.',
      inputSchema: { type: 'object', properties: { preset: { type: 'string', description: 'Named viewpoint', enum: [...CAMERA_PRESETS] }, x: cm('Camera x'), y: cm('Camera y'), yaw: intProp('Yaw in degrees', 0, 359) } },
      execute: (i) => {
        if (i['preset'] !== undefined && !CAMERA_PRESETS.includes(i['preset'] as CameraPreset)) return fail('invalid_input', `preset must be one of ${CAMERA_PRESETS.join(', ')}`);
        const s = state();
        const r = s.current();
        let pose;
        if (i['preset'] !== undefined) {
          pose = cameraPreset(r, i['preset'] as CameraPreset);
          if (!pose) return fail('not_found', `Preset ${String(i['preset'])} needs an item or opening that this room does not have`);
        } else if (i['x'] !== undefined && i['y'] !== undefined && i['yaw'] !== undefined) {
          pose = { mode: 'walk' as const, x: num(i, 'x'), y: num(i, 'y'), z: 160, yaw: num(i, 'yaw'), pitch: 0 };
        } else {
          return fail('invalid_input', 'Give a preset or x, y and yaw');
        }
        s.setCamera(pose);
        const a = state().analysis;
        return ok({ status: 'applied', camera: pose, itemsInView: itemsInView(r, pose), violations: shortViolations(a.violations), metrics: shortMetrics(a.metrics) });
      },
    },
    {
      name: 'undo_last_action',
      description: 'Revert the most recent action in the ledger (yours or the user\'s). The revert is itself recorded.',
      inputSchema: { type: 'object', properties: {} },
      execute: () => {
        const r = state().undo('agent');
        if (!r) return fail('nothing_to_undo', 'The ledger is empty');
        if (!r.ok) return fail(r.error, r.message);
        return ok({ status: 'applied', ledgerId: r.entry.id, summary: r.entry.summary, violations: shortViolations(r.analysis.violations), metrics: shortMetrics(r.analysis.metrics), items: itemsSummary(state().current(), r.analysis) });
      },
    },
  ];
}
