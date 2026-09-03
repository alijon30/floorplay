import { describe, it, expect } from 'vitest';
import { createRoomStore } from '../../store/roomStore';
import { installWebMCP } from '../install';
import { FakeModelContext } from '../shim';
import { parseResult } from '../results';
import { placeTest } from '../../engine/validate';
import { wallColor } from '../../engine/wallColor';
import { WALL_PALETTES } from '../../engine/wallPalettes';
import { WALLS } from '../../engine/types';

/** A fresh app with its tools installed. The demo studio is 360 x 520 x 260. */
function boot() {
  const store = createRoomStore();
  const mc = new FakeModelContext();
  installWebMCP(store, mc);
  const call = async (name: string, input: Record<string, unknown> = {}) => parseResult(await mc.executeTool(name, input));
  return { store, mc, call, s: () => store.getState() };
}

describe('get_elevation', () => {
  it('reports the wall, its paint and only its own openings', async () => {
    const { call, s } = boot();
    const right = await call('get_elevation', { wall: 'right' }) as Record<string, unknown>;
    expect(right).toMatchObject({ ok: true, wall: 'right', length: 520, height: 260, color: s().current().finish.wall, usesRoomDefault: true, facing: 'east' });
    expect(right['openings']).toEqual([{ id: 'window-east', kind: 'window', offset: 190, width: 140, height: 120, sill: 90, top: 210 }]);
    const top = await call('get_elevation', { wall: 'top' }) as { length: number; openings: unknown[] };
    expect(top.length).toBe(360);
    expect(top.openings).toEqual([]);
  });

  it('lists what hangs on the wall and the furniture standing in front of it', async () => {
    const { call, s } = boot();
    // A sofa flat against the top wall, and a table well out in the room.
    const room = s().current();
    s().dispatch({
      actor: 'human',
      ops: [
        { type: 'place', item: placeTest(room, 'sofa-2', 120, 42, 0, 'sofa') },
        { type: 'place', item: placeTest(room, 'table-coffee-90', 180, 400, 0, 'table') },
      ],
    });
    await call('place_on_wall', { catalogId: 'picture-60', wall: 'top', offset: 120 });

    const view = await call('get_elevation', { wall: 'top' }) as {
      mounted: { catalogId: string; offset: number; mountHeight: number; top: number }[];
      floor: { id: string; distanceFromWall: number }[];
    };
    expect(view.mounted).toHaveLength(1);
    expect(view.mounted[0]).toMatchObject({ catalogId: 'picture-60', offset: 120, width: 60, mountHeight: 110, top: 190 });
    expect(view.floor.map((f) => f.id)).toEqual(['sofa']);
    expect(view.floor[0]!.distanceFromWall).toBe(0);
  });

  it('refuses a wall that is not one of the four', async () => {
    const { call } = boot();
    expect(await call('get_elevation', { wall: 'ceiling' })).toMatchObject({ ok: false, error: 'invalid_input' });
  });
});

describe('list_wall_palettes', () => {
  it('returns every region with six named swatches', async () => {
    const { call } = boot();
    const r = await call('list_wall_palettes') as { count: number; palettes: { region: string; swatches: { name: string; hex: string }[] }[] };
    expect(r.count).toBe(WALL_PALETTES.length);
    expect(r.palettes).toHaveLength(11);
    expect(r.palettes.map((p) => p.region)).toContain('Japan');
    for (const p of r.palettes) expect(p.swatches, p.region).toHaveLength(6);
    expect(r.palettes.find((p) => p.region === 'Japan')!.swatches.map((s) => s.name)).toContain('Aizome indigo');
  });
});

