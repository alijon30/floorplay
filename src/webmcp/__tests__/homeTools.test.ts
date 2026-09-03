import { describe, it, expect } from 'vitest';
import { createRoomStore } from '../../store/roomStore';
import { installWebMCP } from '../install';
import { FakeModelContext } from '../shim';
import { parseResult } from '../results';

/** The plan as the tools report it, so a test can read a result without casting field by field. */
interface HomeView {
  id: string;
  name: string;
  rooms: { id: string; name: string; x: number; y: number; width: number; depth: number; items: number; current: boolean; entrance: boolean }[];
  doorways: { id: string; kind: string; width: number; a: { roomId: string; room: string; wall: string; offset: number }; b: { roomId: string; room: string; wall: string; offset: number } }[];
  bounds: { x: number; y: number; w: number; h: number };
  entranceRoomId: string | null;
  unreachable: { id: string; name: string }[];
  totals: { areaM2: number; budget: number; budgetUsed: number; items: number; rooms: number };
}

type Payload = Record<string, unknown>;

/** A fresh app with its tools installed. The demo studio is 360 x 520 and stands on no plan. */
function boot() {
  const store = createRoomStore();
  const mc = new FakeModelContext();
  installWebMCP(store, mc);
  const call = async (name: string, input: Record<string, unknown> = {}): Promise<Payload> => parseResult(await mc.executeTool(name, input));
  return { store, call, s: () => store.getState() };
}

const homeOf = (r: Payload): HomeView => r['home'] as HomeView;
const roomNamed = (home: HomeView, name: string) => home.rooms.find((r) => r.name === name)!;

/**
 * A plan with a living room and a kitchen against its right wall, built through the tools.
 *
 * The kitchen is asked for at (456, 6) so the snap is exercised on the way in: it lands flush at
 * (450, 0), which is what makes the two rooms share a wall at all.
 */
async function pair(call: (name: string, input?: Record<string, unknown>) => Promise<Payload>) {
  await call('create_home', { name: 'Flat 3' });
  await call('add_room_to_home', { templateKey: 'living', x: 0, y: 0 });
  const added = await call('add_room_to_home', { templateKey: 'kitchen', x: 456, y: 6 });
  const home = homeOf(added);
  return { home, added, living: roomNamed(home, 'Living room'), kitchen: roomNamed(home, 'Kitchen') };
}

describe('get_home', () => {
  it('says there is no plan yet, and names the way onto one', async () => {
    const { call } = boot();
    const r = await call('get_home');
    expect(r).toMatchObject({ ok: true, home: null });
    expect(String(r['hint'])).toContain('create_home');
    expect(String(r['hint'])).toContain('add_room_to_home');
  });

  it('reports every room with its offset, the doorways, the entrance and the totals', async () => {
    const { call, s } = boot();
    await call('create_home', { template: 'one-bedroom' });
    const home = homeOf(await call('get_home'));

    expect(home.rooms).toHaveLength(4);
    expect(home.doorways).toHaveLength(3);
    expect(roomNamed(home, 'Entrance hall')).toMatchObject({ x: 0, y: 0, width: 200, depth: 420 });
    expect(roomNamed(home, 'Kitchen')).toMatchObject({ x: 650, y: 0, width: 380, depth: 420 });
    expect(home.bounds).toEqual({ x: 0, y: 0, w: 1030, h: 970 });
    expect(home.totals.rooms).toBe(4);
    expect(home.totals.areaM2).toBeGreaterThan(0);
    // Every room of a ready-made home is walkable from its front door.
    expect(home.unreachable).toEqual([]);
    expect(home.entranceRoomId).toBe(roomNamed(home, 'Entrance hall').id);
    // The room in front of the user is the one you come in through, and it is marked as such.
    expect(roomNamed(home, 'Entrance hall').current).toBe(true);
    expect(s().currentId).toBe(home.entranceRoomId);
  });
});

describe('list_home_templates', () => {
  it('lists the ready-made homes with their rooms, sizes and doorway counts', async () => {
    const { call } = boot();
    const r = await call('list_home_templates');
    const templates = r['templates'] as { key: string; name: string; rooms: { template: string; x: number; y: number; width: number; depth: number }[]; doorways: number }[];
    expect(templates.map((t) => t.key)).toEqual(['one-bedroom', 'studio-hall']);
    expect(r['count']).toBe(2);
    expect(templates[0]!.doorways).toBe(3);
    expect(templates[0]!.rooms[0]).toMatchObject({ template: 'hall', x: 0, y: 0, width: 200, depth: 420 });
    expect(templates[1]!.rooms.map((x) => x.template)).toEqual(['hall', 'studio']);
  });
});

