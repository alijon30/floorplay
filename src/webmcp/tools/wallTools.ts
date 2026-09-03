// src/webmcp/tools/wallTools.ts
import type { ToolDef } from '../registry';
import { ok, fail } from '../results';
import { HEX_COLOR, cm, hexColorProp, idProp, wallProp } from '../schemas';
import type { ToolContext } from './context';
import { mutate } from './mutateTools';
import { WALL_PALETTES } from '../../engine/wallPalettes';
import { wallColor, withAllWallsColor, withWallColor } from '../../engine/wallColor';
import { elevationView, wallLength, wallPlacement, FLOOR_NEAR_CM, MOUNT_NEAR_CM } from '../../engine/elevation';
import { wallFacing } from '../../engine/geometry';
import { findCatalogItem } from '../../engine/catalog';
import { newId } from '../../engine/ids';
import { WALLS, type Wall } from '../../engine/types';

/**
 * How an offset is measured on every tool here, quoted in the descriptions so an agent never
 * has to guess which end of a wall it counts from.
 */
const OFFSET_NOTE =
  'offset is the distance along the wall to the near edge of the thing, measured from the left end of the top and bottom walls and from the top end of the left and right walls — the same ruler add_opening uses.';

const COMPASS: Record<number, string> = { 0: 'north', 90: 'east', 180: 'south', 270: 'west' };

