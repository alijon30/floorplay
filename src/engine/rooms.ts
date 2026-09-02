// src/engine/rooms.ts
import type { Room } from './types';
import { newId } from './ids';

export const PRESETS = [
  { key: 'studio', name: 'Studio', width: 360, depth: 520, height: 260 },
  { key: 'bedroom', name: 'Bedroom', width: 320, depth: 400, height: 250 },
  { key: 'office', name: 'Home office', width: 300, depth: 300, height: 250 },
  { key: 'living', name: 'Living room', width: 450, depth: 550, height: 270 },
];

export function makeEmptyRoom(name: string, width: number, depth: number, height: number): Room {
  return {
    id: newId('room'),
    name,
    width, depth, height,
    northWall: 'top',
    openings: [],
    items: [],
    brief: { budget: 1000, currency: 'USD', needs: [], notes: '' },
    daylightHour: 12,
    catalogExtras: [],
    proposals: [],
    ledger: [],
  };
}

export function makeDemoRoom(): Room {
  const room = makeEmptyRoom('Demo studio', 360, 520, 260);
  room.openings = [
    { id: 'door-main', kind: 'door', wall: 'bottom', offset: 20, width: 80, height: 200, swing: 'in', hinge: 'start' },
    { id: 'window-east', kind: 'window', wall: 'right', offset: 190, width: 140, height: 120, sill: 90 },
  ];
  room.brief = { budget: 1200, currency: 'USD', needs: ['sleep', 'work from home', 'host two friends'], notes: 'I like natural light at my desk.' };
  room.daylightHour = 9;
  return room;
}
