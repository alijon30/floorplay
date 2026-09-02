// src/store/roomStore.ts
import { createStore, type StoreApi } from 'zustand/vanilla';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';
import type { Analysis, CameraPose, Category, LedgerEntry, Op, Proposal, Room, Wall } from '../engine/types';
import { analyze } from '../engine/analyze';
import { applyOps, describeOps } from '../engine/ops';
import { evaluateOps } from '../engine/evaluate';
import { makeDemoRoom, makeEmptyRoom } from '../engine/rooms';
import { newId } from '../engine/ids';
import { STORAGE_KEY } from '../config';

export interface UiState {
  selectedItemId: string | null;
  hoveredProposalId: string | null;
  proposeFirst: boolean;
  catalogOpen: boolean;
  catalogFilter: { category?: Category; fitsItemId?: string } | null;
  camera: CameraPose;
}

export type DispatchInput = { ops: Op[]; actor: 'human' | 'agent'; summary?: string; tool?: string };
export type DispatchResult =
  | { ok: true; entry: LedgerEntry; analysis: Analysis }
  | { ok: false; error: string; message: string; itemId?: string };

export interface RoomState {
  rooms: Record<string, Room>;
  currentId: string;
  analysis: Analysis;
  ui: UiState;
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
  setCatalogOpen(open: boolean, filter?: UiState['catalogFilter']): void;
  setCamera(pose: Partial<CameraPose>): void;
  setDaylightHour(hour: number): void;
  setNorthWall(wall: Wall): void;
  renameRoom(name: string): void;
  createRoom(input: { name: string; width: number; depth: number; height: number }): Room;
  loadDemo(): Room;
  switchRoom(id: string): void;
  deleteRoom(id: string): void;
}

export type RoomStore = StoreApi<RoomState>;

const LEDGER_CAP = 200;

const defaultUi = (): UiState => ({
  selectedItemId: null,
  hoveredProposalId: null,
  proposeFirst: false,
  catalogOpen: false,
  catalogFilter: null,
  camera: { mode: 'orbit', x: 180, y: 260, z: 160, yaw: 0, pitch: 0 },
});

export function createRoomStore(opts: { storage?: StateStorage } = {}): RoomStore {
  const initialRoom = makeDemoRoom();

  const initializer = (set: StoreApi<RoomState>['setState'], get: StoreApi<RoomState>['getState']): RoomState => {
    const setRoom = (room: Room, extra: Partial<RoomState> = {}) =>
      set((s) => ({ rooms: { ...s.rooms, [room.id]: room }, analysis: room.id === s.currentId ? analyze(room) : s.analysis, ...extra }));

    return {
      rooms: { [initialRoom.id]: initialRoom },
      currentId: initialRoom.id,
      analysis: analyze(initialRoom),
      ui: defaultUi(),

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

      select(id) { set((s) => ({ ui: { ...s.ui, selectedItemId: id } })); },
      hoverProposal(id) { set((s) => ({ ui: { ...s.ui, hoveredProposalId: id } })); },
      setProposeFirst(v) { set((s) => ({ ui: { ...s.ui, proposeFirst: v } })); },
      setCatalogOpen(open, filter = null) { set((s) => ({ ui: { ...s.ui, catalogOpen: open, catalogFilter: filter } })); },
      setCamera(pose) { set((s) => ({ ui: { ...s.ui, camera: { ...s.ui.camera, ...pose } } })); },

      setDaylightHour(hour) {
        const h = Math.max(6, Math.min(20, Math.round(hour)));
        setRoom({ ...get().current(), daylightHour: h });
      },
      setNorthWall(wall) { setRoom({ ...get().current(), northWall: wall }); },
      renameRoom(name) { setRoom({ ...get().current(), name }); },

      createRoom({ name, width, depth, height }) {
        const room = makeEmptyRoom(name, width, depth, height);
        set((s) => ({ rooms: { ...s.rooms, [room.id]: room }, currentId: room.id, analysis: analyze(room), ui: { ...s.ui, selectedItemId: null, hoveredProposalId: null } }));
        return room;
      },
      loadDemo() {
        const room = makeDemoRoom();
        set((s) => ({ rooms: { ...s.rooms, [room.id]: room }, currentId: room.id, analysis: analyze(room), ui: { ...s.ui, selectedItemId: null, hoveredProposalId: null } }));
        return room;
      },
      switchRoom(id) {
        const room = get().rooms[id];
        if (!room) return;
        set((s) => ({ currentId: id, analysis: analyze(room), ui: { ...s.ui, selectedItemId: null, hoveredProposalId: null } }));
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

  return createStore<RoomState>()(
    persist(initializer, {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => opts.storage!),
      partialize: (s) => ({ rooms: s.rooms, currentId: s.currentId, ui: { proposeFirst: s.ui.proposeFirst } }) as unknown as RoomState,
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<RoomState> & { ui?: Partial<UiState> };
        const rooms = p.rooms && Object.keys(p.rooms).length ? p.rooms : current.rooms;
        const currentId = p.currentId && rooms[p.currentId] ? p.currentId : Object.keys(rooms)[0]!;
        return { ...current, rooms, currentId, analysis: analyze(rooms[currentId]!), ui: { ...current.ui, ...(p.ui ?? {}) } };
      },
    }),
  );
}
