// src/engine/ops.ts
import type { Op, Opening, PlacedItem, Purchase, Room, RoomFinish, RoomShell, Wall } from './types';
import { FLOOR_FINISHES, PURCHASE_STATUSES, WALLS } from './types';
import { catalogFor, findCatalogItem } from './catalog';

export type ApplyResult =
  | { ok: true; room: Room; inverse: Op[] }
  | { ok: false; error: 'locked' | 'not_found' | 'invalid'; message: string; itemId?: string };

type OneResult = { ok: true; room: Room; inverse: Op[] } | Exclude<ApplyResult, { ok: true }>;

function fail(error: 'locked' | 'not_found' | 'invalid', message: string, itemId?: string): OneResult {
  return itemId ? { ok: false, error, message, itemId } : { ok: false, error, message };
}

/** Insert `x` at index `at`, or append when `at` is absent. Never mutates `arr`. */
function insertAt<T>(arr: readonly T[], x: T, at?: number): T[] {
  return at === undefined ? [...arr, x] : [...arr.slice(0, at), x, ...arr.slice(at)];
}

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

/**
 * Set or drop an item's color override.
 *
 * A `null` color deletes the key rather than storing `undefined`, so undoing a recolor gives
 * back an item that is deeply equal to the one before it.
 */
function withColor(item: PlacedItem, color: string | null): PlacedItem {
  if (color === null) {
    const { color: _dropped, ...rest } = item;
    return rest;
  }
  return { ...item, color };
}

/**
 * Set or drop an item's purchase record, the same way `withColor` handles a color override.
 *
 * The record is rebuilt key by key rather than spread, so an empty source or url is dropped
 * instead of stored as `undefined` and undo gives back an item deeply equal to the one before.
 */
function withPurchase(item: PlacedItem, purchase: Purchase | null): PlacedItem {
  if (purchase === null) {
    const { purchase: _dropped, ...rest } = item;
    return rest;
  }
  const clean: Purchase = {
    status: purchase.status,
    ...(purchase.source ? { source: purchase.source } : {}),
    ...(purchase.url ? { url: purchase.url } : {}),
  };
  return { ...item, purchase: clean };
}

/**
 * Whether an opening sits within its wall and clear of the others on it.
 *
 * Checked when one is moved, by hand on the plan or by the agent, so a window can never be
 * dragged off the end of the wall or through a door. `o` may be a changed copy of an opening
 * the room already has; its own id is skipped when looking for a clash.
 */
export function openingFits(room: RoomShell & { openings: Opening[] }, o: Opening): { ok: true } | { ok: false; message: string } {
  const length = o.wall === 'top' || o.wall === 'bottom' ? room.width : room.depth;
  if (o.offset < 0 || o.offset + o.width > length) {
    return { ok: false, message: `A ${o.width} cm ${o.kind} at ${o.offset} cm runs past the end of the ${o.wall} wall (${length} cm)` };
  }
  const clash = room.openings.find((x) => x.id !== o.id && x.wall === o.wall && x.offset < o.offset + o.width && x.offset + x.width > o.offset);
  if (clash) return { ok: false, message: `It would overlap the ${clash.kind} at ${clash.offset} cm on the ${o.wall} wall` };
  return { ok: true };
}

