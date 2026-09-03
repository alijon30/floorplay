// src/webmcp/tools/homeTools.ts
import type { ToolDef } from '../registry';
import { ok, fail, type ToolResult } from '../results';
import { cm, idProp, strProp, wallProp } from '../schemas';
import type { ToolContext } from './context';
import { itemsSummary, shortMetrics, shortViolations } from './context';
import {
  DOORWAY_HEIGHT, SNAP_CM, homeBounds, homeContaining, homeReachability, homeTotals,
  roomRectInHome, sharedSegments, snapRoomPlacement, type SharedSegment,
} from '../../engine/home';
import { HOME_TEMPLATES, type HomeTemplateKey } from '../../engine/homeTemplates';
import { TEMPLATES, templateFor } from '../../engine/templates';
import { WALLS, type Home, type Room, type RoomKind, type Wall } from '../../engine/types';

/**
 * The eight tools that turn a pile of rooms into a flat.
 *
 * A home is a shared floor plan: every room keeps its own coordinates, its own ledger and its
 * own analysis, and the home only says where each room's top-left corner sits on the plan and
 * which walls have been cut through. So these tools never touch furniture; they move rectangles
 * around and open holes between them, and the room tools carry on working exactly as before.
 */

/** Quoted in every description that takes an x and a y, so an agent never guesses the origin. */
const PLAN_NOTE =
  `Offsets are integer centimetres on the shared plan: x and y are the room's top-left corner, x growing right and y growing down. ` +
  `Rooms must touch edge to edge without overlapping — a placement within ${SNAP_CM} cm of a neighbour's edge is pulled flush to it, which is how two rooms come to share a wall.`;

/** Quoted on the doorway tools, where the offset is read inside one room rather than on the plan. */
const DOORWAY_NOTE =
  'A doorway needs a wall the two rooms actually share, and it is one hole in both of them: cutting it writes an opening and a ledger entry in each room, and remove_doorway takes both away again. ' +
  'offset is measured inside the room you name — from the left end of its top and bottom walls, from the top end of its left and right walls, the same ruler add_opening uses.';

/** What a doorway is cut at when the caller does not say. A comfortable interior door. */
const DEFAULT_DOORWAY_WIDTH = 80;

type Rooms = Readonly<Record<string, Room>>;

/** Shared walls in the shape a reply can quote: the neighbour by name, and the span in cm. */
function describeSegments(segs: SharedSegment[], rooms: Rooms) {
  return segs.map((s) => ({
    wall: s.wall,
    otherRoomId: s.otherRoomId,
    room: rooms[s.otherRoomId]?.name ?? s.otherRoomId,
    from: Math.round(s.start),
    to: Math.round(s.end),
  }));
}

/**
 * The whole plan in one object, returned by every tool here.
 *
 * Rooms carry their offset and their size so an agent can work out where a new one would go
 * without a second call, and `unreachable` names the rooms you cannot walk to from the front
 * door — the one thing about a home that no single room can tell you.
 */
function homeSummary(ctx: ToolContext, home: Home) {
  const s = ctx.store.getState();
  const rooms = s.rooms;
  const reach = homeReachability(home, rooms);
  const nameOf = (id: string) => rooms[id]?.name ?? id;
  return {
    id: home.id,
    name: home.name,
    rooms: home.rooms.map((p) => {
      const r = rooms[p.roomId];
      return {
        id: p.roomId, name: nameOf(p.roomId), x: p.x, y: p.y,
        width: r?.width ?? 0, depth: r?.depth ?? 0, height: r?.height ?? 0,
        items: r?.items.length ?? 0,
        current: p.roomId === s.currentId,
        entrance: p.roomId === reach.entranceRoomId,
      };
    }),
    doorways: home.doorways.map((d) => ({
      id: d.id, kind: d.kind, width: d.width, height: DOORWAY_HEIGHT,
      a: { roomId: d.a.roomId, room: nameOf(d.a.roomId), wall: d.a.wall, offset: Math.round(d.a.offset) },
      b: { roomId: d.b.roomId, room: nameOf(d.b.roomId), wall: d.b.wall, offset: Math.round(d.b.offset) },
    })),
    bounds: homeBounds(home, rooms),
    entranceRoomId: reach.entranceRoomId,
    unreachable: reach.unreachable.map((id) => ({ id, name: nameOf(id) })),
    totals: homeTotals(home, rooms),
  };
}

