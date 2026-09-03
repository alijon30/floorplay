// src/store/roomStore.ts
import { createStore, type StoreApi } from 'zustand/vanilla';
import { persist, type PersistStorage, type StateStorage } from 'zustand/middleware';
import type { Analysis, CameraPose, Category, LedgerEntry, Op, Proposal, Room, RoomKind, Wall } from '../engine/types';
import { DEFAULT_FINISH, ROOM_KINDS } from '../engine/types';
import { analyze } from '../engine/analyze';
import { applyOps, describeOps } from '../engine/ops';
import { evaluateOps } from '../engine/evaluate';
import { makeDemoRoom, makeEmptyRoom } from '../engine/rooms';
import { buildTemplateRoom } from '../engine/templates';
import { newId } from '../engine/ids';
import { STORAGE_KEY } from '../config';
import { createDebouncedStorage } from './persistence';

export interface UiState {
  selectedItemId: string | null;
  hoveredProposalId: string | null;
  proposeFirst: boolean;
  /** Set once the human closes the first-run card; persisted so it stays closed. */
  onboardingDismissed: boolean;
  catalogOpen: boolean;
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
   * What the right viewport shows: the room in 3D, or one wall drawn straight on.
   *
   * Not persisted, and neither is `elevationWall`. Both are where you happen to be looking
   * right now rather than a preference, and a visit that opens on a wall elevation instead of
   * the room would read as the app having lost its place.
   */
  rightView: RightView;
  /** Which wall the elevation draws. */
  elevationWall: Wall;
}

/** The two things the right viewport can be. */
export type RightView = '3d' | 'wall';

/** The three tabs of the properties column. */
export type PropsTab = 'room' | 'style' | 'selection' | 'issues';

/** The panels both the top bar and the room panel can open. The brief lives in `RoomPanel`. */
export type DialogName = 'shell';

export type DispatchInput = { ops: Op[]; actor: 'human' | 'agent'; summary?: string; tool?: string };
export type DispatchResult =
  | { ok: true; entry: LedgerEntry; analysis: Analysis }
  | { ok: false; error: string; message: string; itemId?: string };

