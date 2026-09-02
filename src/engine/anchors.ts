// src/engine/anchors.ts
import type { CatalogItem, Category, PlacedItem, Rect, Room, Rotation, Wall } from './types';
import { WALLS } from './types';
import { findCatalogItem } from './catalog';
import { doorInsidePoint, footprint, openingSpan, rotatedDims } from './geometry';
import { computeDaylight } from './daylight';
import { rectCells } from './grid';
import { itemViolations } from './validate';
import { BLOCKING_KINDS } from './nearest';

export type Near = 'window' | 'door' | 'corner' | 'any';

export interface Suggestion {
  x: number;
  y: number;
  rotation: Rotation;
  reason: string;
  light: number;
  score: number;
}

/** Categories that want their back against a wall, so they are rotated to face the room. */
export const WALL_BACKED: ReadonlySet<Category> = new Set<Category>([
  'bed', 'wardrobe', 'desk', 'shelf', 'dresser', 'tv', 'sofa', 'nightstand',
  'kitchen', 'appliance', 'storage', 'wall',
]);

/** Categories that read fine in open floor and keep whatever rotation they are given. */
export const FREE_STANDING: ReadonlySet<Category> = new Set<Category>([
  'table', 'rug', 'chair', 'armchair', 'plant', 'lamp', 'decor', 'other',
]);

/** A dragged edge this close to a wall is treated as an attempt to put the item against it. */
const SNAP_CM = 15;
/** Spacing between wall-run candidates. */
const WALL_STEP_CM = 10;
/** Spacing of the open-floor candidate grid. */
const FREE_STEP_CM = 30;
/** How close a footprint must come to a window, door or corner to count as "near" it. */
const NEAR_CM = 100;
/** A window has no depth, so `near` measures against a thin strip standing in for its span. */
const WINDOW_SPAN_CM = 10;
/** Two suggestions closer than this read as the same idea, so only the better one is offered. */
const MIN_SEPARATION_CM = 60;
/** A footprint edge within this of a wall counts as touching it. */
const TOUCH_EPS = 0.5;

const BASE_SCORE = 1;
const WALL_CONTACT_BONUS = 0.6;
/** Mirror of `WALL_CONTACT_BONUS`: a rug or coffee table belongs in the room, not shoved against a wall. */
const OPEN_FLOOR_BONUS = 0.3;
const LIGHT_WEIGHT = 0.5;
const DOOR_DISTANCE_WEIGHT = 0.4;
const CORNER_BONUS = 0.5;
const NEAR_BONUS = 0.8;

const round2 = (v: number): number => Math.round(v * 100) / 100;
const round3 = (v: number): number => Math.round(v * 1000) / 1000;

/** Rotation whose back faces `wall`, so the item's front looks into the room. */
export function orientToWall(wall: Wall): Rotation {
  switch (wall) {
    case 'top': return 0;
    case 'right': return 90;
    case 'bottom': return 180;
    case 'left': return 270;
  }
}

/**
 * Signed distance from the footprint edge nearest `wall` to that wall.
 *
 * Positive means the item is inside the room with that much space left; negative means the
 * footprint already crosses the wall by that much.
 */
function wallGap(room: Room, wall: Wall, x: number, y: number, w: number, h: number): number {
  switch (wall) {
    case 'top': return y - h / 2;
    case 'right': return room.width - (x + w / 2);
    case 'bottom': return room.depth - (y + h / 2);
    case 'left': return x - w / 2;
  }
}

/** Center that puts a `w` by `h` footprint flush against `wall`, leaving the other axis alone. */
function flushOnWall(room: Room, wall: Wall, x: number, y: number, w: number, h: number): { x: number; y: number } {
  switch (wall) {
    case 'top': return { x, y: h / 2 };
    case 'right': return { x: room.width - w / 2, y };
    case 'bottom': return { x, y: room.depth - h / 2 };
    case 'left': return { x: w / 2, y };
  }
}

/**
 * Pull an item flush to the wall it was dropped nearest, when that wall is within `SNAP_CM`.
 *
 * A wall-backed item is measured against each wall in the rotation it would take there, because
 * that is the footprint it would actually end up with: a desk dropped sideways near the top wall
 * is judged by its 120 by 60 top-wall footprint, not by the 60 by 120 one it was carrying. Items
 * in `FREE_STANDING` keep the rotation they were given and are measured as-is. A footprint that
 * already crosses a wall by no more than `SNAP_CM` snaps back out to flush.
 */