/**
 * Somewhere the room would actually fit, offered with the refusal rather than after it.
 *
 * The candidates are the far edges of whatever it collided with, then the far edges of the home
 * itself, which is always clear because nothing is drawn outside the bounding box. Each one goes
 * through the same snap the placement would, so the numbers handed back are the numbers that
 * would be stored.
 */
function freeSpot(home: Home, rooms: Rooms, width: number, depth: number, blocked: string[]): { x: number; y: number } {
  const b = homeBounds(home, rooms);
  const candidates: { x: number; y: number }[] = [];
  for (const id of blocked) {
    const r = roomRectInHome(home, rooms, id);
    candidates.push({ x: r.x + r.w, y: r.y }, { x: r.x, y: r.y + r.h });
  }
  candidates.push({ x: b.x + b.w, y: b.y }, { x: b.x, y: b.y + b.h });
  for (const c of candidates) {
    const s = snapRoomPlacement(home, rooms, '__probe', c.x, c.y, width, depth);
    if (s.overlaps.length === 0) return { x: s.x, y: s.y };
  }
  return { x: b.x + b.w, y: b.y };
}

/** The refusal an overlap earns: what it ran into, and a placement that would work instead. */
function overlapMessage(home: Home, rooms: Rooms, label: string, width: number, depth: number, overlaps: string[]): string {
  const names = overlaps.map((id) => rooms[id]?.name ?? id).join(', ');
  const spot = freeSpot(home, rooms, width, depth, overlaps);
  return `Overlaps ${names}; ${label} is ${width} x ${depth} cm. Try x=${spot.x}, y=${spot.y}, which snaps flush against a neighbour instead.`;
}