describe('set_wall_color', () => {
  it('paints one wall and leaves the other three alone', async () => {
    const { call, s } = boot();
    const before = s().current().finish.wall;
    const r = await call('set_wall_color', { wall: 'right', color: '#3b4f6b' });
    expect(r).toMatchObject({ ok: true, status: 'applied' });
    const room = s().current();
    expect(wallColor(room, 'right')).toBe('#3b4f6b');
    for (const w of ['top', 'bottom', 'left'] as const) expect(wallColor(room, w), w).toBe(before);
    expect(room.finish.wall).toBe(before);
  });

  it('without a wall paints all four and clears the overrides', async () => {
    const { call, s } = boot();
    await call('set_wall_color', { wall: 'right', color: '#3b4f6b' });
    expect(await call('set_wall_color', { color: '#a8b48a' })).toMatchObject({ ok: true, status: 'applied' });
    const room = s().current();
    expect(room.finish.walls).toBeUndefined();
    for (const w of WALLS) expect(wallColor(room, w), w).toBe('#a8b48a');
  });

  it('rejects a color that is not a hex, and an unknown wall', async () => {
    const { call, s } = boot();
    expect(await call('set_wall_color', { color: 'aizome indigo' })).toMatchObject({ ok: false, error: 'invalid_input' });
    expect(await call('set_wall_color', { wall: 'ceiling', color: '#3b4f6b' })).toMatchObject({ ok: false, error: 'invalid_input' });
    expect(s().current().finish.walls).toBeUndefined();
  });

  it('applies rather than proposes, even in propose-first mode', async () => {
    const { call, s } = boot();
    s().setProposeFirst(true);
    expect(await call('set_wall_color', { color: '#c37a5b' })).toMatchObject({ ok: true, status: 'applied' });
    expect(s().current().proposals).toHaveLength(0);
  });

  it('is undoable in one press', async () => {
    const { call, s } = boot();
    const before = s().current().finish.wall;
    await call('set_wall_color', { wall: 'left', color: '#963f38' });
    s().undo();
    expect(wallColor(s().current(), 'left')).toBe(before);
  });
});

describe('place_on_wall', () => {
  it('hangs a print flush on the wall at the offset asked for', async () => {
    const { call, s } = boot();
    const r = await call('place_on_wall', { catalogId: 'picture-60', wall: 'top', offset: 120 }) as {
      placement: { id: string; wall: string; offset: number; mountHeight: number; x: number; y: number; rotation: number };
    };
    expect(r).toMatchObject({ ok: true, status: 'applied' });
    expect(r.placement).toMatchObject({ wall: 'top', offset: 120, mountHeight: 110, top: 190, x: 150, y: 2, rotation: 0 });
    const item = s().current().items.find((i) => i.id === r.placement.id)!;
    expect(item).toMatchObject({ catalogId: 'picture-60', x: 150, y: 2, rotation: 0 });
    expect(s().analysis.violations).toHaveLength(0);
  });

  it('turns the item to face the room on every wall', async () => {
    const { call } = boot();
    const rotations: Record<string, number> = {};
    for (const wall of WALLS) {
      const r = await call('place_on_wall', { catalogId: 'picture-40', wall, offset: 40 }) as { placement: { rotation: number } };
      rotations[wall] = r.placement.rotation;
    }
    expect(rotations).toEqual({ top: 0, right: 90, bottom: 180, left: 270 });
  });

  it('honours a mount height of its own', async () => {
    const { call, s } = boot();
    const r = await call('place_on_wall', { catalogId: 'picture-60', wall: 'left', offset: 200, mountHeight: 150 }) as { placement: { id: string; mountHeight: number; top: number } };
    expect(r.placement).toMatchObject({ mountHeight: 150, top: 230 });
    expect(s().current().items.find((i) => i.id === r.placement.id)!.mountHeight).toBe(150);
    const view = await call('get_elevation', { wall: 'left' }) as { mounted: { mountHeight: number }[] };
    expect(view.mounted[0]!.mountHeight).toBe(150);
  });

  it('refuses anything that does not hang', async () => {
    const { call, s } = boot();
    const r = await call('place_on_wall', { catalogId: 'sofa-2', wall: 'top', offset: 100 });
    expect(r).toMatchObject({ ok: false, error: 'invalid_input' });
    expect(String((r as { hint: string }).hint)).toContain('place_item');
    expect(s().current().items).toHaveLength(0);
  });

  it('refuses an unknown catalog id, an offset that runs off the wall and a hang through the ceiling', async () => {
    const { call, s } = boot();
    expect(await call('place_on_wall', { catalogId: 'nope', wall: 'top', offset: 10 })).toMatchObject({ ok: false, error: 'invalid_input' });
    expect(await call('place_on_wall', { catalogId: 'picture-90', wall: 'top', offset: 300 })).toMatchObject({ ok: false, error: 'invalid_input' });
    expect(await call('place_on_wall', { catalogId: 'picture-90', wall: 'top', offset: 100, mountHeight: 250 })).toMatchObject({ ok: false, error: 'invalid_input' });
    expect(s().current().items).toHaveLength(0);
  });

  it('goes through the proposal queue when propose-first is on', async () => {
    const { call, s } = boot();
    s().setProposeFirst(true);
    const r = await call('place_on_wall', { catalogId: 'mirror-round-60', wall: 'bottom', offset: 200 });
    expect(r).toMatchObject({ ok: true, status: 'proposed' });
    expect(s().current().proposals).toHaveLength(1);
    expect(s().current().items).toHaveLength(0);
    // The placement rides along on a proposal too: it says where the mirror *would* hang,
    // which is the whole thing the user is being asked to accept or reject.
    expect(r['placement']).toMatchObject({ wall: 'bottom', offset: 200, mountHeight: 110, rotation: 180 });
  });

  it('a hung item shows up on its wall and nowhere else', async () => {
    const { call } = boot();
    await call('place_on_wall', { catalogId: 'wall-shelf-100', wall: 'right', offset: 60 });
    const right = await call('get_elevation', { wall: 'right' }) as { mounted: unknown[] };
    expect(right.mounted).toHaveLength(1);
    for (const wall of ['top', 'bottom', 'left'] as const) {
      expect((await call('get_elevation', { wall }) as { mounted: unknown[] }).mounted, wall).toHaveLength(0);
    }
  });
});

