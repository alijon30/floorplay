// src/webmcp/tools/wallTools.ts
import type { ToolDef } from '../registry';
import { ok, fail } from '../results';
import { HEX_COLOR, cm, hexColorProp, idProp, strProp, wallProp } from '../schemas';
import type { ToolContext } from './context';
import { mutate } from './mutateTools';
import { WALL_PALETTES } from '../../engine/wallPalettes';
import { wallLabel, wallPositionName } from '../../engine/wallNames';
import { wallColor, withAllWallsColor, withWallColor } from '../../engine/wallColor';
import { elevationView, wallLength, wallPlacement, FLOOR_NEAR_CM, MOUNT_NEAR_CM } from '../../engine/elevation';
import { wallFacing } from '../../engine/geometry';
import { findCatalogItem } from '../../engine/catalog';
import { newId } from '../../engine/ids';
import { FLOOR_FINISHES, WALLS, type Wall } from '../../engine/types';
import { FLOOR_LABEL } from '../../finishes';

/**
 * How an offset is measured on every tool here, quoted in the descriptions so an agent never
 * has to guess which end of a wall it counts from.
 */
const OFFSET_NOTE =
  'offset is the distance along the wall to the near edge of the thing, measured from the left end of the top and bottom walls and from the top end of the left and right walls — the same ruler add_opening uses.';

const COMPASS: Record<number, string> = { 0: 'north', 90: 'east', 180: 'south', 270: 'west' };

/** The named paint a hex happens to be, when it is one. Exact match, case ignored. */
function swatchForHex(hex: string): { region: string; name: string } | undefined {
  const want = hex.toLowerCase();
  for (const p of WALL_PALETTES) {
    const hit = p.swatches.find((sw) => sw.hex.toLowerCase() === want);
    if (hit) return { region: p.region, name: hit.name };
  }
  return undefined;
}

/**
 * A "Region/name" swatch reference resolved to its hex.
 *
 * Names are how people talk about paint — "Japan/Aizome indigo", not "#3b4f6b" — so the tool
 * takes the name and does the lookup, rather than making the agent copy a hex out of
 * list_wall_palettes and risk transcribing it wrong.
 */
function resolveSwatch(ref: string): { hex: string; region: string; name: string } | { error: string } {
  const slash = ref.indexOf('/');
  if (slash < 0) return { error: `${ref} is not a swatch reference; write it as "Region/Name", like "Japan/Aizome indigo"` };
  const region = ref.slice(0, slash).trim().toLowerCase();
  const name = ref.slice(slash + 1).trim().toLowerCase();
  const p = WALL_PALETTES.find((q) => q.region.toLowerCase() === region || q.key.toLowerCase() === region);
  if (!p) return { error: `Unknown region ${ref.slice(0, slash).trim()}; one of ${WALL_PALETTES.map((q) => q.region).join(', ')}` };
  const sw = p.swatches.find((q) => q.name.toLowerCase() === name);
  if (!sw) return { error: `${p.region} has no paint called ${ref.slice(slash + 1).trim()}; one of ${p.swatches.map((q) => q.name).join(', ')}` };
  return { hex: sw.hex, region: p.region, name: sw.name };
}

export function buildWallTools(ctx: ToolContext): ToolDef[] {
  const state = () => ctx.store.getState();
  const room = () => state().current();

  return [
    {
      name: 'get_elevation',
      description:
        `One wall seen straight on: its paint, its length and height, the doors and windows in it, everything hanging on it with its offset and mount height, and the floor-standing furniture within ${FLOOR_NEAR_CM} cm of it. ` +
        `Walls are named by where they sit on the plan — top, right, bottom, left — and that is how the user sees them on screen, so name them that way in your reply. \`facing\` gives the compass direction if you need it, but it moves whenever north moves and it is not what the user is looking at. \`describe\` is the label the app itself puts on this wall. ` +
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
          describe: wallLabel(r, wall),
          position: wallPositionName(wall).toLowerCase(),
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
      name: 'get_style',
      description:
        'Every finish in the room at once: the room default and any per-wall overrides, what each of the four walls actually resolves to and which named paint that is, the floor materials on offer, and the eleven regional palettes. Read it before repainting, so "make the other walls match" and "what colour is this" have an answer.',
      inputSchema: { type: 'object', properties: {} },
      annotations: { readOnlyHint: true },
      execute: () => {
        const r = room();
        const wallsResolved = Object.fromEntries(WALLS.map((w) => {
          const hex = wallColor(r, w);
          const sw = swatchForHex(hex);
          return [w, { hex, ...(sw ? { swatch: sw } : {}) }];
        }));
        return ok({
          finish: { wall: r.finish.wall, floor: r.finish.floor, walls: r.finish.walls ?? {} },
          wallsResolved,
          floors: FLOOR_FINISHES.map((f) => ({ key: f, label: FLOOR_LABEL[f] })),
          regions: WALL_PALETTES.map((p) => ({ key: p.key, region: p.region, swatches: p.swatches })),
          note: 'A wall with no entry in finish.walls wears finish.wall. Pass a swatch to set_wall_color as "Region/Name", exactly as it reads here.',
        });
      },
    },
    {
      name: 'set_wall_color',
      description: 'Paint the walls. Walls are named by where they sit on the plan — top, right, bottom, left — which is how the user sees them on screen, so ask for and confirm "the top wall", never "the north wall". With a wall named, only that wall changes and the other three keep whatever they had. Without one, every wall goes back to a single color and any per-wall overrides are cleared. Name the paint with swatch, as "Region/Name" from list_wall_palettes — "Japan/Aizome indigo" — or pass any hex as color.',
      inputSchema: { type: 'object', properties: { wall: wallProp, color: hexColorProp('Wall paint'), swatch: strProp('A named paint as "Region/Name", from list_wall_palettes or get_style. An alternative to color') } },
      execute: (input) => {
        const ref = input['swatch'] as string | undefined;
        const raw = input['color'] as string | undefined;
        if (ref === undefined && raw === undefined) return fail('invalid_input', 'Pass color as a hex, or swatch as "Region/Name" from list_wall_palettes');
        let color: string;
        let paintName: string | undefined;
        if (ref !== undefined) {
          const hit = resolveSwatch(ref);
          if ('error' in hit) return fail('invalid_input', hit.error);
          color = hit.hex;
          paintName = `${hit.region} ${hit.name}`;
        } else {
          color = raw!;
          if (!HEX_COLOR.test(color)) return fail('invalid_input', `${color} is not a hex color like #aabbcc`);
        }
        const wall = input['wall'] as Wall | undefined;
        if (wall !== undefined && !WALLS.includes(wall)) return fail('invalid_input', `Unknown wall ${String(wall)}; one of ${WALLS.join(', ')}`);
        const r = room();
        const finish = wall ? withWallColor(r.finish, wall, color) : withAllWallsColor(r.finish, color);
        // Not proposable: paint is instantly visible and instantly undone, so making the user
        // accept a proposal to see a colour would hide the only thing worth judging.
        const painted = paintName ?? color;
        const result = mutate(ctx, {
          tool: 'set_wall_color',
          proposable: false,
          ops: [{ type: 'setFinish', finish }],
          summary: wall ? `Painted the ${wall} wall ${painted}` : `Painted every wall ${painted}`,
        });
        // The hex goes back either way, so an agent that asked for a name knows what it got
        // and can hand the same value to anything that only speaks in colour.
        const payload = JSON.parse(result.content[0]!.text) as Record<string, unknown>;
        if (payload['ok'] !== true) return result;
        return ok({ ...payload, color, ...(paintName ? { swatch: paintName } : {}) });
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