export function buildHomeTools(ctx: ToolContext): ToolDef[] {
  const state = () => ctx.store.getState();

  /**
   * The result every change here returns.
   *
   * `home` is the plan as it now stands, and `violations` and `metrics` describe the room the
   * user is looking at, which a home change can swap out from under them. Changes that wrote
   * ledger entries add `ledgerId` and `items` on top, through `ledgerKeys`.
   */
  const applied = (homeId: string, extra: Record<string, unknown> = {}): ToolResult => {
    const s = state();
    const home = s.homes[homeId];
    return ok({
      status: 'applied',
      ...extra,
      home: home ? homeSummary(ctx, home) : null,
      violations: shortViolations(s.analysis.violations),
      metrics: shortMetrics(s.analysis.metrics),
    });
  };

  /**
   * The uniform tail for a change that edited rooms: one ledger entry per room it touched.
   *
   * `ledgerId` is the entry in the room the user is looking at when that room was one of them,
   * so undo means what an agent expects; `ledgerEntries` names every entry either way, because
   * a doorway is two edits in two histories and only the caller knows which one it wants.
   */
  const ledgerKeys = (roomIds: string[]): Record<string, unknown> => {
    const s = state();
    const seen = new Set<string>();
    const entries = roomIds.flatMap((id) => {
      if (seen.has(id)) return [];
      seen.add(id);
      const room = s.rooms[id];
      const last = room?.ledger[room.ledger.length - 1];
      return last ? [{ roomId: id, room: room!.name, ledgerId: last.id, summary: last.summary }] : [];
    });
    const mine = entries.find((e) => e.roomId === s.currentId) ?? entries[0];
    return {
      ...(mine ? { ledgerId: mine.ledgerId } : {}),
      ...(entries.length ? { ledgerEntries: entries } : {}),
      items: itemsSummary(s.current(), s.analysis),
    };
  };

  return [
    {
      name: 'get_home',
      description:
        `The floor plan the current room stands on: every room with its offset and size, the doorways between them, the bounding box, which room the front door is in, any room you cannot walk to from it, and totals for area, items and budget. ` +
        `Read it before moving a room or cutting a doorway, so the offsets you pass are relative to the same plan. \`home\` comes back null when the current room stands on no plan. ${PLAN_NOTE}`,
      inputSchema: { type: 'object', properties: {} },
      annotations: { readOnlyHint: true },
      execute: () => {
        const home = state().currentHome();
        if (!home) {
          return ok({
            home: null,
            hint: 'create_home or add_room_to_home first; the current room is not on a floor plan, and every other tool here works on the plan the current room stands on.',
          });
        }
        return ok({ home: homeSummary(ctx, home) });
      },
    },
    {
      name: 'list_home_templates',
      description:
        'The ready-made homes create_home can build: a key, a name, a blurb, the rooms with their offsets and sizes on the shared plan, and how many doorways come already cut between them. Rooms come furnished from the room templates, so a template home is a flat you can walk through the moment it is built.',
      inputSchema: { type: 'object', properties: {} },
      annotations: { readOnlyHint: true },
      execute: () => ok({
        count: HOME_TEMPLATES.length,
        templates: HOME_TEMPLATES.map((t) => ({
          key: t.key,
          name: t.name,
          blurb: t.blurb,
          rooms: t.rooms.map((r) => {
            const rt = templateFor(r.key);
            return { template: r.key, name: r.name ?? rt.name, x: r.x, y: r.y, width: rt.width, depth: rt.depth };
          }),
          doorways: t.doorways.length,
        })),
      }),
    },
    {
      name: 'create_home',
      description:
        'Start a floor plan. With a template key from list_home_templates the rooms are built furnished, stood on the plan and joined by their doorways, and the app switches to the room the front door is in. Without one you get an empty plan to put rooms on with add_room_to_home. Existing rooms are never disturbed: a room joins a home only when you add it.',
      inputSchema: {
        type: 'object',
        properties: {
          name: strProp('Name for the home, as a person would say it: "Flat 3"'),
          template: { type: 'string', description: 'Ready-made home key from list_home_templates', enum: HOME_TEMPLATES.map((t) => t.key) },
        },
      },
      execute: (i) => {
        const name = typeof i['name'] === 'string' ? i['name'].trim() : '';
        const template = i['template'] as HomeTemplateKey | undefined;
        if (template !== undefined) {
          if (!HOME_TEMPLATES.some((t) => t.key === template)) {
            return fail('invalid_input', `Unknown home template ${String(template)}; call list_home_templates for the keys`);
          }
          const home = state().createHomeFromTemplate(template);
          if (name) state().renameHome(name);
          return applied(home.id, { template, note: 'The rooms are furnished and the doorways are cut. The current room is the one the front door opens into.' });
        }
        const home = state().createHome({ name: name || 'My home' });
        return applied(home.id, { note: 'The plan is empty. Put rooms on it with add_room_to_home, then join them with cut_doorway.' });
      },
    },
    {
      name: 'add_room_to_home',
      description:
        `Stand a room on the floor plan. Pass roomId for a room that already exists, from list_rooms, or templateKey to build a furnished one from a room template first. ` +
        `The room goes on the plan the current room stands on; when it stands on none, a plan named after it is started and it is placed at the origin, so "put a kitchen to the right of this room" works from a single room. ` +
        `${PLAN_NOTE} An overlap is refused with the room it ran into named and an offset that would work.`,
      inputSchema: {
        type: 'object',
        properties: {
          roomId: idProp('An existing room to stand on the plan, from list_rooms'),
          templateKey: { type: 'string', description: 'Build a new furnished room from this room template instead of using roomId; keys from list_templates', enum: TEMPLATES.map((t) => t.key) },
          x: cm("The room's left edge on the plan"),
          y: cm("The room's top edge on the plan"),
          name: strProp('Name for the new room, when templateKey is used. Defaults to the template name'),
        },
        required: ['x', 'y'],
      },
      execute: (i) => {
        const s0 = state();
        const roomId = i['roomId'] as string | undefined;
        const templateKey = i['templateKey'] as RoomKind | undefined;
        if ((roomId === undefined) === (templateKey === undefined)) {
          return fail('invalid_input', 'Pass roomId for a room that already exists, or templateKey to build a new one — one of the two, not both');
        }
        const x = i['x'] as number;
        const y = i['y'] as number;
        if (!Number.isFinite(x) || !Number.isFinite(y)) return fail('invalid_input', "x and y are the room's top-left corner on the plan, in cm");

        let width: number;
        let depth: number;
        let label: string;
        const wanted = typeof i['name'] === 'string' ? i['name'].trim() : '';
        if (roomId !== undefined) {
          const room = s0.rooms[roomId];
          if (!room) return fail('not_found', 'Call list_rooms for current room ids');
          const already = homeContaining(s0.homes, roomId);
          if (already) {
            return fail('conflict', `${room.name} is already on the plan of ${already.name}; move it with move_room, or take it off with remove_room_from_home first`);
          }
          width = room.width;
          depth = room.depth;
          label = room.name;
        } else {
          if (!TEMPLATES.some((t) => t.key === templateKey)) {
            return fail('invalid_input', `Unknown room template ${String(templateKey)}; call list_templates for the keys`);
          }
          const t = templateFor(templateKey!);
          width = t.width;
          depth = t.depth;
          label = wanted || t.name;
        }

        // Nothing is created until the placement is known to work, so a refused call leaves the
        // app exactly as it found it — no half-built home, no stray room from a template.
        const current = s0.current();
        const existing = s0.currentHome();
        const seedCurrent = !existing && roomId !== current.id;
        const plan: Home = existing ?? {
          id: '__prospective', name: '', doorways: [],
          rooms: seedCurrent ? [{ roomId: current.id, x: 0, y: 0 }] : [],
        };
        const snap = snapRoomPlacement(plan, s0.rooms, roomId ?? '__new_room', x, y, width, depth);
        if (snap.overlaps.length) return fail('overlap', overlapMessage(plan, s0.rooms, label, width, depth, snap.overlaps));

        const home = existing ?? state().createHome({ name: `${current.name} home` });
        if (seedCurrent) {
          const seed = state().addRoomToHome(home.id, current.id, 0, 0);
          if (!seed.ok) return fail('invalid_input', seed.error);
        }
        const placedId = templateKey !== undefined ? state().loadTemplate(templateKey, wanted || undefined).id : roomId!;
        const placed = state().addRoomToHome(home.id, placedId, x, y);
        if (!placed.ok) return fail('invalid_input', placed.error);
        return applied(home.id, {
          roomId: placedId,
          x: placed.x,
          y: placed.y,
          snapped: placed.snapped,
          ...(templateKey !== undefined ? { created: true, template: templateKey } : {}),
          ...(existing ? {} : { createdHome: home.name }),
          note: 'Rooms that touch are not joined yet. Cut a doorway through the wall they share so you can walk between them.',
        });
      },
    },
    {
      name: 'move_room',
      description:
        `Move a room to another offset on the floor plan it already stands on. ${PLAN_NOTE} An overlap is refused with the room it ran into named and an offset that would work. ` +
        'Doorways keep the offsets they were cut at, so any doorway the move pulls out of line is taken out of both rooms and named in removedDoorways; cut_doorway puts one back at the new offsets.',
      inputSchema: {
        type: 'object',
        properties: { roomId: idProp('Room id, from get_home or list_rooms'), x: cm("The room's left edge on the plan"), y: cm("The room's top edge on the plan") },
        required: ['roomId', 'x', 'y'],
      },
      execute: (i) => {
        const s0 = state();
        const roomId = i['roomId'] as string;
        const room = s0.rooms[roomId];
        if (!room) return fail('not_found', 'Call list_rooms for current room ids');
        const home = homeContaining(s0.homes, roomId);
        if (!home) return fail('not_in_home', `${room.name} is not on a floor plan; add_room_to_home puts it on one`);
        const x = i['x'] as number;
        const y = i['y'] as number;
        if (!Number.isFinite(x) || !Number.isFinite(y)) return fail('invalid_input', "x and y are the room's top-left corner on the plan, in cm");

        const snap = snapRoomPlacement(home, s0.rooms, roomId, x, y, room.width, room.depth);
        if (snap.overlaps.length) return fail('overlap', overlapMessage(home, s0.rooms, room.name, room.width, room.depth, snap.overlaps));
        const moved = state().moveRoom(roomId, x, y);
        if (!moved.ok) return fail('invalid_input', moved.error);
        const gone = moved.removedDoorways.length;
        return applied(home.id, {
          roomId, x: moved.x, y: moved.y, snapped: moved.snapped, removedDoorways: moved.removedDoorways,
          ...(gone ? { warning: `The move took ${gone} doorway${gone === 1 ? '' : 's'} with it: an opening only joins two rooms while both halves meet on the wall they share. Cut them again at the offsets ${room.name} has now.` } : {}),
        });
      },
    },
    {
      name: 'remove_room_from_home',
      description:
        'Take a room off the floor plan. The room itself survives with everything in it and can be worked on alone or added to another plan; only its place on this one goes. Its doorways go with it, which removes the matching opening from the rooms on the other side, so each of those rooms gets a ledger entry.',
      inputSchema: { type: 'object', properties: { roomId: idProp('Room id, from get_home or list_rooms') }, required: ['roomId'] },
      execute: (i) => {
        const s0 = state();
        const roomId = i['roomId'] as string;
        const room = s0.rooms[roomId];
        if (!room) return fail('not_found', 'Call list_rooms for current room ids');
        const home = homeContaining(s0.homes, roomId);
        if (!home) return fail('not_in_home', `${room.name} is not on a floor plan, so there is nothing to take it off`);
        const touched = home.doorways.filter((d) => d.a.roomId === roomId || d.b.roomId === roomId);
        const edited = [roomId, ...touched.map((d) => (d.a.roomId === roomId ? d.b.roomId : d.a.roomId))];
        if (!state().removeRoomFromHome(roomId)) return fail('not_in_home', `${room.name} is not on a floor plan`);
        return applied(home.id, {
          removed: roomId,
          doorwaysRemoved: touched.map((d) => d.id),
          ...(touched.length ? ledgerKeys(edited) : { items: itemsSummary(state().current(), state().analysis) }),
        });
      },
    },
    {
      name: 'cut_doorway',
      description:
        `Open a doorway through the wall two rooms share, so you can walk from one into the other. ${DOORWAY_NOTE} ` +
        `Width defaults to ${DEFAULT_DOORWAY_WIDTH} cm and kind to a door, which hangs a leaf swinging into the room you name; a passage is the same hole with no leaf. ` +
        'Name otherRoomId when more than one room lies behind that wall. A refusal lists the shared walls you can actually cut into, with the span of each in that room\'s own coordinates.',
      inputSchema: {
        type: 'object',
        properties: {
          roomId: idProp('The room to cut from, from get_home. The door swings into this one'),
          wall: wallProp,
          offset: cm('Distance along the wall to the near edge of the doorway'),
          width: cm(`Doorway width, default ${DEFAULT_DOORWAY_WIDTH}`),
          kind: { type: 'string', description: 'door hangs a leaf that swings into roomId; passage is an open hole', enum: ['door', 'passage'] },
          otherRoomId: idProp('Which neighbour to open into, when more than one room lies behind that wall'),
        },
        required: ['roomId', 'wall', 'offset'],
      },
      execute: (i) => {
        const s0 = state();
        const roomId = i['roomId'] as string;
        const room = s0.rooms[roomId];
        if (!room) return fail('not_found', 'Call get_home for the rooms on the plan');
        const wall = i['wall'] as Wall;
        if (!WALLS.includes(wall)) return fail('invalid_input', `Unknown wall ${String(wall)}; one of ${WALLS.join(', ')}`);
        const kind = (i['kind'] as 'door' | 'passage' | undefined) ?? 'door';
        if (kind !== 'door' && kind !== 'passage') return fail('invalid_input', `Unknown kind ${String(i['kind'])}; door or passage`);
        const width = (i['width'] as number | undefined) ?? DEFAULT_DOORWAY_WIDTH;
        if (!Number.isFinite(width) || width <= 0) return fail('invalid_input', 'A doorway needs a positive width; interior doors are usually 70 to 90 cm');
        const offset = i['offset'] as number;
        if (!Number.isFinite(offset)) return fail('invalid_input', 'offset is the distance along the wall to the near edge of the doorway, in cm');
        const otherRoomId = i['otherRoomId'] as string | undefined;
        if (otherRoomId !== undefined && !s0.rooms[otherRoomId]) return fail('not_found', `No room ${otherRoomId}; call get_home for the rooms on the plan`);

        const home = homeContaining(s0.homes, roomId);
        const cut = state().cutDoorway({ roomId, wall, offset, width, kind, ...(otherRoomId ? { otherRoomId } : {}), actor: 'agent', tool: 'cut_doorway' });
        if (!cut.ok) {
          const segs = home ? sharedSegments(home, s0.rooms, roomId) : [];
          return fail('invalid_input', `${cut.error}${cut.hint ? `. ${cut.hint}` : ''}`, { sharedWalls: describeSegments(segs, s0.rooms) });
        }
        const d = cut.doorway;
        return applied(home!.id, {
          doorway: {
            id: d.id, kind: d.kind, width: d.width, height: DOORWAY_HEIGHT,
            a: { roomId: d.a.roomId, room: s0.rooms[d.a.roomId]?.name ?? d.a.roomId, wall: d.a.wall, offset: Math.round(d.a.offset) },
            b: { roomId: d.b.roomId, room: s0.rooms[d.b.roomId]?.name ?? d.b.roomId, wall: d.b.wall, offset: Math.round(d.b.offset) },
          },
          ...ledgerKeys([d.a.roomId, d.b.roomId]),
        });
      },
    },
    {
      name: 'remove_doorway',
      description:
        'Close a doorway again, taking the opening out of both rooms at once and writing a ledger entry in each. Ids come from get_home. Undoing only one room\'s entry would leave a door onto a blank wall next door, so use this rather than undo when you want the wall back.',
      inputSchema: { type: 'object', properties: { id: idProp('Doorway id, from get_home') }, required: ['id'] },
      execute: (i) => {
        const id = i['id'] as string;
        const s0 = state();
        const home = Object.values(s0.homes).find((h) => h.doorways.some((d) => d.id === id));
        const doorway = home?.doorways.find((d) => d.id === id);
        if (!home || !doorway) return fail('not_found', 'Call get_home for the doorways on the plan');
        if (!state().removeDoorway(id, 'agent')) return fail('not_found', 'Call get_home for the doorways on the plan');
        return applied(home.id, {
          removed: id,
          between: [doorway.a.roomId, doorway.b.roomId].map((r) => s0.rooms[r]?.name ?? r),
          ...ledgerKeys([doorway.a.roomId, doorway.b.roomId]),
        });
      },
    },
  ];
}