describe('get_style', () => {
  it('resolves all four walls, naming the paint when it is a named one', async () => {
    const { call, s } = boot();
    const japan = WALL_PALETTES.find((p) => p.key === 'japan')!;
    const indigo = japan.swatches.find((sw) => sw.name === 'Aizome indigo')!;
    await call('set_wall_color', { wall: 'left', color: indigo.hex });

    const style = await call('get_style') as {
      finish: { wall: string; floor: string; walls: Record<string, string> };
      wallsResolved: Record<string, { hex: string; swatch?: { region: string; name: string } }>;
      floors: { key: string }[];
      regions: { key: string }[];
    };
    expect(style.finish).toMatchObject({ wall: s().current().finish.wall, floor: s().current().finish.floor });
    expect(style.finish.walls).toEqual({ left: indigo.hex });
    expect(style.wallsResolved['left']).toEqual({ hex: indigo.hex, swatch: { region: 'Japan', name: 'Aizome indigo' } });
    // The other three still wear the room default, which is not one of the regional paints.
    for (const wall of ['top', 'right', 'bottom'] as const) {
      expect(style.wallsResolved[wall], wall).toEqual({ hex: s().current().finish.wall });
    }
    expect(style.floors.map((f) => f.key)).toEqual(['oak', 'walnut', 'ash', 'grey', 'tile']);
    expect(style.regions).toHaveLength(WALL_PALETTES.length);
  });
});

describe('set_wall_color by name', () => {
  it('takes a "Region/Name" swatch and reports the hex it resolved to', async () => {
    const { call, s } = boot();
    const morocco = WALL_PALETTES.find((p) => p.key === 'morocco')!;
    const zellige = morocco.swatches.find((sw) => sw.name === 'Zellige blue')!;
    // Case is ignored, because an agent repeating a colour back rarely repeats its capitals.
    const r = await call('set_wall_color', { wall: 'top', swatch: 'morocco/zellige blue' });
    expect(r).toMatchObject({ ok: true, status: 'applied', color: zellige.hex, swatch: 'Morocco Zellige blue' });
    expect(wallColor(s().current(), 'top')).toBe(zellige.hex);
    expect(s().current().ledger.at(-1)!.summary).toContain('Morocco Zellige blue');

    // Without a wall it repaints everything and drops the overrides.
    await call('set_wall_color', { swatch: 'Japan/Shoji white' });
    expect(s().current().finish.walls).toBeUndefined();
    for (const wall of WALLS) expect(wallColor(s().current(), wall), wall).toBe('#f2efe6');
  });

  it('refuses an unknown region, an unknown paint, a bare name and nothing at all', async () => {
    const { call } = boot();
    expect(await call('set_wall_color', { swatch: 'Atlantis/Sea green' })).toMatchObject({ ok: false, error: 'invalid_input' });
    expect(await call('set_wall_color', { swatch: 'Japan/Chartreuse' })).toMatchObject({ ok: false, error: 'invalid_input' });
    expect(await call('set_wall_color', { swatch: 'Aizome indigo' })).toMatchObject({ ok: false, error: 'invalid_input' });
    expect(await call('set_wall_color', {})).toMatchObject({ ok: false, error: 'invalid_input' });
  });
});