function applyOne(room: Room, op: Op): OneResult {
  switch (op.type) {
    case 'setShell': {
      if (op.width <= 0 || op.depth <= 0 || op.height <= 0) return fail('invalid', 'Room dimensions must be positive');
      const inverse: Op = { type: 'setShell', width: room.width, depth: room.depth, height: room.height, northWall: room.northWall };
      return { ok: true, room: { ...room, width: op.width, depth: op.depth, height: op.height, northWall: op.northWall }, inverse: [inverse] };
    }
    case 'addOpening': {
      if (room.openings.some((o) => o.id === op.opening.id)) return fail('invalid', `Opening ${op.opening.id} already exists`);
      return { ok: true, room: { ...room, openings: insertAt(room.openings, op.opening, op.at) }, inverse: [{ type: 'removeOpening', id: op.opening.id }] };
    }
    case 'removeOpening': {
      const at = room.openings.findIndex((x) => x.id === op.id);
      const o = room.openings[at];
      if (!o) return fail('not_found', `No opening ${op.id}`);
      return { ok: true, room: { ...room, openings: room.openings.filter((x) => x.id !== op.id) }, inverse: [{ type: 'addOpening', opening: o, at }] };
    }
    case 'moveOpening': {
      const o = room.openings.find((x) => x.id === op.id);
      if (!o) return fail('not_found', `No opening ${op.id}`);
      if (o.doorwayId) return fail('invalid', 'That door is a doorway between two rooms: remove it on the Home plan and cut it again where you want it');
      const moved: Opening = { ...o, wall: op.wall, offset: op.offset };
      const fit = openingFits(room, moved);
      if (!fit.ok) return fail('invalid', fit.message);
      return { ok: true, room: { ...room, openings: room.openings.map((x) => (x.id === op.id ? moved : x)) }, inverse: [{ type: 'moveOpening', id: op.id, wall: o.wall, offset: o.offset }] };
    }
    case 'setBrief':
      return { ok: true, room: { ...room, brief: op.brief }, inverse: [{ type: 'setBrief', brief: room.brief }] };
    case 'place': {
      if (!findCatalogItem(room, op.item.catalogId)) return fail('invalid', `Unknown catalog item ${op.item.catalogId}`);
      if (room.items.some((i) => i.id === op.item.id)) return fail('invalid', `Item ${op.item.id} already exists`);
      // `remove` refuses locked items, so a locked placement must be unlocked before it can be undone.
      const inverse: Op[] = op.item.locked
        ? [{ type: 'setLocked', id: op.item.id, locked: false }, { type: 'remove', id: op.item.id }]
        : [{ type: 'remove', id: op.item.id }];
      return { ok: true, room: { ...room, items: insertAt(room.items, { ...op.item }, op.at) }, inverse };
    }
    case 'move': {
      const item = room.items.find((i) => i.id === op.id);
      if (!item) return fail('not_found', `No item ${op.id}`);
      if (item.locked) return fail('locked', `${findCatalogItem(room, item.catalogId)?.name ?? op.id} is locked`, op.id);
      const inverse: Op = { type: 'move', id: op.id, x: item.x, y: item.y, rotation: item.rotation };
      return { ok: true, room: { ...room, items: room.items.map((i) => (i.id === op.id ? { ...i, x: op.x, y: op.y, rotation: op.rotation } : i)) }, inverse: [inverse] };
    }
    case 'remove': {
      const at = room.items.findIndex((i) => i.id === op.id);
      const item = room.items[at];
      if (!item) return fail('not_found', `No item ${op.id}`);
      if (item.locked) return fail('locked', `${findCatalogItem(room, item.catalogId)?.name ?? op.id} is locked`, op.id);
      return { ok: true, room: { ...room, items: room.items.filter((i) => i.id !== op.id) }, inverse: [{ type: 'place', item: { ...item }, at }] };
    }
    case 'swap': {
      const item = room.items.find((i) => i.id === op.id);
      if (!item) return fail('not_found', `No item ${op.id}`);
      if (item.locked) return fail('locked', `${findCatalogItem(room, item.catalogId)?.name ?? op.id} is locked`, op.id);
      if (!findCatalogItem(room, op.catalogId)) return fail('invalid', `Unknown catalog item ${op.catalogId}`);
      const inverse: Op = { type: 'swap', id: op.id, catalogId: item.catalogId };
      return { ok: true, room: { ...room, items: room.items.map((i) => (i.id === op.id ? { ...i, catalogId: op.catalogId } : i)) }, inverse: [inverse] };
    }
    case 'setLocked': {
      const item = room.items.find((i) => i.id === op.id);
      if (!item) return fail('not_found', `No item ${op.id}`);
      const inverse: Op = { type: 'setLocked', id: op.id, locked: item.locked };
      return { ok: true, room: { ...room, items: room.items.map((i) => (i.id === op.id ? { ...i, locked: op.locked } : i)) }, inverse: [inverse] };
    }
    case 'addCatalogItem': {
      if (catalogFor(room).some((c) => c.id === op.item.id)) return fail('invalid', `Catalog id ${op.item.id} already exists`);
      if (op.item.width <= 0 || op.item.depth <= 0 || op.item.height <= 0) return fail('invalid', 'Catalog dimensions must be positive');
      return { ok: true, room: { ...room, catalogExtras: insertAt(room.catalogExtras, { ...op.item, source: 'agent' }, op.at) }, inverse: [{ type: 'removeCatalogItem', id: op.item.id }] };
    }
    case 'removeCatalogItem': {
      const at = room.catalogExtras.findIndex((x) => x.id === op.id);
      const c = room.catalogExtras[at];
      if (!c) return fail('not_found', `No custom catalog item ${op.id}`);
      if (room.items.some((i) => i.catalogId === op.id)) return fail('invalid', `Catalog item ${op.id} is still placed`);
      return { ok: true, room: { ...room, catalogExtras: room.catalogExtras.filter((x) => x.id !== op.id) }, inverse: [{ type: 'addCatalogItem', item: c, at }] };
    }
    case 'recolor': {
      const item = room.items.find((i) => i.id === op.id);
      if (!item) return fail('not_found', `No item ${op.id}`);
      if (op.color !== null && !HEX.test(op.color)) return fail('invalid', `${op.color} is not a hex color like #aabbcc`);
      // A lock protects an item's place in the room, not its finish, so recoloring is allowed.
      const inverse: Op = { type: 'recolor', id: op.id, color: item.color ?? null };
      return { ok: true, room: { ...room, items: room.items.map((i) => (i.id === op.id ? withColor(i, op.color) : i)) }, inverse: [inverse] };
    }
    case 'setFinish': {
      if (!HEX.test(op.finish.wall)) return fail('invalid', `${op.finish.wall} is not a hex color like #aabbcc`);
      if (!FLOOR_FINISHES.includes(op.finish.floor)) return fail('invalid', `Unknown floor finish ${op.finish.floor}`);
      // Per-wall overrides are validated the same way the default is, and an empty map is
      // dropped rather than stored, so undoing back to "all walls the same" is deeply equal.
      const overrides = Object.entries(op.finish.walls ?? {}).filter(([, v]) => v !== undefined) as [Wall, string][];
      for (const [wall, hex] of overrides) {
        if (!WALLS.includes(wall)) return fail('invalid', `Unknown wall ${wall}`);
        if (!HEX.test(hex)) return fail('invalid', `${hex} is not a hex color like #aabbcc`);
      }
      const finish: RoomFinish = { wall: op.finish.wall, floor: op.finish.floor, ...(overrides.length ? { walls: Object.fromEntries(overrides) as Partial<Record<Wall, string>> } : {}) };
      const inverse: Op = { type: 'setFinish', finish: room.finish };
      return { ok: true, room: { ...room, finish }, inverse: [inverse] };
    }
    case 'setPurchase': {
      const item = room.items.find((i) => i.id === op.id);
      if (!item) return fail('not_found', `No item ${op.id}`);
      if (op.purchase !== null && !PURCHASE_STATUSES.includes(op.purchase.status)) {
        return fail('invalid', `Unknown purchase status ${op.purchase.status}; one of ${PURCHASE_STATUSES.join(', ')}`);
      }
      // A lock protects where a piece stands, not whether it has been bought.
      const inverse: Op = { type: 'setPurchase', id: op.id, purchase: item.purchase ?? null };
      return { ok: true, room: { ...room, items: room.items.map((i) => (i.id === op.id ? withPurchase(i, op.purchase) : i)) }, inverse: [inverse] };
    }
  }
}