export function snapToWall(
  room: Room,
  catalogId: string,
  x: number,
  y: number,
  rotation: Rotation,
): { x: number; y: number; rotation: Rotation; snapped: boolean; wall?: Wall } {
  const cat = findCatalogItem(room, catalogId);
  if (!cat) return { x, y, rotation, snapped: false };
  const backs = WALL_BACKED.has(cat.category);
  let best: { wall: Wall; rotation: Rotation; w: number; h: number; gap: number } | null = null;
  for (const wall of WALLS) {
    const rot = backs ? orientToWall(wall) : rotation;
    const { w, h } = rotatedDims(cat, rot);
    const gap = wallGap(room, wall, x, y, w, h);
    if (!best || Math.abs(gap) < Math.abs(best.gap)) best = { wall, rotation: rot, w, h, gap };
  }
  if (!best || Math.abs(best.gap) > SNAP_CM) return { x, y, rotation, snapped: false };
  const p = flushOnWall(room, best.wall, x, y, best.w, best.h);
  return { x: p.x, y: p.y, rotation: best.rotation, snapped: true, wall: best.wall };
}

type CandidateKind = 'wall' | 'corner' | 'free';

interface Candidate {
  x: number;
  y: number;
  rotation: Rotation;
  kind: CandidateKind;
  label: string;
}

const CORNERS: { label: string; horizontal: Wall; vertical: Wall }[] = [
  { label: 'top-left', horizontal: 'top', vertical: 'left' },
  { label: 'top-right', horizontal: 'top', vertical: 'right' },
  { label: 'bottom-left', horizontal: 'bottom', vertical: 'left' },
  { label: 'bottom-right', horizontal: 'bottom', vertical: 'right' },
];