describe('create_home', () => {
  it('builds a ready-made home, furnished and joined up, and takes a name of its own', async () => {
    const { call, s } = boot();
    const r = await call('create_home', { template: 'studio-hall', name: 'Flat 3' });
    expect(r).toMatchObject({ ok: true, status: 'applied', template: 'studio-hall' });
    const home = homeOf(r);
    expect(home.name).toBe('Flat 3');
    expect(home.rooms).toHaveLength(2);
    expect(home.doorways).toHaveLength(1);
    expect(home.rooms.every((x) => x.items > 0)).toBe(true);
    // The demo studio is untouched: a home is built from new rooms, not from the one in hand.
    expect(Object.keys(s().rooms)).toHaveLength(3);
    expect(r['metrics']).toBeTruthy();
  });

  it('starts an empty plan when no template is named', async () => {
    const { call } = boot();
    const home = homeOf(await call('create_home', { name: 'Flat 3' }));
    expect(home).toMatchObject({ name: 'Flat 3', rooms: [], doorways: [] });
    expect(home.totals.rooms).toBe(0);
  });

  it('refuses a template it does not have', async () => {
    const { call } = boot();
    const r = await call('create_home', { template: 'mansion' });
    expect(r).toMatchObject({ ok: false, error: 'invalid_input' });
    expect(String(r['hint'])).toContain('one-bedroom');
  });
});

describe('add_room_to_home', () => {
  it('stands a template room on the plan, snapping it flush against its neighbour', async () => {
    const { call } = boot();
    const { added, home, kitchen } = await pair(call);
    expect(added).toMatchObject({ ok: true, status: 'applied', x: 450, y: 0, snapped: true, created: true, template: 'kitchen' });
    expect(home.rooms).toHaveLength(2);
    expect(kitchen).toMatchObject({ x: 450, y: 0, width: 380, depth: 420, current: true });
    // Touching is not joined: nothing is walkable until a doorway is cut.
    expect(home.unreachable.map((u) => u.name)).toEqual(['Kitchen']);
  });

  it('starts a plan named after the current room when there is none, and puts that room on it', async () => {
    const { call, s } = boot();
    const r = await call('add_room_to_home', { templateKey: 'kitchen', x: 360, y: 0 });
    expect(r).toMatchObject({ ok: true, createdHome: 'Demo studio home' });
    const home = homeOf(r);
    expect(home.rooms.map((x) => x.name)).toEqual(['Demo studio', 'Kitchen']);
    expect(roomNamed(home, 'Demo studio')).toMatchObject({ x: 0, y: 0 });
    expect(roomNamed(home, 'Kitchen')).toMatchObject({ x: 360, y: 0 });
    expect(s().currentHomeId).toBe(home.id);
  });

  it('adds a room that already exists, and refuses one that is already on a plan', async () => {
    const { call, s } = boot();
    const demo = s().currentId;
    await call('create_home', { name: 'Flat 3' });
    const r = await call('add_room_to_home', { roomId: demo, x: 0, y: 0 });
    expect(r).toMatchObject({ ok: true, roomId: demo, x: 0, y: 0, snapped: false });
    expect(homeOf(r).rooms.map((x) => x.name)).toEqual(['Demo studio']);

    const again = await call('add_room_to_home', { roomId: demo, x: 400, y: 0 });
    expect(again).toMatchObject({ ok: false, error: 'conflict' });
    expect(String(again['hint'])).toContain('Flat 3');
  });

  it('refuses an overlap by name, suggests an offset that works, and creates nothing', async () => {
    const { call, s } = boot();
    const before = Object.keys(s().rooms).length;
    const { home } = await pair(call);
    const r = await call('add_room_to_home', { templateKey: 'bedroom', x: 100, y: 100 });
    expect(r).toMatchObject({ ok: false, error: 'overlap' });
    expect(String(r['hint'])).toContain('Overlaps Living room');
    expect(String(r['hint'])).toContain('x=0, y=550');
    // The refused room was never built and the plan is as it was.
    expect(Object.keys(s().rooms)).toHaveLength(before + 2);
    expect(s().homes[home.id]!.rooms).toHaveLength(2);
  });

  it('refuses an unknown room, and an ambiguous request', async () => {
    const { call } = boot();
    expect(await call('add_room_to_home', { roomId: 'room_nope', x: 0, y: 0 })).toMatchObject({ ok: false, error: 'not_found' });
    expect(await call('add_room_to_home', { x: 0, y: 0 })).toMatchObject({ ok: false, error: 'invalid_input' });
    expect(await call('add_room_to_home', { roomId: 'room_nope', templateKey: 'kitchen', x: 0, y: 0 })).toMatchObject({ ok: false, error: 'invalid_input' });
    expect(await call('add_room_to_home', { templateKey: 'ballroom', x: 0, y: 0 })).toMatchObject({ ok: false, error: 'invalid_input' });
  });
});