export function applyOps(room: Room, ops: Op[]): ApplyResult {
  let cur = room;
  const inverse: Op[] = [];
  for (const op of ops) {
    const r = applyOne(cur, op);
    if (!r.ok) return r;
    cur = r.room;
    inverse.unshift(...r.inverse);
  }
  return { ok: true, room: cur, inverse };
}

export function describeOps(room: Room, ops: Op[]): string {
  const name = (catalogId: string) => findCatalogItem(room, catalogId)?.name ?? catalogId;
  const itemName = (id: string) => {
    const it = room.items.find((i) => i.id === id);
    return it ? name(it.catalogId) : id;
  };
  const parts = ops.map((op) => {
    switch (op.type) {
      case 'setShell': return `Room set to ${op.width}x${op.depth} cm`;
      case 'addOpening': return `Added ${op.opening.kind} on ${op.opening.wall} wall`;
      case 'removeOpening': return `Removed opening ${op.id}`;
      case 'moveOpening': return `Moved ${room.openings.find((x) => x.id === op.id)?.kind ?? 'opening'} to ${op.offset} cm on the ${op.wall} wall`;
      case 'setBrief': return `Brief updated (budget $${op.brief.budget})`;
      case 'place': return `Placed ${name(op.item.catalogId)} at (${op.item.x}, ${op.item.y})`;
      case 'move': return `Moved ${itemName(op.id)} to (${op.x}, ${op.y})`;
      case 'remove': return `Removed ${itemName(op.id)}`;
      case 'swap': return `Swapped ${itemName(op.id)} for ${name(op.catalogId)}`;
      case 'setLocked': return `${op.locked ? 'Locked' : 'Unlocked'} ${itemName(op.id)}`;
      case 'addCatalogItem': return `Added ${op.item.name} to the catalog`;
      case 'removeCatalogItem': return `Removed catalog item ${op.id}`;
      case 'recolor': return op.color === null ? `Reset the color of ${itemName(op.id)}` : `Recolored ${itemName(op.id)} to ${op.color}`;
      case 'setFinish': return `Finish set to ${op.finish.floor} floor and ${op.finish.wall} walls`;
      case 'setPurchase': return op.purchase === null ? `Cleared the buying status of ${itemName(op.id)}` : `Marked ${itemName(op.id)} ${op.purchase.status}`;
    }
  });
  return parts.length <= 2 ? parts.join('; ') : `${parts[0]} and ${parts.length - 1} more changes`;
}