function candidates(room: Room, cat: CatalogItem): Candidate[] {
  const backs = WALL_BACKED.has(cat.category);
  const out: Candidate[] = [];
  const seen = new Set<string>();
  const push = (c: Candidate): void => {
    const key = `${c.x}|${c.y}|${c.rotation}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(c);
  };

  // Corners first, so a position that is both a wall run position and a corner reads as a corner.
  for (const corner of CORNERS) {
    const back = room.depth > room.width ? corner.vertical : corner.horizontal;
    const rotation = backs ? orientToWall(back) : 0;
    const { w, h } = rotatedDims(cat, rotation);
    if (w > room.width || h > room.depth) continue;
    push({
      x: corner.vertical === 'left' ? w / 2 : room.width - w / 2,
      y: corner.horizontal === 'top' ? h / 2 : room.depth - h / 2,
      rotation,
      kind: 'corner',
      label: corner.label,
    });
  }

  for (const wall of WALLS) {
    const rotation = backs ? orientToWall(wall) : 0;
    const { w, h } = rotatedDims(cat, rotation);
    if (w > room.width || h > room.depth) continue;
    // Walk the wall from one end to the other; the other coordinate is fixed by being flush.
    const horizontal = wall === 'top' || wall === 'bottom';
    const start = horizontal ? w / 2 : h / 2;
    const end = horizontal ? room.width - w / 2 : room.depth - h / 2;
    const flush = flushOnWall(room, wall, w / 2, h / 2, w, h);
    const steps = Math.floor((end - start) / WALL_STEP_CM);
    for (let i = 0; i <= steps; i++) {
      const along = start + i * WALL_STEP_CM;
      push({
        x: horizontal ? along : flush.x,
        y: horizontal ? flush.y : along,
        rotation,
        kind: 'wall',
        label: wall,
      });
    }
  }

  if (FREE_STANDING.has(cat.category)) {
    const { w, h } = rotatedDims(cat, 0);
    for (let y = FREE_STEP_CM; y <= room.depth - FREE_STEP_CM; y += FREE_STEP_CM) {
      for (let x = FREE_STEP_CM; x <= room.width - FREE_STEP_CM; x += FREE_STEP_CM) {
        if (x - w / 2 < 0 || x + w / 2 > room.width || y - h / 2 < 0 || y + h / 2 > room.depth) continue;
        push({ x, y, rotation: 0, kind: 'free', label: 'free-standing' });
      }
    }
  }

  return out;
}

function wallsTouched(room: Room, fp: Rect): number {
  let n = 0;
  if (fp.y <= TOUCH_EPS) n++;
  if (fp.x <= TOUCH_EPS) n++;
  if (fp.x + fp.w >= room.width - TOUCH_EPS) n++;
  if (fp.y + fp.h >= room.depth - TOUCH_EPS) n++;
  return n;
}

function rectToRect(a: Rect, b: Rect): number {
  const dx = Math.max(0, a.x - (b.x + b.w), b.x - (a.x + a.w));
  const dy = Math.max(0, a.y - (b.y + b.h), b.y - (a.y + a.h));
  return Math.hypot(dx, dy);
}

function rectToPoint(r: Rect, px: number, py: number): number {
  const dx = Math.max(0, r.x - px, px - (r.x + r.w));
  const dy = Math.max(0, r.y - py, py - (r.y + r.h));
  return Math.hypot(dx, dy);
}

function nearBonus(room: Room, fp: Rect, near: Near): number {
  if (near === 'window') {
    const windows = room.openings.filter((o) => o.kind === 'window');
    return windows.some((o) => rectToRect(fp, openingSpan(room, o, WINDOW_SPAN_CM)) <= NEAR_CM) ? NEAR_BONUS : 0;
  }
  if (near === 'door') {
    const doors = room.openings.filter((o) => o.kind === 'door');
    return doors.some((o) => {
      const p = doorInsidePoint(room, o);
      return rectToPoint(fp, p.x, p.y) <= NEAR_CM;
    }) ? NEAR_BONUS : 0;
  }
  if (near === 'corner') {
    const points = [[0, 0], [room.width, 0], [0, room.depth], [room.width, room.depth]] as const;
    return points.some(([px, py]) => rectToPoint(fp, px, py) <= NEAR_CM) ? NEAR_BONUS : 0;
  }
  return 0;
}

function nearSuffix(near: Near): string {
  switch (near) {
    case 'window': return ', near the window';
    case 'door': return ', near the door';
    case 'corner': return ', near a corner';
    default: return '';
  }
}

function baseReason(c: Candidate): string {
  switch (c.kind) {
    case 'wall': return `against the ${c.label} wall, facing the room`;
    case 'corner': return `in the ${c.label} corner`;
    case 'free': return 'free-standing';
  }
}

/**
 * Valid, well-scored places to put `catalogId`, best first.
 *
 * Candidates are the wall runs (every 10 cm, back flush to the wall), the four corners, and — for
 * free-standing categories only — a 30 cm open-floor grid. Anything with a blocking violation is
 * dropped, and the survivors are scored for wall contact, daylight (desks), distance from the door
 * (beds), corners (wardrobes and shelves) and the requested `near` preference. The returned set is
 * spread out: two spots less than `MIN_SEPARATION_CM` apart are the same idea, so only the better
 * one is offered unless there is nothing else left to fill `count`.
 *
 * Pure and deterministic: the room is never mutated and equal rooms give equal answers.
 */
export function suggestPositions(
  room: Room,
  catalogId: string,
  opts: { near?: Near; count?: number; hour?: number } = {},
): Suggestion[] {
  const cat = findCatalogItem(room, catalogId);
  if (!cat) return [];
  const near: Near = opts.near ?? 'any';
  const count = opts.count ?? 5;
  if (count <= 0) return [];

  const day = computeDaylight(room, opts.hour ?? 9);
  const others = room.items.filter((i) => i.id !== '__probe');
  const door = room.openings.find((o) => o.kind === 'door');
  const doorPoint = door ? doorInsidePoint(room, door) : null;
  const diagonal = Math.hypot(room.width, room.depth);
  const backs = WALL_BACKED.has(cat.category);
  const free = FREE_STANDING.has(cat.category);

  const scored: Suggestion[] = [];
  for (const c of candidates(room, cat)) {
    const probe: PlacedItem = { id: '__probe', catalogId, x: c.x, y: c.y, rotation: c.rotation, locked: false };
    if (itemViolations(room, probe, others).some((v) => BLOCKING_KINDS.has(v.kind))) continue;

    const fp = footprint(probe, cat);
    const cells = rectCells(fp, day.cols, day.rows);
    const light = round2(cells.length ? cells.reduce((s, i) => s + (day.grid[i] ?? 0), 0) / cells.length : 0);
    const touching = wallsTouched(room, fp);

    let score = BASE_SCORE;
    if (backs && touching > 0) score += WALL_CONTACT_BONUS;
    if (free && touching === 0) score += OPEN_FLOOR_BONUS;
    if (cat.category === 'desk') score += LIGHT_WEIGHT * light;
    if (cat.category === 'bed' && doorPoint) {
      score += DOOR_DISTANCE_WEIGHT * Math.min(1, Math.hypot(c.x - doorPoint.x, c.y - doorPoint.y) / diagonal);
    }
    if ((cat.category === 'wardrobe' || cat.category === 'shelf') && touching >= 2) score += CORNER_BONUS;
    score += nearBonus(room, fp, near);

    scored.push({
      x: c.x,
      y: c.y,
      rotation: c.rotation,
      reason: `${baseReason(c)}, light ${light.toFixed(2)}${nearSuffix(near)}`,
      light,
      score: round3(score),
    });
  }

  const byRank = (a: Suggestion, b: Suggestion): number => b.score - a.score || a.y - b.y || a.x - b.x;
  scored.sort(byRank);

  const picked: Suggestion[] = [];
  for (const s of scored) {
    if (picked.length >= count) break;
    if (picked.every((p) => Math.hypot(p.x - s.x, p.y - s.y) >= MIN_SEPARATION_CM)) picked.push(s);
  }
  if (picked.length < count) {
    const taken = new Set(picked);
    for (const s of scored) {
      if (picked.length >= count) break;
      if (!taken.has(s)) picked.push(s);
    }
    picked.sort(byRank);
  }
  return picked;
}
