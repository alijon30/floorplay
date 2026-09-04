// src/store/roomStore.ts
import { createStore, type StoreApi } from 'zustand/vanilla';
import { persist, type PersistStorage, type StateStorage } from 'zustand/middleware';
import type { Analysis, CameraPose, Category, Doorway, Home, LedgerEntry, Op, Opening, Proposal, Room, RoomKind, Wall } from '../engine/types';
import { DEFAULT_FINISH, ROOM_KINDS } from '../engine/types';
import { analyze } from '../engine/analyze';
import { applyOps, describeOps } from '../engine/ops';
import { evaluateOps } from '../engine/evaluate';
import { makeDemoRoom, makeEmptyRoom } from '../engine/rooms';
import { buildTemplateRoom } from '../engine/templates';
import { doorwayFits, doorwayOpenings, homeContaining, snapRoomPlacement } from '../engine/home';
import { buildHomeFromTemplate, type HomeTemplateKey } from '../engine/homeTemplates';
import { newId } from '../engine/ids';
import { STORAGE_KEY } from '../config';
import { createDebouncedStorage } from './persistence';

export interface UiState {
  selectedItemId: string | null;
  hoveredProposalId: string | null;
  /** Set once the human closes the first-run card; persisted so it stays closed. */
  onboardingDismissed: boolean;
  /**
   * What the Catalog tab is narrowed to: a category, or the item a replacement is being found
   * for. Cleared when the column moves off the Catalog tab, because "Alternatives for the
   * sofa" is a question you have stopped asking once you look at something else.
   */
  catalogFilter: { category?: Category; fitsItemId?: string } | null;
  /** The new-room dialog. Held here so the onboarding card can open it too. */
  wizardOpen: boolean;
  /**
   * Which of the top bar's shared panels is open. Held here rather than in `TopBar`, so the
   * room panel on the right rail can open the very same dialogs.
   */
  dialog: DialogName | null;
  camera: CameraPose;
  /** Draw the daylight tint over the plan. Off is for reading the plan itself. */
  showDaylight: boolean;
  /** Cast and catch shadows in the 3D view. Off buys frames on a slow machine. */
  showShadows: boolean;
  /**
   * The properties column on the right. Closing it is a lasting preference, so it persists:
   * someone who wants the viewports uncovered should not have to close it every visit.
   */
  roomPanelOpen: boolean;
  /**
   * Which tab the properties column shows. Held in the store rather than in the panel
   * because selecting an item — on the plan, in 3D, or by an agent's tool call — has to move
   * it to Selection from wherever the click happened.
   */
  propsTab: PropsTab;
  /** The ledger drawer above the status strip. Collapsed it is one line. */
  ledgerOpen: boolean;
  /** The drafting grid under the plan. Off is for reading the drawing itself. */
  showGrid: boolean;
  /**
   * What the plan viewport draws: the current room on its own, or the whole home it stands in.
   *
   * Not persisted. A home is a place you step back to look at rather than a setting, and a
   * visit that opened on the whole flat when the last thing you did was move a chair would have
   * lost your place. Switching to a room in no home forces it back to `room`.
   */
  planView: PlanView;
  /** While on, clicking a wall two rooms share cuts a doorway through it. */
  doorwayMode: boolean;
  /**
   * The wall the user is working on right now — picked in the Style tab — so the plan and the 3D view can point at the same wall the paint is landing on.
   * Null while nothing in particular is being worked on, or while "All walls" is the target.
   */
  highlightWall: Wall | null;
}

/** The two things the right viewport can be. */

/** The two things the plan viewport can be: one room, or the home it belongs to. */
export type PlanView = 'room' | 'home';

/**
 * The tabs of the properties column, in the order they are drawn.
 *
 * The catalog is one of them rather than a column of its own: two panels either side of the
 * plan pushed the drawing into a slot, and everything in the catalog is a property of the room
 * you are about to change anyway.
 */
export type PropsTab = 'catalog' | 'room' | 'style' | 'selection' | 'issues' | 'buy';

/** The panels both the top bar and the room panel can open. The brief lives in `RoomPanel`. */
export type DialogName = 'shell';