describe('move_room', () => {
  it('moves a room, snaps it to its new neighbour and takes the doorways the move broke', async () => {
    const { call, s } = boot();
    const { living, kitchen } = await pair(call);
    const cut = await call('cut_doorway', { roomId: living.id, wall: 'right', offset: 100 });
    const doorwayId = String((cut['doorway'] as Record<string, unknown>)['id']);

    const r = await call('move_room', { roomId: kitchen.id, x: 6, y: 556 });
    expect(r).toMatchObject({ ok: true, status: 'applied', roomId: kitchen.id, x: 0, y: 550, snapped: true, removedDoorways: [doorwayId] });
    expect(roomNamed(homeOf(r), 'Kitchen')).toMatchObject({ x: 0, y: 550 });
    expect(String(r['warning'])).toContain('doorway');
    expect(s().homes[homeOf(r).id]!.rooms[1]).toEqual({ roomId: kitchen.id, x: 0, y: 550 });
    // The opening went with it, out of both rooms rather than one.
    expect(s().homes[homeOf(r).id]!.doorways).toEqual([]);
    expect(s().rooms[kitchen.id]!.openings.some((o) => o.doorwayId === doorwayId)).toBe(false);
    expect(s().rooms[living.id]!.openings.some((o) => o.doorwayId === doorwayId)).toBe(false);
  });

  it('refuses a move onto another room, and a room that is on no plan', async () => {
    const { call, s } = boot();
    const { kitchen, living } = await pair(call);
    const onto = await call('move_room', { roomId: kitchen.id, x: 100, y: 100 });
    expect(onto).toMatchObject({ ok: false, error: 'overlap' });
    expect(String(onto['hint'])).toContain('Overlaps Living room');
    expect(s().homes[homeOf(await call('get_home')).id]!.rooms[1]).toEqual({ roomId: kitchen.id, x: 450, y: 0 });
    expect(living.id).not.toBe(kitchen.id);

    const standalone = Object.values(s().rooms).find((x) => x.name === 'Demo studio')!;
    const off = await call('move_room', { roomId: standalone.id, x: 0, y: 0 });
    expect(off).toMatchObject({ ok: false, error: 'not_in_home' });
    expect(String(off['hint'])).toContain('add_room_to_home');
    expect(await call('move_room', { roomId: 'room_nope', x: 0, y: 0 })).toMatchObject({ ok: false, error: 'not_found' });
  });
});

describe('cut_doorway', () => {
  it('opens one hole in both rooms, writes a ledger entry in each and makes the far room walkable', async () => {
    const { call, s } = boot();
    const { living, kitchen } = await pair(call);
    const r = await call('cut_doorway', { roomId: living.id, wall: 'right', offset: 100 });
    expect(r).toMatchObject({ ok: true, status: 'applied' });

    const doorway = r['doorway'] as HomeView['doorways'][number];
    expect(doorway).toMatchObject({ kind: 'door', width: 80, a: { roomId: living.id, wall: 'right', offset: 100 }, b: { roomId: kitchen.id, wall: 'left', offset: 100 } });
    expect(homeOf(r).doorways).toHaveLength(1);
    expect(homeOf(r).unreachable).toEqual([]);

    const opened = (id: string) => s().rooms[id]!.openings.filter((o) => o.doorwayId === doorway.id);
    expect(opened(living.id)).toHaveLength(1);
    expect(opened(living.id)[0]).toMatchObject({ kind: 'door', wall: 'right', offset: 100, width: 80, height: 200, swing: 'in' });
    expect(opened(kitchen.id)[0]).toMatchObject({ wall: 'left', offset: 100, swing: 'out' });

    // The uniform tail: one ledger entry per room touched, and the current room's items.
    const entries = r['ledgerEntries'] as { roomId: string; ledgerId: string }[];
    expect(entries.map((e) => e.roomId).sort()).toEqual([living.id, kitchen.id].sort());
    expect(r['ledgerId']).toBe(entries.find((e) => e.roomId === s().currentId)!.ledgerId);
    expect(Array.isArray(r['items'])).toBe(true);
    expect(s().rooms[kitchen.id]!.ledger[0]).toMatchObject({ actor: 'agent', tool: 'cut_doorway' });
  });

  it('cuts a passage, which hangs no leaf on either side', async () => {
    const { call, s } = boot();
    const { living, kitchen } = await pair(call);
    const r = await call('cut_doorway', { roomId: living.id, wall: 'right', offset: 200, width: 120, kind: 'passage' });
    expect(r).toMatchObject({ ok: true });
    expect(s().rooms[living.id]!.openings.at(-1)).toMatchObject({ width: 120, swing: 'out' });
    expect(s().rooms[kitchen.id]!.openings.at(-1)).toMatchObject({ width: 120, swing: 'out' });
  });

  it('refuses a wall the rooms do not share, and lists the walls they do', async () => {
    const { call } = boot();
    const { living, kitchen } = await pair(call);
    const r = await call('cut_doorway', { roomId: living.id, wall: 'top', offset: 100 });
    expect(r).toMatchObject({ ok: false, error: 'invalid_input' });
    expect(String(r['hint'])).toContain('top wall');
    expect(r['sharedWalls']).toEqual([{ wall: 'right', otherRoomId: kitchen.id, room: 'Kitchen', from: 0, to: 420 }]);
  });

  it('refuses a doorway that runs off the shared part of the wall, and an unknown room', async () => {
    const { call } = boot();
    const { living } = await pair(call);
    // The rooms share the right wall only as far as the kitchen is deep, 420 of 550 cm.
    const r = await call('cut_doorway', { roomId: living.id, wall: 'right', offset: 400 });
    expect(r).toMatchObject({ ok: false, error: 'invalid_input' });
    expect(String(r['hint'])).toContain('420');
    expect(await call('cut_doorway', { roomId: 'room_nope', wall: 'right', offset: 100 })).toMatchObject({ ok: false, error: 'not_found' });
    expect(await call('cut_doorway', { roomId: living.id, wall: 'ceiling', offset: 100 })).toMatchObject({ ok: false, error: 'invalid_input' });
    expect(await call('cut_doorway', { roomId: living.id, wall: 'right', offset: 100, width: 0 })).toMatchObject({ ok: false, error: 'invalid_input' });
  });
});