export function buildWallTools(ctx: ToolContext): ToolDef[] {
  const state = () => ctx.store.getState();
  const room = () => state().current();

  return [
    {
      name: 'get_elevation',
      description:
        `One wall seen straight on: its paint, its length and height, the doors and windows in it, everything hanging on it with its offset and mount height, and the floor-standing furniture within ${FLOOR_NEAR_CM} cm of it. ` +
        `Read this before hanging anything, so a picture goes above the sofa rather than through it. ${OFFSET_NOTE}`,
      inputSchema: { type: 'object', properties: { wall: wallProp }, required: ['wall'] },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: (input) => {
        const wall = input['wall'] as Wall;
        if (!WALLS.includes(wall)) return fail('invalid_input', `Unknown wall ${String(wall)}; one of ${WALLS.join(', ')}`);
        const r = room();
        const view = elevationView(r, wall);
        return ok({
          wall,
          facing: COMPASS[wallFacing(wall, r.northWall)] ?? 'unknown',
          length: view.length,
          height: view.height,
          color: wallColor(r, wall),
          usesRoomDefault: r.finish.walls?.[wall] === undefined,
          openings: view.openings,
          mounted: view.mounted.map((m) => ({ id: m.id, catalogId: m.catalogId, name: m.name, offset: m.offset, width: m.width, height: m.height, mountHeight: m.bottom, top: m.top, locked: m.locked })),
          floor: view.floor.map((f) => ({ id: f.id, catalogId: f.catalogId, name: f.name, offset: f.offset, width: f.width, height: f.height, distanceFromWall: f.distance })),
          note: `Items count as hanging on this wall when their footprint is within ${MOUNT_NEAR_CM} cm of it. ${OFFSET_NOTE}`,
        });
      },
    },
    {
      name: 'list_wall_palettes',
      description: 'Regional wall colors: eleven regions, six named paints each, every one chosen to read as a whole wall. Use it to answer "paint this room like a Kyoto tea house" with a real color rather than an invented hex, then pass the hex to set_wall_color.',
      inputSchema: { type: 'object', properties: {} },
      annotations: { readOnlyHint: true },
      execute: () => ok({
        count: WALL_PALETTES.length,
        palettes: WALL_PALETTES.map((p) => ({ key: p.key, region: p.region, note: p.note, swatches: p.swatches })),
      }),
    },
    {
      name: 'set_wall_color',
      description: 'Paint the walls. With a wall named, only that wall changes and the other three keep whatever they had. Without one, every wall goes back to a single color and any per-wall overrides are cleared. Colors come from list_wall_palettes, or any hex you like.',
      inputSchema: { type: 'object', properties: { wall: wallProp, color: hexColorProp('Wall paint') }, required: ['color'] },
      execute: (input) => {
        const color = input['color'] as string;
        if (!HEX_COLOR.test(color)) return fail('invalid_input', `${color} is not a hex color like #aabbcc`);
        const wall = input['wall'] as Wall | undefined;
        if (wall !== undefined && !WALLS.includes(wall)) return fail('invalid_input', `Unknown wall ${String(wall)}; one of ${WALLS.join(', ')}`);
        const r = room();
        const finish = wall ? withWallColor(r.finish, wall, color) : withAllWallsColor(r.finish, color);
        // Not proposable: paint is instantly visible and instantly undone, so making the user
        // accept a proposal to see a colour would hide the only thing worth judging.
        return mutate(ctx, {
          tool: 'set_wall_color',
          proposable: false,
          ops: [{ type: 'setFinish', finish }],
          summary: wall ? `Painted the ${wall} wall ${color}` : `Painted every wall ${color}`,
        });
      },
    },
    {
      name: 'place_on_wall',
      description:
        `Hang a wall-mounted item — a print, a mirror, a wall shelf, hooks, a clock, curtains — flush on a wall at a given offset. Only items in the catalog's \`wall\` category can be hung; everything else stands on the floor and belongs to place_item. The x and y are worked out for you. ${OFFSET_NOTE}`,
      inputSchema: {
        type: 'object',
        properties: {
          catalogId: idProp('Catalog id of a wall-category item, from get_catalog'),
          wall: wallProp,
          offset: cm('Distance along the wall to the item near edge'),
          mountHeight: cm('Height from the floor to the bottom of the item. Defaults to the catalog mount height'),
        },
        required: ['catalogId', 'wall', 'offset'],
      },
      execute: (input) => {
        const r = room();
        const catalogId = input['catalogId'] as string;
        const cat = findCatalogItem(r, catalogId);
        if (!cat) return fail('invalid_input', 'Unknown catalogId; call get_catalog');
        if (cat.category !== 'wall' || cat.mountHeight === undefined) {
          return fail('invalid_input', `${cat.name} is not a wall-mounted item; use place_item for anything that stands on the floor, or get_catalog with category "wall" for what can hang`);
        }
        const wall = input['wall'] as Wall;
        if (!WALLS.includes(wall)) return fail('invalid_input', `Unknown wall ${String(wall)}; one of ${WALLS.join(', ')}`);
        const offset = input['offset'] as number;
        const length = wallLength(r, wall);
        if (offset < 0 || offset + cat.width > length) {
          return fail('invalid_input', `A ${cat.width} cm item at offset ${offset} runs off a ${length} cm wall; offset must be between 0 and ${length - cat.width}`);
        }
        const mountHeight = input['mountHeight'] as number | undefined;
        if (mountHeight !== undefined && (mountHeight < 0 || mountHeight + cat.height > r.height)) {
          return fail('invalid_input', `A ${cat.height} cm item hung at ${mountHeight} cm reaches ${mountHeight + cat.height} cm, past the ${r.height} cm ceiling`);
        }
        const p = wallPlacement(r, cat, wall, offset);
        const id = newId('item');
        const bottom = mountHeight ?? cat.mountHeight;
        const result = mutate(ctx, {
          tool: 'place_on_wall',
          proposable: true,
          label: `Hang ${cat.name} on the ${wall} wall`,
          summary: `Hung ${cat.name} on the ${wall} wall at ${offset} cm, ${bottom} cm up`,
          ops: [{
            type: 'place',
            item: {
              id, catalogId, x: Math.round(p.x), y: Math.round(p.y), rotation: p.rotation, locked: false,
              ...(mountHeight !== undefined ? { mountHeight } : {}),
            },
          }],
        });
        // The placement is added to a proposed result too: what the user is being asked to
        // accept is exactly where the thing would hang, so the agent has to be able to say it.
        const payload = JSON.parse(result.content[0]!.text) as Record<string, unknown>;
        if (payload['ok'] !== true) return result;
        return ok({ ...payload, placement: { id, catalogId, wall, offset, width: cat.width, height: cat.height, mountHeight: bottom, top: bottom + cat.height, x: Math.round(p.x), y: Math.round(p.y), rotation: p.rotation } });
      },
    },
  ];
}