export type DispatchInput = { ops: Op[]; actor: 'human' | 'agent'; summary?: string; tool?: string };
export type DispatchResult =
  | { ok: true; entry: LedgerEntry; analysis: Analysis }
  | { ok: false; error: string; message: string; itemId?: string };

/** What a doorway needs to be cut, plus who is asking. Width and kind have sensible defaults. */
export interface CutDoorwayInput {
  roomId: string;
  wall: Wall;
  offset: number;
  width?: number;
  kind?: 'door' | 'passage';
  /** Which neighbour to open into, when more than one room lies behind that wall. */
  otherRoomId?: string;
  actor?: 'human' | 'agent';
  tool?: string;
}

/**
 * Where a room came to rest on the plan, and what the move cost.
 *
 * `removedDoorways` names the doorways the move broke: a room dragged away from its neighbour
 * keeps openings at offsets that no longer meet anything, so they are taken out of both rooms
 * rather than left as holes onto nothing. Empty on every move that keeps its walls.
 */
export type PlaceRoomResult =
  | { ok: true; x: number; y: number; snapped: boolean; removedDoorways: string[] }
  | { ok: false; error: string };
export type CutDoorwayResult = { ok: true; doorway: Doorway } | { ok: false; error: string; hint?: string };

export interface RoomState {
  rooms: Record<string, Room>;
  currentId: string;
  /** Every home, keyed by id. A room belongs to at most one of them; most belong to none. */
  homes: Record<string, Home>;
  /** The home the current room stands in, or the one being built. Null while working on a lone room. */
  currentHomeId: string | null;
  analysis: Analysis;
  ui: UiState;
  /** Last persistence failure, surfaced as a small warning. Never persisted. */
  persistError: string | null;
  current(): Room;
  /** The home named by `currentHomeId`, or null. */
  currentHome(): Home | null;
  dispatch(input: DispatchInput): DispatchResult;
  propose(input: { label: string; ops: Op[] }): { ok: true; proposal: Proposal } | { ok: false; error: string; message: string };
  acceptProposal(id: string, actor?: 'human' | 'agent'): DispatchResult;
  rejectProposal(id: string): boolean;
  updateProposalOp(proposalId: string, index: number, op: Op): void;
  undo(actor?: 'human' | 'agent'): DispatchResult | null;
  revertTo(entryId: string, actor?: 'human' | 'agent'): DispatchResult | null;
  select(id: string | null): void;
  hoverProposal(id: string | null): void;
  setShowDaylight(v: boolean): void;
  setShowShadows(v: boolean): void;
  setRoomPanelOpen(open: boolean): void;
  setPropsTab(tab: PropsTab): void;
  setLedgerOpen(open: boolean): void;
  setShowGrid(v: boolean): void;
  setPlanView(v: PlanView): void;
  setDoorwayMode(v: boolean): void;
  setHighlightWall(wall: Wall | null): void;
  dismissOnboarding(): void;
  setCatalogOpen(open: boolean, filter?: UiState['catalogFilter']): void;
  setWizardOpen(open: boolean): void;
  openDialog(name: DialogName): void;
  closeDialog(): void;
  setCamera(pose: Partial<CameraPose>): void;
  setDaylightHour(hour: number): void;
  setNorthWall(wall: Wall): void;
  renameRoom(name: string): void;
  createRoom(input: { name: string; width: number; depth: number; height: number }): Room;
  loadDemo(): Room;
  /** Create a room from a ready-made template and switch to it. */
  loadTemplate(key: RoomKind, name?: string): Room;
  switchRoom(id: string): void;
  deleteRoom(id: string): void;

  /** Start an empty home and make it the one being worked on. */
  createHome(input: { name: string }): Home;
  /** Build a ready-made home, add its rooms, and open on its entrance. */
  createHomeFromTemplate(key: HomeTemplateKey): Home;
  /** Stand a room on a home's plan at (x, y) in cm, snapping to its neighbours. */
  addRoomToHome(homeId: string, roomId: string, x: number, y: number): PlaceRoomResult;
  /** Move a room already on a plan, under the same snapping and overlap rules. */
  moveRoom(roomId: string, x: number, y: number): PlaceRoomResult;
  /** Take a room off its plan, removing its doorways first. The room itself survives. */
  removeRoomFromHome(roomId: string): boolean;
  cutDoorway(input: CutDoorwayInput): CutDoorwayResult;
  removeDoorway(id: string, actor?: 'human' | 'agent'): boolean;
  /** Name the room the front door is in, so reachability starts there. */
  setEntrance(roomId: string): void;
  renameHome(name: string): void;
  /** Delete a home. Its rooms survive as standalone rooms, minus the doorways between them. */
  deleteHome(id: string): void;
}

