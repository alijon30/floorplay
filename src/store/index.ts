// src/store/index.ts
import { useStore } from 'zustand';
import type { StateStorage } from 'zustand/middleware';
import { createRoomStore, type RoomState } from './roomStore';

function safeLocalStorage(): StateStorage | undefined {
  try {
    if (typeof localStorage === 'undefined') return undefined;
    localStorage.setItem('__floorplay_probe', '1');
    localStorage.removeItem('__floorplay_probe');
    return localStorage;
  } catch {
    return undefined;
  }
}

export const roomStore = createRoomStore({ storage: safeLocalStorage() });
export function useRoom<T>(selector: (s: RoomState) => T): T {
  return useStore(roomStore, selector);
}
export type { RoomState, RoomStore, UiState, DialogName, PropsTab, PlanView, DispatchResult, PlaceRoomResult } from './roomStore';