export interface RoomState {
  rooms: Record<string, Room>;
  currentId: string;
  analysis: Analysis;
  ui: UiState;
  /** Last persistence failure, surfaced as a small warning. Never persisted. */
  persistError: string | null;
  current(): Room;
  dispatch(input: DispatchInput): DispatchResult;
  propose(input: { label: string; ops: Op[] }): { ok: true; proposal: Proposal } | { ok: false; error: string; message: string };
  acceptProposal(id: string, actor?: 'human' | 'agent'): DispatchResult;
  rejectProposal(id: string): boolean;
  updateProposalOp(proposalId: string, index: number, op: Op): void;
  undo(actor?: 'human' | 'agent'): DispatchResult | null;
  revertTo(entryId: string, actor?: 'human' | 'agent'): DispatchResult | null;
  select(id: string | null): void;
  hoverProposal(id: string | null): void;
  setProposeFirst(v: boolean): void;
  setShowDaylight(v: boolean): void;
  setShowShadows(v: boolean): void;
  setRoomPanelOpen(open: boolean): void;
  setPropsTab(tab: PropsTab): void;
  setLedgerOpen(open: boolean): void;
  setShowGrid(v: boolean): void;
  setRightView(v: RightView): void;
  setElevationWall(wall: Wall): void;
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

const defaultUi = (): UiState => ({
  selectedItemId: null,
  hoveredProposalId: null,
  proposeFirst: false,
  onboardingDismissed: false,
  catalogOpen: false,
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
  rightView: '3d',
  elevationWall: 'top',
});

export function createRoomStore(opts: { storage?: StateStorage; debounceMs?: number } = {}): RoomStore {
  const initialRoom = makeDemoRoom();

  const initializer = (set: StoreApi<RoomState>['setState'], get: StoreApi<RoomState>['getState']): RoomState => {
    const setRoom = (room: Room, extra: Partial<RoomState> = {}) =>
      set((s) => ({ rooms: { ...s.rooms, [room.id]: room }, analysis: room.id === s.currentId ? analyze(room) : s.analysis, ...extra }));

    return {
      rooms: { [initialRoom.id]: initialRoom },
      currentId: initialRoom.id,
      analysis: analyze(initialRoom),
      ui: defaultUi(),
      persistError: null,

      current() {
        const s = get();
        return s.rooms[s.currentId]!;
      },

      dispatch({ ops, actor, summary, tool }) {
        const room = get().current();
        const r = applyOps(room, ops);
        if (!r.ok) return { ok: false, error: r.error, message: r.message, ...(r.itemId ? { itemId: r.itemId } : {}) };
        const analysis = analyze(r.room);
        const entry: LedgerEntry = {
          id: newId('led'), at: Date.now(), actor, ...(tool ? { tool } : {}),
          summary: summary ?? describeOps(room, ops), ops, inverse: r.inverse, violationsAfter: analysis.violations.length,
        };
        const next: Room = { ...r.room, ledger: [...r.room.ledger, entry].slice(-LEDGER_CAP) };
        set((s) => ({ rooms: { ...s.rooms, [next.id]: next }, analysis }));
        return { ok: true, entry, analysis };
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
      setProposeFirst(v) { set((s) => ({ ui: { ...s.ui, proposeFirst: v } })); },
      setShowDaylight(v) { set((s) => ({ ui: { ...s.ui, showDaylight: v } })); },
      setShowShadows(v) { set((s) => ({ ui: { ...s.ui, showShadows: v } })); },
      // Opening the room tab puts the room in the column's one slot, so the selection has to
      // give way — otherwise the button people press to see the room does nothing they can see.
      setRoomPanelOpen(open) { set((s) => ({ ui: { ...s.ui, roomPanelOpen: open, propsTab: open ? 'room' : s.ui.propsTab, selectedItemId: open ? null : s.ui.selectedItemId } })); },
      setPropsTab(tab) { set((s) => ({ ui: { ...s.ui, propsTab: tab, roomPanelOpen: true } })); },
      setLedgerOpen(open) { set((s) => ({ ui: { ...s.ui, ledgerOpen: open } })); },
      setShowGrid(v) { set((s) => ({ ui: { ...s.ui, showGrid: v } })); },
      setRightView(v) { set((s) => ({ ui: { ...s.ui, rightView: v } })); },
      // Picking a wall is also what the elevation is for, so it opens on the way through.
      setElevationWall(wall) { set((s) => ({ ui: { ...s.ui, elevationWall: wall, rightView: 'wall' } })); },
      dismissOnboarding() { set((s) => ({ ui: { ...s.ui, onboardingDismissed: true } })); },
      setCatalogOpen(open, filter = null) { set((s) => ({ ui: { ...s.ui, catalogOpen: open, catalogFilter: filter } })); },
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
        set((s) => ({ rooms: { ...s.rooms, [room.id]: room }, currentId: room.id, analysis: analyze(room), ui: { ...s.ui, selectedItemId: null, hoveredProposalId: null, propsTab: s.ui.propsTab === 'selection' ? 'room' : s.ui.propsTab } }));
        return room;
      },
      loadDemo() {
        const room = makeDemoRoom();
        set((s) => ({ rooms: { ...s.rooms, [room.id]: room }, currentId: room.id, analysis: analyze(room), ui: { ...s.ui, selectedItemId: null, hoveredProposalId: null, propsTab: s.ui.propsTab === 'selection' ? 'room' : s.ui.propsTab } }));
        return room;
      },
      loadTemplate(key, name) {
        const room = buildTemplateRoom(key, name);
        set((s) => ({ rooms: { ...s.rooms, [room.id]: room }, currentId: room.id, analysis: analyze(room), ui: { ...s.ui, selectedItemId: null, hoveredProposalId: null, propsTab: s.ui.propsTab === 'selection' ? 'room' : s.ui.propsTab } }));
        return room;
      },
      switchRoom(id) {
        const room = get().rooms[id];
        if (!room) return;
        set((s) => ({ currentId: id, analysis: analyze(room), ui: { ...s.ui, selectedItemId: null, hoveredProposalId: null, propsTab: s.ui.propsTab === 'selection' ? 'room' : s.ui.propsTab } }));
      },
      deleteRoom(id) {
        const s = get();
        const rest = { ...s.rooms };
        delete rest[id];
        if (Object.keys(rest).length === 0) {
          const demo = makeDemoRoom();
          set({ rooms: { [demo.id]: demo }, currentId: demo.id, analysis: analyze(demo) });
          return;
        }
        const nextId = s.currentId === id ? Object.keys(rest)[0]! : s.currentId;
        set({ rooms: rest, currentId: nextId, analysis: analyze(rest[nextId]!) });
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
      partialize: (s) => ({ rooms: s.rooms, currentId: s.currentId, ui: { proposeFirst: s.ui.proposeFirst, onboardingDismissed: s.ui.onboardingDismissed, showDaylight: s.ui.showDaylight, showShadows: s.ui.showShadows, showGrid: s.ui.showGrid, roomPanelOpen: s.ui.roomPanelOpen, ledgerOpen: s.ui.ledgerOpen } }) as unknown as RoomState,
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<RoomState> & { ui?: Partial<UiState> };
        const stored = p.rooms && Object.keys(p.rooms).length ? p.rooms : current.rooms;
        const rooms = Object.fromEntries(Object.entries(stored).map(([id, r]) => [id, upgradeRoom(r)]));
        const currentId = p.currentId && rooms[p.currentId] ? p.currentId : Object.keys(rooms)[0]!;
        return { ...current, rooms, currentId, analysis: analyze(rooms[currentId]!), ui: { ...current.ui, ...(p.ui ?? {}) } };
      },
    }),
  );

  if (pendingError !== null) store.setState({ persistError: pendingError });
  (store as FlushableRoomStore).flush = storage.flush;
  return store;
}