export type RoomStore = StoreApi<RoomState>;

/** A store whose persistence can be forced to write immediately. Only set when persisting. */
export type FlushableRoomStore = RoomStore & { flush?: () => void };

const LEDGER_CAP = 200;
const DEFAULT_DEBOUNCE_MS = 300;

/**
 * Fill in fields a room saved by an older version of the app has never heard of.
 *
 * Rooms are persisted whole, so a save from before room finishes and catalog room tags existed
 * would otherwise come back missing both and break rendering and filtering.
 */
function upgradeRoom(room: Room): Room {
  const extras = room.catalogExtras ?? [];
  const needsExtras = extras.some((c) => !c.rooms || c.rooms.length === 0);
  if (room.finish && !needsExtras) return room;
  return {
    ...room,
    finish: room.finish ?? { ...DEFAULT_FINISH },
    catalogExtras: needsExtras ? extras.map((c) => (c.rooms && c.rooms.length ? c : { ...c, rooms: [...ROOM_KINDS] })) : extras,
  };
}

/**
 * Drop the parts of a saved home whose rooms are no longer in the store.
 *
 * Rooms and homes are saved side by side, so a room deleted by a version of the app that had
 * never heard of homes can leave a placement behind. A doorway to a room that is gone would
 * draw a hole into nothing, so it goes with the placement.
 */
function upgradeHome(home: Home, rooms: Record<string, Room>): Home {
  const placed = home.rooms.filter((p) => rooms[p.roomId]);
  const doorways = home.doorways.filter((d) => rooms[d.a.roomId] && rooms[d.b.roomId]);
  if (placed.length === home.rooms.length && doorways.length === home.doorways.length) return home;
  const { entranceRoomId, ...rest } = home;
  return {
    ...rest, rooms: placed, doorways,
    ...(entranceRoomId && rooms[entranceRoomId] ? { entranceRoomId } : {}),
  };
}

const defaultUi = (): UiState => ({
  selectedItemId: null,
  hoveredProposalId: null,
  onboardingDismissed: false,
  catalogFilter: null,
  wizardOpen: false,
  dialog: null,
  camera: { mode: 'orbit', x: 180, y: 260, z: 160, yaw: 0, pitch: 0 },
  showDaylight: true,
  showShadows: true,
  roomPanelOpen: true,
  propsTab: 'room',
  ledgerOpen: false,
  showGrid: true,
  planView: 'room',
  doorwayMode: false,
  highlightWall: null,
});

