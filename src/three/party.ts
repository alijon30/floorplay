// src/three/party.ts
import type { Home, Room, Wall } from '../engine/types';
import { sharedSegments } from '../engine/home';
import type { Box } from './Walls';
import { M, WALL_T } from './units';

/** A stretch of one wall, in cm from the wall's origin: the same origin `Opening.offset` uses. */
export type Interval = readonly [number, number];

/**
 * The stretches of each wall that another room stands against.
 *
 * A room draws its walls just outside its own rectangle, which is right for a room on its own
 * and wrong the moment two rooms meet edge to edge: each one's wall would then stand ten
 * centimetres inside the other's floor. Along a party stretch a room draws half a wall on its
 * own side of the line instead, so the two halves make one wall centred on the seam, each face
 * still wearing its own room's paint.
 */
export type PartyIntervals = Partial<Record<Wall, readonly Interval[]>>;

export function partyIntervals(home: Home, rooms: Record<string, Room>, roomId: string): PartyIntervals {
  const out: Partial<Record<Wall, Interval[]>> = {};
  for (const s of sharedSegments(home, rooms, roomId)) (out[s.wall] ??= []).push([s.start, s.end]);
  for (const list of Object.values(out)) list.sort((a, b) => a[0] - b[0]);
  return out;
}

/** How far into the room a box moves along a party stretch, in meters, and the thickness it takes there. */
export interface PartyInset { shift: number; thickness?: number }

/** A wall segment: from `[edge, edge + T]` outside to `[edge − T/2, edge]` inside. */
export const WALL_INSET: PartyInset = { shift: 0.75 * WALL_T, thickness: WALL_T / 2 };
/** Trim that hugs the inside face follows that face in by half a wall. */
export const TRIM_INSET: PartyInset = { shift: WALL_T / 2 };

const EPS = 1e-6;
/** How close a stretch has to come to a corner, in cm, to count as reaching it. */
const REACH = 1;

const isHorizontal = (wall: Wall): boolean => wall === 'top' || wall === 'bottom';

/** The run of a box along its wall, in meters. */
function runOf(b: Box, wall: Wall): [number, number] {
  return isHorizontal(wall) ? [b.x - b.w / 2, b.x + b.w / 2] : [b.z - b.d / 2, b.z + b.d / 2];
}

function insetBox(b: Box, wall: Wall, inset: PartyInset): Box {
  const t = inset.thickness;
  switch (wall) {
    case 'top': return { ...b, z: b.z + inset.shift, d: t ?? b.d };
    case 'bottom': return { ...b, z: b.z - inset.shift, d: t ?? b.d };
    case 'left': return { ...b, x: b.x + inset.shift, w: t ?? b.w };
    case 'right': return { ...b, x: b.x - inset.shift, w: t ?? b.w };
  }
}

/**
 * Cut boxes along their wall at every party boundary and move the party pieces in.
 *
 * A wall shared for part of its length keeps its outer run where it was and steps its party
 * run inside, which is what a real wall does where a neighbour's ends against it.
 */
export function splitByParty(boxes: Box[], wall: Wall, shared: readonly Interval[] | undefined, inset: PartyInset): Box[] {
  if (!shared || shared.length === 0) return boxes;
  const horizontal = isHorizontal(wall);
  const out: Box[] = [];
  for (const b of boxes) {
    const [u0, u1] = runOf(b, wall);
    const inside = shared.flatMap(([s, e]) => [s * M, e * M]).filter((u) => u > u0 + EPS && u < u1 - EPS);
    const cuts = [u0, ...inside, u1].sort((a, c) => a - c);
    for (let i = 0; i + 1 < cuts.length; i++) {
      const a = cuts[i]!, c = cuts[i + 1]!;
      if (c - a <= EPS) continue;
      const mid = (a + c) / 2;
      const piece: Box = horizontal ? { ...b, x: mid, w: c - a } : { ...b, z: mid, d: c - a };
      const party = shared.some(([s, e]) => mid >= s * M && mid <= e * M);
      out.push(party ? insetBox(piece, wall, inset) : piece);
    }
  }
  return out;
}

/** Whether any of a box's run lies along a party stretch. */
export function onParty(b: Box, wall: Wall, shared: readonly Interval[] | undefined): boolean {
  if (!shared) return false;
  const [u0, u1] = runOf(b, wall);
  return shared.some(([s, e]) => s * M < u1 - EPS && e * M > u0 + EPS);
}

/** Where along `wall` its corner with `other` lies, in cm. */
function cornerAt(wall: Wall, other: Wall, width: number, depth: number): number {
  const horizontal = isHorizontal(wall);
  const atStart = horizontal ? other === 'left' : other === 'top';
  return atStart ? 0 : horizontal ? width : depth;
}

const reaches = (shared: readonly Interval[] | undefined, u: number): boolean =>
  !!shared?.some(([s, e]) => s - REACH <= u && u <= e + REACH);

/**
 * Whether the post at the corner of two walls is standing where a neighbour already is.
 *
 * A post closes the slit between two walls drawn outside the room. Where either wall is a
 * party wall right up to that corner, the neighbour's rectangle reaches the corner too, and a
 * post there would stand in its floor; the walls themselves already meet on the line.
 */
export function cornerShared(party: PartyIntervals, a: Wall, b: Wall, width: number, depth: number): boolean {
  return reaches(party[a], cornerAt(a, b, width, depth)) || reaches(party[b], cornerAt(b, a, width, depth));
}