describe('remove_doorway', () => {
  it('takes the opening out of both rooms and off the plan', async () => {
    const { call, s } = boot();
    const { living, kitchen } = await pair(call);
    const cut = await call('cut_doorway', { roomId: living.id, wall: 'right', offset: 100 });
    const id = (cut['doorway'] as { id: string }).id;

    const r = await call('remove_doorway', { id });
    expect(r).toMatchObject({ ok: true, status: 'applied', removed: id });
    expect(r['between']).toEqual(['Living room', 'Kitchen']);
    expect(homeOf(r).doorways).toEqual([]);
    expect(homeOf(r).unreachable.map((u) => u.name)).toEqual(['Kitchen']);
    expect(s().rooms[living.id]!.openings.some((o) => o.doorwayId)).toBe(false);
    expect(s().rooms[kitchen.id]!.openings.some((o) => o.doorwayId)).toBe(false);
    expect((r['ledgerEntries'] as unknown[])).toHaveLength(2);
  });

  it('refuses a doorway id it does not know', async () => {
    const { call } = boot();
    await pair(call);
    const r = await call('remove_doorway', { id: 'dw_nope' });
    expect(r).toMatchObject({ ok: false, error: 'not_found' });
    expect(String(r['hint'])).toContain('get_home');
  });
});

describe('remove_room_from_home', () => {
  it('takes a room off the plan with its doorways, and keeps the room itself', async () => {
    const { call, s } = boot();
    const { living, kitchen } = await pair(call);
    const cut = await call('cut_doorway', { roomId: living.id, wall: 'right', offset: 100 });
    const id = (cut['doorway'] as { id: string }).id;

    const r = await call('remove_room_from_home', { roomId: kitchen.id });
    expect(r).toMatchObject({ ok: true, status: 'applied', removed: kitchen.id, doorwaysRemoved: [id] });
    expect(homeOf(r).rooms.map((x) => x.name)).toEqual(['Living room']);
    expect(homeOf(r).doorways).toEqual([]);
    // The room survives with everything in it; only its place on the plan is gone.
    expect(s().rooms[kitchen.id]!.items.length).toBeGreaterThan(0);
    expect(s().rooms[living.id]!.openings.some((o) => o.doorwayId)).toBe(false);
    expect((r['ledgerEntries'] as unknown[])).toHaveLength(2);
  });

  it('refuses a room that is on no plan, and one it does not know', async () => {
    const { call, s } = boot();
    await pair(call);
    const standalone = Object.values(s().rooms).find((x) => x.name === 'Demo studio')!;
    const r = await call('remove_room_from_home', { roomId: standalone.id });
    expect(r).toMatchObject({ ok: false, error: 'not_in_home' });
    expect(await call('remove_room_from_home', { roomId: 'room_nope' })).toMatchObject({ ok: false, error: 'not_found' });
  });
});