export function createRoomStore(opts: { storage?: StateStorage; debounceMs?: number } = {}): RoomStore {
  const initialRoom = makeDemoRoom();

  const initializer = (set: StoreApi<RoomState>['setState'], get: StoreApi<RoomState>['getState']): RoomState => {
    const setRoom = (room: Room, extra: Partial<RoomState> = {}) =>
      set((s) => ({ rooms: { ...s.rooms, [room.id]: room }, analysis: room.id === s.currentId ? analyze(room) : s.analysis, ...extra }));

    const setHome = (home: Home) => set((s) => ({ homes: { ...s.homes, [home.id]: home } }));

    /**
     * Apply ops to a named room and record one ledger entry there.
     *
     * `dispatch` is this with the current room filled in. A doorway is the reason the two are
     * separate: it changes two rooms at once, and the one that is not on screen still deserves
     * its own line in its own history.
     */
    const dispatchTo = (roomId: string, { ops, actor, summary, tool }: DispatchInput): DispatchResult => {
      const room = get().rooms[roomId];
      if (!room) return { ok: false, error: 'not_found', message: `No room ${roomId}` };
      const r = applyOps(room, ops);
      if (!r.ok) return { ok: false, error: r.error, message: r.message, ...(r.itemId ? { itemId: r.itemId } : {}) };
      const analysis = analyze(r.room);
      const entry: LedgerEntry = {
        id: newId('led'), at: Date.now(), actor, ...(tool ? { tool } : {}),
        summary: summary ?? describeOps(room, ops), ops, inverse: r.inverse, violationsAfter: analysis.violations.length,
      };
      const next: Room = { ...r.room, ledger: [...r.room.ledger, entry].slice(-LEDGER_CAP) };
      set((s) => (next.id === s.currentId
        ? { rooms: { ...s.rooms, [next.id]: next }, analysis }
        : { rooms: { ...s.rooms, [next.id]: next } }));
      return { ok: true, entry, analysis };
    };

    /**
     * Take doorways out of a home, removing the linked opening from each room they join.
     *
     * The home comes back changed rather than being written here, so a caller that is also
     * moving a room off the plan writes the whole thing once.
     */
    const dropDoorways = (home: Home, doorways: Doorway[], actor: 'human' | 'agent'): Home => {
      for (const d of doorways) {
        for (const side of [d.a, d.b]) {
          const room = get().rooms[side.roomId];
          const opening = room?.openings.find((o) => o.doorwayId === d.id);
          if (!room || !opening) continue;
          const otherId = side.roomId === d.a.roomId ? d.b.roomId : d.a.roomId;
          const other = get().rooms[otherId];
          dispatchTo(side.roomId, { ops: [{ type: 'removeOpening', id: opening.id }], actor, summary: `Removed doorway to ${other?.name ?? 'the next room'}` });
        }
      }
      const gone = new Set(doorways.map((d) => d.id));
      return { ...home, doorways: home.doorways.filter((d) => !gone.has(d.id)) };
    };

    /** Where a room lands on a plan, or why it cannot go there. Shared by add and move. */
    const placeOnPlan = (home: Home, room: Room, x: number, y: number): PlaceRoomResult => {
      const snap = snapRoomPlacement(home, get().rooms, room.id, x, y, room.width, room.depth);
      if (snap.overlaps.length) {
        const names = snap.overlaps.map((id) => get().rooms[id]?.name ?? id).join(', ');
        return { ok: false, error: `${room.name} would overlap ${names}. Move it clear of them, or against a wall.` };
      }
      const placement = { roomId: room.id, x: snap.x, y: snap.y };
      const already = home.rooms.some((p) => p.roomId === room.id);
      const moved: Home = { ...home, rooms: already ? home.rooms.map((p) => (p.roomId === room.id ? placement : p)) : [...home.rooms, placement] };
      // A doorway is only a doorway while both its sides still stand on a wall the two rooms
      // share. The ones this move pulled apart come out of both rooms here, so the plan never
      // carries a door onto a room that has walked away from it.
      const broken = moved.doorways.filter(
        (d) => (d.a.roomId === room.id || d.b.roomId === room.id) && !doorwayFits(moved, get().rooms, d),
      );
      setHome(broken.length ? dropDoorways(moved, broken, 'human') : moved);
      set((s) => (s.currentId === room.id ? { currentHomeId: home.id } : {}));
      return { ok: true, x: snap.x, y: snap.y, snapped: snap.snapped, removedDoorways: broken.map((d) => d.id) };
    };

    /** The patch every "now look at this room" action shares. A standalone room has no home view. */
    const lookAt = (s: RoomState, roomId: string): Partial<RoomState> => {
      const home = homeContaining(s.homes, roomId);
      return {
        currentId: roomId,
        currentHomeId: home?.id ?? null,
        ui: {
          ...s.ui,
          selectedItemId: null,
          hoveredProposalId: null,
          propsTab: s.ui.propsTab === 'selection' ? 'room' : s.ui.propsTab,
          planView: home ? s.ui.planView : 'room',
          doorwayMode: home ? s.ui.doorwayMode : false,
        },
      };
    };

    return {
      rooms: { [initialRoom.id]: initialRoom },
      currentId: initialRoom.id,
      homes: {},
      currentHomeId: null,
      analysis: analyze(initialRoom),
      ui: defaultUi(),
      persistError: null,

      current() {
        const s = get();
        return s.rooms[s.currentId]!;
      },

      currentHome() {
        const s = get();
        return (s.currentHomeId && s.homes[s.currentHomeId]) || null;
      },

      dispatch(input) {
        return dispatchTo(get().currentId, input);
      },

      propose({ label, ops }) {
        const room = get().current();
        const ev = evaluateOps(room, ops);
        if (!ev.ok) return { ok: false, error: ev.error, message: ev.message };
        const proposal: Proposal = {
          id: newId('prop'), label, ops, createdAt: Date.now(),
          metricsBefore: get().analysis.metrics, metricsAfter: ev.analysis.metrics, violationsAfter: ev.analysis.violations,
        };
        setRoom({ ...room, proposals: [...room.proposals, proposal] });
        return { ok: true, proposal };
      },

      acceptProposal(id, actor = 'agent') {
        const room = get().current();
        const p = room.proposals.find((x) => x.id === id);
        if (!p) return { ok: false, error: 'not_found', message: `No proposal ${id}` };
        const others = room.proposals.filter((x) => x.id !== id).map((x) => x.label);
        const summary = `Accepted proposal: ${p.label}` + (others.length ? ` (discarded ${others.join(', ')})` : '');
        const r = get().dispatch({ ops: p.ops, actor, summary, tool: 'propose_layout' });
        if (!r.ok) return r;
        setRoom({ ...get().current(), proposals: [] });
        return r;
      },

      rejectProposal(id) {
        const room = get().current();
        if (!room.proposals.some((x) => x.id === id)) return false;
        setRoom({ ...room, proposals: room.proposals.filter((x) => x.id !== id) });
        return true;
      },


      updateProposalOp(proposalId, index, op) {
        const room = get().current();
        const p = room.proposals.find((x) => x.id === proposalId);
        if (!p) return;
        const ops = p.ops.map((o, i) => (i === index ? op : o));
        const ev = evaluateOps(room, ops);
        if (!ev.ok) return;
        const updated: Proposal = { ...p, ops, metricsAfter: ev.analysis.metrics, violationsAfter: ev.analysis.violations };
        setRoom({ ...room, proposals: room.proposals.map((x) => (x.id === proposalId ? updated : x)) });
      },

      undo(actor = 'human') {
        const room = get().current();
        const last = room.ledger[room.ledger.length - 1];
        if (!last) return null;
        return get().dispatch({ ops: last.inverse, actor, summary: `Undid: ${last.summary}` });
      },

      revertTo(entryId, actor = 'human') {
        const room = get().current();
        const idx = room.ledger.findIndex((e) => e.id === entryId);
        if (idx < 0) return null;
        const after = room.ledger.slice(idx + 1);
        if (after.length === 0) return null;
        const ops = [...after].reverse().flatMap((e) => e.inverse);
        const target = room.ledger[idx]!;
        return get().dispatch({ ops, actor, summary: `Reverted to: ${target.summary}` });
      },

      // Selecting anything moves the properties column to its tab and opens the column if it
      // was closed: a click that quietly fills a panel nobody can see has done nothing.
      select(id) {
        set((s) => ({
          ui: {
            ...s.ui,
            selectedItemId: id,
            propsTab: id ? 'selection' : s.ui.propsTab === 'selection' ? 'room' : s.ui.propsTab,
            roomPanelOpen: id ? true : s.ui.roomPanelOpen,
          },
        }));
      },
      hoverProposal(id) { set((s) => ({ ui: { ...s.ui, hoveredProposalId: id } })); },
      setShowDaylight(v) { set((s) => ({ ui: { ...s.ui, showDaylight: v } })); },
      setShowShadows(v) { set((s) => ({ ui: { ...s.ui, showShadows: v } })); },
      // Opening the room tab puts the room in the column's one slot, so the selection has to
      // give way — otherwise the button people press to see the room does nothing they can see.
      setRoomPanelOpen(open) { set((s) => ({ ui: { ...s.ui, roomPanelOpen: open, propsTab: open ? 'room' : s.ui.propsTab, selectedItemId: open ? null : s.ui.selectedItemId } })); },
      // Leaving the Catalog tab drops whatever narrowed it, so coming back shows the catalog
      // rather than the last question somebody asked of it.
      setPropsTab(tab) { set((s) => ({ ui: { ...s.ui, propsTab: tab, roomPanelOpen: true, catalogFilter: tab === 'catalog' ? s.ui.catalogFilter : null } })); },
      setLedgerOpen(open) { set((s) => ({ ui: { ...s.ui, ledgerOpen: open } })); },
      setShowGrid(v) { set((s) => ({ ui: { ...s.ui, showGrid: v } })); },
      // There is no home to draw when the current room stands alone, and cutting doorways is
      // something you do on the home plan, so leaving it puts the tool down.
      setPlanView(v) { set((s) => (v === 'home' && !s.currentHomeId ? s : { ui: { ...s.ui, planView: v, doorwayMode: v === 'home' ? s.ui.doorwayMode : false } })); },
      setDoorwayMode(v) { set((s) => ({ ui: { ...s.ui, doorwayMode: v } })); },
      setHighlightWall(wall) { set((s) => (s.ui.highlightWall === wall ? s : { ui: { ...s.ui, highlightWall: wall } })); },
      dismissOnboarding() { set((s) => ({ ui: { ...s.ui, onboardingDismissed: true } })); },
      // The catalog is a tab now, so opening it is opening the column on that tab. Closing it
      // hands the column back to whatever was being looked at rather than shutting it: the
      // Replace button that calls this has just changed the selected piece.
      setCatalogOpen(open, filter = null) {
        set((s) => ({
          ui: {
            ...s.ui,
            catalogFilter: open ? filter : null,
            roomPanelOpen: open ? true : s.ui.roomPanelOpen,
            propsTab: open ? 'catalog' : s.ui.propsTab === 'catalog' ? (s.ui.selectedItemId ? 'selection' : 'room') : s.ui.propsTab,
          },
        }));
      },
      setWizardOpen(open) { set((s) => ({ ui: { ...s.ui, wizardOpen: open } })); },
      openDialog(name) { set((s) => ({ ui: { ...s.ui, dialog: name } })); },
      closeDialog() { set((s) => ({ ui: { ...s.ui, dialog: null } })); },
      setCamera(pose) { set((s) => ({ ui: { ...s.ui, camera: { ...s.ui.camera, ...pose } } })); },

      setDaylightHour(hour) {
        const h = Math.max(6, Math.min(20, Math.round(hour)));
        setRoom({ ...get().current(), daylightHour: h });
      },
      setNorthWall(wall) { setRoom({ ...get().current(), northWall: wall }); },
      renameRoom(name) { setRoom({ ...get().current(), name }); },

      createRoom({ name, width, depth, height }) {
        const room = makeEmptyRoom(name, width, depth, height);
        set((s) => ({ rooms: { ...s.rooms, [room.id]: room }, analysis: analyze(room), ...lookAt(s, room.id) }));
        return room;
      },
      loadDemo() {
        const room = makeDemoRoom();
        set((s) => ({ rooms: { ...s.rooms, [room.id]: room }, analysis: analyze(room), ...lookAt(s, room.id) }));
        return room;
      },
      loadTemplate(key, name) {
        const room = buildTemplateRoom(key, name);
        set((s) => ({ rooms: { ...s.rooms, [room.id]: room }, analysis: analyze(room), ...lookAt(s, room.id) }));
        return room;
      },
      switchRoom(id) {
        const room = get().rooms[id];
        if (!room) return;
        set((s) => ({ analysis: analyze(room), ...lookAt(s, id) }));
      },
      deleteRoom(id) {
        // A room on a plan comes off it first, so the home never points at a room that is gone.
        if (homeContaining(get().homes, id)) get().removeRoomFromHome(id);
        const s = get();
        const rest = { ...s.rooms };
        delete rest[id];
        if (Object.keys(rest).length === 0) {
          const demo = makeDemoRoom();
          set({ rooms: { [demo.id]: demo }, currentId: demo.id, currentHomeId: null, analysis: analyze(demo) });
          return;
        }
        const nextId = s.currentId === id ? Object.keys(rest)[0]! : s.currentId;
        set({ rooms: rest, currentId: nextId, currentHomeId: homeContaining(s.homes, nextId)?.id ?? null, analysis: analyze(rest[nextId]!) });
      },

      createHome({ name }) {
        const home: Home = { id: newId('home'), name, rooms: [], doorways: [] };
        set((s) => ({ homes: { ...s.homes, [home.id]: home }, currentHomeId: home.id }));
        return home;
      },

      createHomeFromTemplate(key) {
        const { home, rooms } = buildHomeFromTemplate(key);
        const entrance = home.entranceRoomId ?? home.rooms[0]!.roomId;
        const added = Object.fromEntries(rooms.map((r) => [r.id, r]));
        set((s) => ({
          rooms: { ...s.rooms, ...added },
          homes: { ...s.homes, [home.id]: home },
          currentId: entrance,
          currentHomeId: home.id,
          analysis: analyze(added[entrance]!),
          // A ready-made home is worth looking at whole, so it opens on the plan of the flat.
          ui: { ...s.ui, selectedItemId: null, hoveredProposalId: null, propsTab: s.ui.propsTab === 'selection' ? 'room' : s.ui.propsTab, planView: 'home', doorwayMode: false },
        }));
        return home;
      },

      addRoomToHome(homeId, roomId, x, y) {
        const s = get();
        const home = s.homes[homeId];
        if (!home) return { ok: false, error: `No home ${homeId}` };
        const room = s.rooms[roomId];
        if (!room) return { ok: false, error: `No room ${roomId}` };
        const existing = homeContaining(s.homes, roomId);
        if (existing && existing.id !== homeId) return { ok: false, error: `${room.name} is already part of ${existing.name}. Take it off that plan first.` };
        return placeOnPlan(home, room, x, y);
      },

      moveRoom(roomId, x, y) {
        const s = get();
        const room = s.rooms[roomId];
        if (!room) return { ok: false, error: `No room ${roomId}` };
        const home = homeContaining(s.homes, roomId);
        if (!home) return { ok: false, error: `${room.name} is not on a floor plan` };
        return placeOnPlan(home, room, x, y);
      },

      removeRoomFromHome(roomId) {
        const home = homeContaining(get().homes, roomId);
        if (!home) return false;
        const touching = home.doorways.filter((d) => d.a.roomId === roomId || d.b.roomId === roomId);
        // The entrance key is dropped rather than set to undefined, so a home that loses its
        // front room falls back to whichever room still has a door outside.
        const { entranceRoomId, ...next } = dropDoorways(home, touching, 'human');
        setHome({
          ...next,
          rooms: next.rooms.filter((p) => p.roomId !== roomId),
          ...(entranceRoomId && entranceRoomId !== roomId ? { entranceRoomId } : {}),
        });
        set((s) => ({ currentHomeId: homeContaining(s.homes, s.currentId)?.id ?? null }));
        return true;
      },

      /**
       * Cut one doorway through the wall two rooms share, as an edit to each of them.
       *
       * Both rooms get their own ledger entry, so each room's history reads on its own. Undo in
       * one room therefore takes back only that room's half and leaves a door onto a blank wall
       * next door; `removeDoorway` is what puts the two sides back in step.
       */
      cutDoorway({ roomId, wall, offset, width = 80, kind = 'door', otherRoomId, actor = 'human', tool }) {
        const s = get();
        const room = s.rooms[roomId];
        if (!room) return { ok: false, error: `No room ${roomId}` };
        const home = homeContaining(s.homes, roomId);
        if (!home) return { ok: false, error: `${room.name} is not on a floor plan`, hint: 'Add it to a home first; a doorway joins two rooms that share a wall.' };

        const built = doorwayOpenings(home, s.rooms, { roomId, wall, offset, width, kind, ...(otherRoomId ? { otherRoomId } : {}) });
        if (!built.ok) return { ok: false, error: built.error, hint: built.hint };

        const name = (id: string) => s.rooms[id]?.name ?? 'the next room';
        const entry = (opening: Opening, into: string): DispatchInput =>
          ({ ops: [{ type: 'addOpening', opening }], actor, ...(tool ? { tool } : {}), summary: `Cut doorway to ${into}` });
        const ra = dispatchTo(built.doorway.a.roomId, entry(built.a, name(built.doorway.b.roomId)));
        if (!ra.ok) return { ok: false, error: ra.message };
        const rb = dispatchTo(built.doorway.b.roomId, entry(built.b, name(built.doorway.a.roomId)));
        if (!rb.ok) {
          // Ids are minted here, so this cannot happen; rolling the first half back anyway is
          // what keeps "a doorway is one hole in two rooms" true even if it ever does.
          dispatchTo(built.doorway.a.roomId, { ops: [{ type: 'removeOpening', id: built.a.id }], actor, summary: `Removed doorway to ${name(built.doorway.b.roomId)}` });
          return { ok: false, error: rb.message };
        }
        setHome({ ...home, doorways: [...home.doorways, built.doorway] });
        return { ok: true, doorway: built.doorway };
      },

      removeDoorway(id, actor = 'human') {
        const home = Object.values(get().homes).find((h) => h.doorways.some((d) => d.id === id));
        const doorway = home?.doorways.find((d) => d.id === id);
        if (!home || !doorway) return false;
        setHome(dropDoorways(home, [doorway], actor));
        return true;
      },

      setEntrance(roomId) {
        const home = homeContaining(get().homes, roomId);
        if (!home) return;
        setHome({ ...home, entranceRoomId: roomId });
      },

      renameHome(name) {
        const home = get().currentHome();
        if (!home) return;
        setHome({ ...home, name });
      },

      deleteHome(id) {
        const home = get().homes[id];
        if (!home) return;
        // The rooms outlive the home, so the doorways between them go: a door onto a wall that
        // is no longer there would be a hole in a room nobody asked for.
        dropDoorways(home, home.doorways, 'human');
        set((s) => {
          const rest = { ...s.homes };
          delete rest[id];
          const stillHome = s.currentHomeId === id ? null : s.currentHomeId;
          return {
            homes: rest,
            currentHomeId: stillHome,
            ui: stillHome ? s.ui : { ...s.ui, planView: 'room', doorwayMode: false },
          };
        });
      },
    };
  };

  if (!opts.storage) return createStore<RoomState>(initializer);

  // Declared before the store so onError can reach it; storage errors raised during the
  // initial hydration land before there is a store to write to, so they are held here.
  let store: RoomStore | undefined;
  let pendingError: string | null = null;

  const storage = createDebouncedStorage(opts.storage, {
    delayMs: opts.debounceMs ?? DEFAULT_DEBOUNCE_MS,
    onError: (e) => {
      const message = e instanceof Error ? e.message : String(e);
      if (!store) {
        pendingError = message;
        return;
      }
      // Writing persistError itself triggers another persist write, which fails again on
      // a broken storage. Bailing when the message is unchanged stops that loop.
      if (store.getState().persistError === message) return;
      store.setState({ persistError: message });
    },
  });

  store = createStore<RoomState>()(
    persist(initializer, {
      name: STORAGE_KEY,
      storage: storage as unknown as PersistStorage<RoomState>,
      partialize: (s) => ({ rooms: s.rooms, currentId: s.currentId, homes: s.homes, currentHomeId: s.currentHomeId, ui: { onboardingDismissed: s.ui.onboardingDismissed, showDaylight: s.ui.showDaylight, showShadows: s.ui.showShadows, showGrid: s.ui.showGrid, roomPanelOpen: s.ui.roomPanelOpen, ledgerOpen: s.ui.ledgerOpen } }) as unknown as RoomState,
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<RoomState> & { ui?: Partial<UiState> };
        const stored = p.rooms && Object.keys(p.rooms).length ? p.rooms : current.rooms;
        const rooms = Object.fromEntries(Object.entries(stored).map(([id, r]) => [id, upgradeRoom(r)]));
        const currentId = p.currentId && rooms[p.currentId] ? p.currentId : Object.keys(rooms)[0]!;
        // A save from before homes existed simply has none, and one whose rooms were deleted
        // elsewhere keeps only the placements and doorways whose rooms are still here.
        const homes = Object.fromEntries(Object.entries(p.homes ?? {}).map(([id, h]) => [id, upgradeHome(h, rooms)]));
        const currentHomeId = p.currentHomeId && homes[p.currentHomeId] ? p.currentHomeId : Object.values(homes).find((h) => h.rooms.some((r) => r.roomId === currentId))?.id ?? null;
        return { ...current, rooms, currentId, homes, currentHomeId, analysis: analyze(rooms[currentId]!), ui: { ...current.ui, ...(p.ui ?? {}) } };
      },
    }),
  );

  if (pendingError !== null) store.setState({ persistError: pendingError });
  (store as FlushableRoomStore).flush = storage.flush;
  return store;
}
