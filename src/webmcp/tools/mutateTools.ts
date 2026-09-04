// src/webmcp/tools/mutateTools.ts
import type { ToolDef } from '../registry';
import { ok, fail, parseResult, type ToolResult } from '../results';
import { COORDS_NOTE, HEX_COLOR, boolProp, categoryProp, cm, floorFinishProp, hexColorProp, idProp, intProp, numProp, placementSchema, rotationProp, strProp, wallProp } from '../schemas';
import type { ToolContext } from './context';
import { itemsSummary, roomSummary, shortMetrics, shortViolations } from './context';
import { placementsToOps, type Placement } from './placements';
import type { Category, Clearance, FloorFinish, Op, PlacedItem, Room, RoomKind, Rotation, Shape, Wall } from '../../engine/types';
import { ROOM_KINDS } from '../../engine/types';
import { TEMPLATES } from '../../engine/templates';
import { findCatalogItem } from '../../engine/catalog';
import { newId } from '../../engine/ids';
import { itemViolations } from '../../engine/validate';
import { BLOCKING_KINDS, nearestValid } from '../../engine/nearest';
import { snapToWall } from '../../engine/anchors';
import { describeOps } from '../../engine/ops';
import { metricsDelta } from '../../engine/metrics';
import { CAMERA_PRESETS, cameraPreset, itemsInView, type CameraPreset } from '../../engine/camera';
import { suggestPalettes, type Palette } from '../../engine/palette';

type PaletteName = Palette['name'];
/** The three schemes `suggest_palette` returns, and so the three `apply_palette` accepts. */
const PALETTE_NAMES: PaletteName[] = ['warm', 'cool', 'neutral'];

/**
 * The single write path for every mutating tool.
 *
 * Result shape, uniform across all mutating tools so an agent learns one set of key names:
 * every result carries `status`, `violations` and `metrics`, and applied results also carry
 * `items` and `ledgerId`. `propose_layout` is the one tool that answers `proposed` instead,
 * with `proposalId` and `delta`, and its ghosts wait on the plan for the user. Individual
 * tools may add keys on top of that (`place_item` and `move_item` add `snapped`, and `wall`
 * when it is true).
 */
