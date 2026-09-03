// src/ui/homeActions.ts
import { useRoom } from '../store';
import type { PlaceRoomResult } from '../store';
import type { Home, Room, RoomKind } from '../engine/types';
import { homeBounds, homeContaining } from '../engine/home';

/**
 * Putting a room on a floor plan, in one place.
 *
 * The home toolbar, the Room tab and the Plan/Home toggle all offer some version of it, and
 * the rules are the same wherever it is asked from: a new room stands clear to the right of
 * everything already down and lets the 20 cm snap pull it in, an existing room is never taken
 * off another plan to do it, and a plan you have just added to is a plan you want to look at.
 */
export function useAddRoom(home: Home | null): {
  /** Rooms standing on no plan at all: the ones this home can take without stealing them. */
  standalone: Room[];
  addExisting(roomId: string): PlaceRoomResult;
  addTemplate(key: RoomKind): PlaceRoomResult;
} {
  const rooms = useRoom((s) => s.rooms);
  const homes = useRoom((s) => s.homes);
  const addRoomToHome = useRoom((s) => s.addRoomToHome);
  const loadTemplate = useRoom((s) => s.loadTemplate);
  const setPlanView = useRoom((s) => s.setPlanView);

  const at = () => {
    if (!home) return { x: 0, y: 0 };
    const b = homeBounds(home, rooms);
    return b.w > 0 ? { x: b.x + b.w, y: b.y } : { x: 0, y: 0 };
  };

  const place = (roomId: string): PlaceRoomResult => {
    if (!home) return { ok: false, error: 'There is no floor plan to add to yet.' };
    const p = at();
    const r = addRoomToHome(home.id, roomId, p.x, p.y);
    if (r.ok) setPlanView('home');
    return r;
  };

  return {
    standalone: Object.values(rooms).filter((r) => !homeContaining(homes, r.id)),
    addExisting: place,
    // Building the room makes it the current one, which drops the plan back to a single room;
    // `place` puts the view back on the home once the room is standing on it.
    addTemplate: (key) => place(loadTemplate(key).id),
  };
}

/**
 * Starting the current room's life on a plan: joining one that exists, or opening a new one.
 *
 * Shared by the Plan/Home toggle and the Room tab, which ask the same question from opposite
 * ends of the window and must not answer it two different ways.
 */
export function useJoinHome(): {
  homes: Home[];
  join(homeId: string): PlaceRoomResult;
  start(): PlaceRoomResult;
} {
  const rooms = useRoom((s) => s.rooms);
  const homes = useRoom((s) => s.homes);
  const currentId = useRoom((s) => s.currentId);
  const createHome = useRoom((s) => s.createHome);
  const addRoomToHome = useRoom((s) => s.addRoomToHome);
  const setPlanView = useRoom((s) => s.setPlanView);

  const join = (homeId: string): PlaceRoomResult => {
    const target = homes[homeId];
    if (!target) return { ok: false, error: 'That home is gone.' };
    const b = homeBounds(target, rooms);
    const r = addRoomToHome(homeId, currentId, b.w > 0 ? b.x + b.w : 0, b.w > 0 ? b.y : 0);
    if (r.ok) setPlanView('home');
    return r;
  };

  return {
    homes: Object.values(homes),
    join,
    start: () => {
      const made = createHome({ name: `${rooms[currentId]?.name ?? 'My'} home` });
      const r = addRoomToHome(made.id, currentId, 0, 0);
      if (r.ok) setPlanView('home');
      return r;
    },
  };
}