export function mutate(ctx: ToolContext, args: { tool: string; ops: Op[]; summary?: string }): ToolResult {
  const s = ctx.store.getState();
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

/** Smallest and largest room side `create_room` accepts, matching the new-room dialog. */
const MIN_SIDE = 100;
const MAX_SIDE = 3000;

export function buildMutateTools(ctx: ToolContext): ToolDef[] {
  const state = () => ctx.store.getState();
  const room = () => state().current();
  const num = (i: Record<string, unknown>, k: string) => i[k] as number;

  /**
   * The result for a tool that changes which room is current, or creates one.
   *
   * Switching rooms writes no ledger entry — there is nothing to undo, and the ledger belongs
   * to a room rather than to the session — so these results carry `violations` and `metrics`
   * from the analysis as it stands, alongside the full summary of the room now in front of the user.
   */
  const appliedRoom = (extra: Record<string, unknown> = {}) => {
    const s = state();
    return ok({ status: 'applied', ...extra, room: roomSummary(ctx.store), violations: shortViolations(s.analysis.violations), metrics: shortMetrics(s.analysis.metrics) });
  };

  return [
    {
      name: 'set_room_shell',
      description: 'Set the room dimensions in cm and optionally which wall faces north. Existing items are kept and re-validated.',
      inputSchema: { type: 'object', properties: { width: cm('Room width (x)'), depth: cm('Room depth (y)'), height: cm('Ceiling height'), northWall: wallProp }, required: ['width', 'depth', 'height'] },
      execute: (i) => mutate(ctx, { tool: 'set_room_shell', ops: [{ type: 'setShell', width: num(i, 'width'), depth: num(i, 'depth'), height: num(i, 'height'), northWall: (i['northWall'] as Wall | undefined) ?? room().northWall }] }),
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
        return mutate(ctx, { tool: 'add_opening', ops: [{ type: 'addOpening', opening }] });
      },
    },
    {
      name: 'remove_opening',
      description: 'Remove a door or window by id (ids come from get_room).',
      inputSchema: { type: 'object', properties: { id: idProp('Opening id') }, required: ['id'] },
      execute: (i) => mutate(ctx, { tool: 'remove_opening', ops: [{ type: 'removeOpening', id: i['id'] as string }] }),
    },
    {
      name: 'move_opening',
      description: 'Move a door or window along its wall, or to another wall, by id (ids come from get_room). offset is measured from the left end of the top/bottom walls or the top end of the left/right walls. It must stay within the wall and clear of other openings. A door that is a doorway between two rooms cannot be moved this way: remove_doorway and cut_doorway instead.',
      inputSchema: { type: 'object', properties: { id: idProp('Opening id'), offset: cm('New distance along the wall'), wall: { ...wallProp, description: 'Wall to carry it to; defaults to the wall it is on' } }, required: ['id', 'offset'] },
      execute: (i) => {
        const o = room().openings.find((x) => x.id === i['id']);
        if (!o) return fail('not_found', 'Call get_room for opening ids');
        return mutate(ctx, { tool: 'move_opening', ops: [{ type: 'moveOpening', id: o.id, wall: (i['wall'] as Wall | undefined) ?? o.wall, offset: num(i, 'offset') }] });
      },
    },
    {
      name: 'set_brief',
      description: 'Update the design brief: budget in USD, needs (short phrases) and free-text notes. Omitted fields are kept.',
      inputSchema: { type: 'object', properties: { budget: numProp('Budget in USD', 0), needs: { type: 'array', description: 'What the room must support', items: strProp('Need') }, notes: strProp('Free text') } },
      execute: (i) => {
        const b = room().brief;
        return mutate(ctx, { tool: 'set_brief', ops: [{ type: 'setBrief', brief: { budget: (i['budget'] as number | undefined) ?? b.budget, currency: 'USD', needs: (i['needs'] as string[] | undefined) ?? b.needs, notes: (i['notes'] as string | undefined) ?? b.notes } }] });
      },
    },
    {
      name: 'place_item',
      description: `Place one catalog item by its center. Applies immediately; undo_last_action takes it back. and reports any violations plus the nearest clear position. Prefer suggest_positions for beds, desks, sofas, wardrobes and shelves. Positions within 15 cm of a wall are snapped flush and wall furniture is turned to face the room; the result reports snapped: true. ${COORDS_NOTE}`,
      inputSchema: { type: 'object', properties: { catalogId: idProp('Catalog id from get_catalog'), x: cm('Center x'), y: cm('Center y'), rotation: rotationProp }, required: ['catalogId', 'x', 'y'] },
      execute: (i) => {
        const catalogId = i['catalogId'] as string;
        if (!findCatalogItem(room(), catalogId)) return fail('invalid_input', `Unknown catalogId ${catalogId}; call get_catalog`);
        const snap = snapPlacement(room(), catalogId, num(i, 'x'), num(i, 'y'), (i['rotation'] as Rotation | undefined) ?? 0);
        const item = { id: newId('item'), catalogId, x: snap.x, y: snap.y, rotation: snap.rotation, locked: false };
        const r = withSuggestion(mutate(ctx, { tool: 'place_item', ops: [{ type: 'place', item }] }), ctx, item.id);
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
        const r = withSuggestion(mutate(ctx, { tool: 'move_item', ops: [{ type: 'move', id, x: snap.x, y: snap.y, rotation: snap.rotation }] }), ctx, id);
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
        return withSuggestion(mutate(ctx, { tool: 'rotate_item', ops: [{ type: 'move', id, x: cur.x, y: cur.y, rotation: i['rotation'] as Rotation }] }), ctx, id);
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
          tool: 'fix_item', summary: `Moved ${name} to the nearest clear spot`,
          ops: [{ type: 'move', id, x: near.x, y: near.y, rotation: cur.rotation }],
        });
      },
    },
    {
      name: 'remove_item',
      description: 'Remove an item from the room. Locked items cannot be removed.',
      inputSchema: { type: 'object', properties: { id: idProp('Item id') }, required: ['id'] },
      execute: (i) => mutate(ctx, { tool: 'remove_item', ops: [{ type: 'remove', id: i['id'] as string }] }),
    },
    {
      name: 'clear_items',
      description: 'Empty the room in one ledger entry, so a single undo puts everything back. Locked items are left where they are; the result lists what remains. Ask the user before calling it on a room they have worked on.',
      inputSchema: { type: 'object', properties: {} },
      execute: () => {
        const all = room().items;
        const loose = all.filter((x) => !x.locked);
        if (loose.length === 0) return fail('nothing_to_clear', all.length ? 'Every item is locked; unlock one with set_item_locked first' : 'The room is already empty');
        return mutate(ctx, {
          tool: 'clear_items', summary: `Cleared ${loose.length} item${loose.length === 1 ? '' : 's'}`,
          ops: loose.map((x) => ({ type: 'remove', id: x.id })),
        });
      },
    },
    {
      name: 'swap_item',
      description: 'Replace an item with a different catalog item, keeping its position and rotation. Useful for cheaper or smaller alternatives.',
      inputSchema: { type: 'object', properties: { id: idProp('Item id'), catalogId: idProp('Replacement catalog id') }, required: ['id', 'catalogId'] },
      execute: (i) => withSuggestion(mutate(ctx, { tool: 'swap_item', ops: [{ type: 'swap', id: i['id'] as string, catalogId: i['catalogId'] as string }] }), ctx, i['id'] as string),
    },
    {
      name: 'set_item_locked',
      description: 'Lock an item so nobody can move, swap or remove it (for example when the user says "keep the sofa"), or unlock it.',
      inputSchema: { type: 'object', properties: { id: idProp('Item id'), locked: boolProp('true to lock') }, required: ['id', 'locked'] },
      execute: (i) => mutate(ctx, { tool: 'set_item_locked', ops: [{ type: 'setLocked', id: i['id'] as string, locked: i['locked'] as boolean }] }),
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
        const r = mutate(ctx, { tool: 'add_catalog_item', ops: [{ type: 'addCatalogItem', item }] });
        const payload = JSON.parse(r.content[0]!.text) as Record<string, unknown>;
        return payload['ok'] ? ok({ ...payload, catalogId: id }) : r;
      },
    },
    {
      name: 'load_template',
      description: `Start a new room from a ready-made layout; use list_templates for keys. The room is created, furnished, switched to and returned. It never replaces the current room, and it applies straight away rather than becoming a proposal. ${COORDS_NOTE}`,
      inputSchema: {
        type: 'object',
        properties: { key: { type: 'string', description: 'Template key from list_templates', enum: TEMPLATES.map((t) => t.key) }, name: strProp('Name for the new room, defaults to the template name') },
        required: ['key'],
      },
      execute: (i) => {
        const key = i['key'] as RoomKind;
        if (!TEMPLATES.some((t) => t.key === key)) return fail('invalid_input', `Unknown template ${String(i['key'])}; call list_templates`);
        const name = i['name'] as string | undefined;
        state().loadTemplate(key, name);
        return ok({ status: 'applied', template: key, room: roomSummary(ctx.store) });
      },
    },
    {
      name: 'create_room',
      description: `Create a new empty room and switch to it. The current room is kept and can be returned to with switch_room. Sides must be between ${MIN_SIDE} and ${MAX_SIDE} cm. Creating a room writes no ledger entry, so the result reports status "applied" with the new room's own violations and metrics. Use load_template instead to start from a furnished layout.`,
      inputSchema: { type: 'object', properties: { name: strProp('Room name'), width: cm('Room width (x)'), depth: cm('Room depth (y)'), height: cm('Ceiling height'), northWall: wallProp }, required: ['name', 'width', 'depth', 'height'] },
      execute: (i) => {
        const name = typeof i['name'] === 'string' ? i['name'].trim() : '';
        if (!name) return fail('invalid_input', 'Give the room a name');
        const dims = { width: num(i, 'width'), depth: num(i, 'depth'), height: num(i, 'height') };
        for (const [k, v] of Object.entries(dims)) {
          if (!Number.isFinite(v) || v < MIN_SIDE || v > MAX_SIDE) return fail('invalid_input', `${k} must be between ${MIN_SIDE} and ${MAX_SIDE} cm`);
        }
        state().createRoom({ name, ...dims });
        // The new room always faces north from the top wall, so a different northWall is a
        // change to a room that now exists — a setShell op, and the one ledger entry this makes.
        if (i['northWall'] !== undefined) {
          const r = mutate(ctx, { tool: 'create_room', ops: [{ type: 'setShell', ...dims, northWall: i['northWall'] as Wall }] });
          const payload = parseResult(r);
          if (payload['ok'] !== true) return r;
          return appliedRoom({ ledgerId: payload['ledgerId'] });
        }
        return appliedRoom();
      },
    },
    {
      name: 'switch_room',
      description: 'Make another room the current one, so get_room and every editing tool acts on it. Ids come from list_rooms. Nothing is lost: the room you leave keeps its items and its ledger. Writes no ledger entry, so the result reports status "applied" with the arriving room\'s violations and metrics.',
      inputSchema: { type: 'object', properties: { id: idProp('Room id from list_rooms') }, required: ['id'] },
      execute: (i) => {
        const id = i['id'] as string;
        if (!state().rooms[id]) return fail('not_found', 'Call list_rooms for current room ids');
        state().switchRoom(id);
        return appliedRoom();
      },
    },
    {
      name: 'rename_room',
      description: 'Rename the current room. Writes no ledger entry, so the result reports status "applied" with the room\'s violations and metrics as they stand.',
      inputSchema: { type: 'object', properties: { name: strProp('New room name') }, required: ['name'] },
      execute: (i) => {
        const name = typeof i['name'] === 'string' ? i['name'].trim() : '';
        if (!name) return fail('invalid_input', 'Give the room a name');
        state().renameRoom(name);
        return appliedRoom();
      },
    },
    {
      name: 'delete_room',
      description: 'Delete a room and everything in it, including its ledger. This cannot be undone, so confirm with the user first. The last remaining room cannot be deleted. Writes no ledger entry, so the result reports status "applied" with the room that is current afterwards.',
      inputSchema: { type: 'object', properties: { id: idProp('Room id from list_rooms') }, required: ['id'] },
      execute: (i) => {
        const id = i['id'] as string;
        const s = state();
        if (!s.rooms[id]) return fail('not_found', 'Call list_rooms for current room ids');
        if (Object.keys(s.rooms).length === 1) return fail('last_room', 'Create another room first');
        s.deleteRoom(id);
        return appliedRoom({ deleted: id });
      },
    },
    {
      name: 'set_item_color',
      description: 'Repaint one placed item in one of the alternative finishes get_catalog lists under `colors`, or pass null (or omit color) to put it back to its catalog color. Use it to carry out a scheme from suggest_palette.',
      inputSchema: {
        type: 'object',
        properties: { id: idProp('Item id'), color: { ...hexColorProp('New color'), nullable: true } },
        required: ['id'],
      },
      execute: (i) => {
        const id = i['id'] as string;
        const raw = i['color'];
        // Omitting the field and sending null both mean "back to the catalog color", so an agent
        // whose host cannot express null is not stuck with the override.
        if (raw !== undefined && raw !== null && typeof raw !== 'string') return fail('invalid_input', 'color must be a hex string like #aabbcc, or null');
        const color = raw === undefined || raw === null ? null : raw;
        if (color !== null && !HEX_COLOR.test(color)) return fail('invalid_input', `${color} is not a hex color like #aabbcc`);
        if (!room().items.some((x) => x.id === id)) return fail('not_found', 'Call get_room for current ids');
        return mutate(ctx, { tool: 'set_item_color', ops: [{ type: 'recolor', id, color }] });
      },
    },
    {
      name: 'set_finish',
      description: 'Paint the walls and lay the floor: wall takes a hex color, floor one of oak, walnut, ash, grey or tile. Omitted fields keep what the room has. Applies straight away in both views.',
      inputSchema: { type: 'object', properties: { wall: hexColorProp('Wall color'), floor: floorFinishProp } },
      execute: (i) => {
        const cur = room().finish;
        const wall = (i['wall'] as string | undefined) ?? cur.wall;
        const floor = (i['floor'] as FloorFinish | undefined) ?? cur.floor;
        if (i['wall'] === undefined && i['floor'] === undefined) return fail('invalid_input', 'Give wall, floor or both');
        if (!HEX_COLOR.test(wall)) return fail('invalid_input', `${wall} is not a hex color like #aabbcc`);
        const r = mutate(ctx, { tool: 'set_finish', ops: [{ type: 'setFinish', finish: { wall, floor } }] });
        return withExtras(r, { finish: { wall, floor } });
      },
    },
    {
      name: 'apply_palette',
      description: 'Carry out one of the schemes suggest_palette offers, in one ledger entry: the wall color, the floor finish and every item recolor together. Call suggest_palette first if the user should see the three options before you pick. Applies straight away rather than becoming a proposal, because color is easy to change back.',
      inputSchema: { type: 'object', properties: { name: { type: 'string', description: 'Which scheme from suggest_palette', enum: [...PALETTE_NAMES] } }, required: ['name'] },
      execute: (i) => {
        const name = i['name'] as PaletteName;
        if (!PALETTE_NAMES.includes(name)) return fail('invalid_input', `name must be one of ${PALETTE_NAMES.join(', ')}`);
        const scheme = suggestPalettes(room()).find((p) => p.name === name);
        if (!scheme) return fail('not_found', `No ${name} palette for this room; call suggest_palette`);
        const ops: Op[] = [
          { type: 'setFinish', finish: { wall: scheme.wall, floor: scheme.floor } },
          ...scheme.recolor.map((r) => ({ type: 'recolor' as const, id: r.id, color: r.color })),
        ];
        const r = mutate(ctx, { tool: 'apply_palette', summary: `Applied ${name} palette`, ops });
        return withExtras(r, { palette: { name, wall: scheme.wall, floor: scheme.floor, accents: scheme.accents, recolored: scheme.recolor.length } });
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
      name: 'apply_layout',
      description: `Apply a whole layout at once: places, moves, removes and swaps in the order given, as a single ledger entry, so one undo takes the whole idea back. Use propose_layout instead when the user should choose between options, and evaluate_layout first to check the result before anyone sees it. ${COORDS_NOTE}`,
      inputSchema: { type: 'object', properties: { placements: placementSchema }, required: ['placements'] },
      execute: (i) => {
        const mapped = placementsToOps(room(), i['placements'] as Placement[]);
        if (!mapped.ok) return fail(mapped.error, mapped.hint);
        if (mapped.ops.length === 0) return fail('invalid_input', 'placements: give at least one change');
        return mutate(ctx, { tool: 'apply_layout', summary: `Applied layout (${mapped.ops.length} changes)`, ops: mapped.ops });
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
    {
      name: 'revert_to_entry',
      description: 'Rewind the room to how it stood just after one ledger entry, undoing everything after it in one go. Ids come from get_ledger. The rewind is itself recorded, so it can be undone in turn.',
      inputSchema: { type: 'object', properties: { ledgerId: idProp('Ledger entry id from get_ledger') }, required: ['ledgerId'] },
      execute: (i) => {
        const id = i['ledgerId'] as string;
        const ledger = room().ledger;
        const idx = ledger.findIndex((e) => e.id === id);
        // `revertTo` answers null for both a missing entry and the newest one, so the two are
        // told apart here: one means the agent has a stale id, the other that there is nothing to do.
        if (idx < 0) return fail('not_found', 'Call get_ledger for current entry ids');
        if (idx === ledger.length - 1) return fail('nothing_to_revert', 'That is already the newest entry; use undo_last_action to go back further');
        const r = state().revertTo(id, 'agent');
        if (!r) return fail('nothing_to_revert', 'Nothing recorded after that entry');
        if (!r.ok) return fail(r.error, r.error === 'locked' ? 'A locked item stands in the way; ask the user to unlock it' : r.message);
        return ok({ status: 'applied', ledgerId: r.entry.id, summary: r.entry.summary, violations: shortViolations(r.analysis.violations), metrics: shortMetrics(r.analysis.metrics), items: itemsSummary(state().current(), r.analysis) });
      },
    },
    {
      name: 'select_item',
      description: 'Select an item so the user sees it highlighted on the plan and in 3D with its properties open, or pass null to clear the selection. Use it to point at what you are talking about. Selecting also turns on the selection-scoped tools (move_selected, replace_selected, remove_selected, find_alternatives_for_selected). Writes no ledger entry, so the result reports status "applied" with the room\'s violations and metrics as they stand.',
      inputSchema: { type: 'object', properties: { id: { ...idProp('Item id, or null to clear the selection'), nullable: true } } },
      execute: (i) => {
        const raw = i['id'];
        // Omitting the field and sending null both mean "clear it", so an agent whose host
        // cannot express null can still deselect.
        if (raw !== undefined && raw !== null && typeof raw !== 'string') return fail('invalid_input', 'id must be an item id string, or null to clear the selection');
        const id = raw === undefined || raw === null ? null : raw;
        if (id !== null && !room().items.some((x) => x.id === id)) return fail('not_found', 'Call get_room for current ids');
        state().select(id);
        const s = state();
        const selected = id === null ? null : itemsSummary(s.current(), s.analysis).find((x) => x.id === id) ?? null;
        return ok({ status: 'applied', selected, violations: shortViolations(s.analysis.violations), metrics: shortMetrics(s.analysis.metrics) });
      },
    },
    {
      name: 'set_view',
      description: 'Turn the daylight tint and the 3D shadows on or off. Switch the tint off when the user wants to read the plan itself, and the shadows off when the 3D view is slow. Omitted fields keep what is set. Writes no ledger entry, so the result reports status "applied" with the room\'s violations and metrics as they stand.',
      inputSchema: { type: 'object', properties: { showDaylight: boolProp('Draw the daylight tint over the plan'), showShadows: boolProp('Cast and catch shadows in the 3D view') } },
      execute: (i) => {
        if (i['showDaylight'] === undefined && i['showShadows'] === undefined) return fail('invalid_input', 'Give showDaylight, showShadows or both');
        if (i['showDaylight'] !== undefined) state().setShowDaylight(i['showDaylight'] as boolean);
        if (i['showShadows'] !== undefined) state().setShowShadows(i['showShadows'] as boolean);
        const s = state();
        return ok({ status: 'applied', showDaylight: s.ui.showDaylight, showShadows: s.ui.showShadows, violations: shortViolations(s.analysis.violations), metrics: shortMetrics(s.analysis.metrics) });
      },
    },
  ];
}
