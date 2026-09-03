// src/engine/elevation.ts
import type { CatalogItem, Opening, PlacedItem, Room, Rotation, Shape, Wall } from './types';
import { findCatalogItem, isMounted } from './catalog';
import { footprint } from './geometry';
import { orientToWall } from './anchors';

/**
 * How close a footprint has to come to a wall before the item counts as hanging on it.
 *
 * Mounted pieces are placed flush, so in practice the gap is zero; the tolerance is there for
 * a picture nudged off the wall by a few centimetres, which is still a picture on that wall.
 */
export const MOUNT_NEAR_CM = 20;

/** How far into the room the elevation looks for furniture to draw behind the wall. */
export const FLOOR_NEAR_CM = 100;

/**
 * One item projected onto a wall.
 *
 * `offset` is measured exactly the way an opening's offset is: from the left end of the top and
 * bottom walls, and from the top end of the left and right walls. It names the item's near edge,
 * so `offset` and `offset + width` bracket the span it takes up along the wall.
 *
 * `bottom` is the height of the item's underside above the floor — `mountHeight` for something
 * that hangs, zero for something standing on the floor — and `top` is `bottom + height`.
 * `distance` is the gap from the wall to the nearest face of the item, so a picture reads 0 and
 * a sofa a wall's width away reads 90.
 */
export interface ElevationItem {
  id: string;
  catalogId: string;
  name: string;
  shape: Shape;
  color: string;
  offset: number;
  width: number;
  height: number;
  bottom: number;
  top: number;
  distance: number;
  locked: boolean;
}

/** An opening seen straight on: its span along the wall and its span up it. */
export interface ElevationOpening {
  id: string;
  kind: 'door' | 'window';
  offset: number;
  width: number;
  height: number;
  /** Height of the sill above the floor. Doors report 0. */
  sill: number;
  top: number;
}

export interface ElevationView {
  wall: Wall;
  /** How long the wall is: the room's width for top and bottom, its depth for left and right. */
  length: number;
  height: number;
  openings: ElevationOpening[];
  /** Items hanging on this wall, near edge first. */
  mounted: ElevationItem[];
  /** Floor-standing items within `FLOOR_NEAR_CM`, furthest first so nearer ones draw over them. */
  floor: ElevationItem[];
}

/** How long a wall is, in cm. */
export function wallLength(room: { width: number; depth: number }, wall: Wall): number {
  return wall === 'top' || wall === 'bottom' ? room.width : room.depth;
}

/**
 * Where a footprint sits relative to one wall: its span along the wall, and its distance from it.
 *
 * The along-axis is x for the top and bottom walls and y for the left and right ones, which is
 * the same convention openings use, so an item and a door on the same wall are measured against
 * the same ruler. `distance` is signed only in that an item poking through the wall reads
 * negative; callers compare its absolute value.
 */
export function projectOnWall(
  room: { width: number; depth: number },
  rect: { x: number; y: number; w: number; h: number },
  wall: Wall,
): { offset: number; span: number; distance: number } {
  switch (wall) {
    case 'top': return { offset: rect.x, span: rect.w, distance: rect.y };
    case 'bottom': return { offset: rect.x, span: rect.w, distance: room.depth - (rect.y + rect.h) };
    case 'left': return { offset: rect.y, span: rect.h, distance: rect.x };
    case 'right': return { offset: rect.y, span: rect.h, distance: room.width - (rect.x + rect.w) };
  }
}

/** Where a mounted item's underside sits: its own override, then the catalog's, then the floor. */
export function mountHeightOf(item: { mountHeight?: number }, cat: CatalogItem): number {
  return item.mountHeight ?? cat.mountHeight ?? 0;
}

/**
 * The placement that hangs `cat` flush on `wall` with its near edge at `offset`.
 *
 * A wall item is turned to face the room, so the span it takes along the wall is always its
 * catalog `width` and the depth it stands proud of the wall is always its `depth`, whichever
 * wall it is on. That is what lets one offset mean the same thing on all four.
 */
export function wallPlacement(
  room: { width: number; depth: number },
  cat: CatalogItem,
  wall: Wall,
  offset: number,
): { x: number; y: number; rotation: Rotation } {
  const along = offset + cat.width / 2;
  const out = cat.depth / 2;
  const rotation = orientToWall(wall);
  switch (wall) {
    case 'top': return { x: along, y: out, rotation };
    case 'bottom': return { x: along, y: room.depth - out, rotation };
    case 'left': return { x: out, y: along, rotation };
    case 'right': return { x: room.width - out, y: along, rotation };
  }
}

/** The offset an item already on `wall` would be quoted at, given its center. */
export function offsetOnWall(cat: CatalogItem, wall: Wall, x: number, y: number): number {
  const along = wall === 'top' || wall === 'bottom' ? x : y;
  return along - cat.width / 2;
}

function openingView(o: Opening): ElevationOpening {
  const sill = o.kind === 'door' ? 0 : o.sill ?? 90;
  return { id: o.id, kind: o.kind, offset: o.offset, width: o.width, height: o.height, sill, top: sill + o.height };
}

function itemView(room: Room, item: PlacedItem, cat: CatalogItem, wall: Wall): ElevationItem {
  const p = projectOnWall(room, footprint(item, cat), wall);
  const bottom = isMounted(cat) ? mountHeightOf(item, cat) : 0;
  return {
    id: item.id,
    catalogId: item.catalogId,
    name: cat.name,
    shape: cat.shape,
    color: item.color ?? cat.color,
    offset: Math.round(p.offset),
    width: Math.round(p.span),
    height: cat.height,
    bottom,
    top: bottom + cat.height,
    distance: Math.round(p.distance),
    locked: item.locked,
  };
}

/**
 * Everything the elevation of one wall has to draw, in plain numbers.
 *
 * Split from the view on purpose: which picture hangs on which wall and where along it is a
 * fact about the room, so the SVG and the `get_elevation` tool answer from the same function
 * and can never disagree about what is on a wall.
 *
 * Mounted items are those whose footprint lies within `MOUNT_NEAR_CM` of the wall and that hang
 * rather than stand. Floor items are everything standing within `FLOOR_NEAR_CM`, drawn as
 * silhouettes so a picture can be hung relative to the sofa it is going above.
 */
export function elevationItems(room: Room, wall: Wall): { mounted: ElevationItem[]; floor: ElevationItem[] } {
  const mounted: ElevationItem[] = [];
  const floor: ElevationItem[] = [];
  for (const item of room.items) {
    const cat = findCatalogItem(room, item.catalogId);
    if (!cat) continue;
    const view = itemView(room, item, cat, wall);
    if (isMounted(cat)) {
      if (Math.abs(view.distance) <= MOUNT_NEAR_CM) mounted.push(view);
    } else if (view.distance <= FLOOR_NEAR_CM && view.distance > -cat.depth) {
      floor.push(view);
    }
  }
  mounted.sort((a, b) => a.offset - b.offset || a.id.localeCompare(b.id));
  // Furthest first, so the near sofa draws over the wardrobe behind it rather than under it.
  floor.sort((a, b) => b.distance - a.distance || a.offset - b.offset || a.id.localeCompare(b.id));
  return { mounted, floor };
}

/** The whole elevation of one wall: its size, its openings and everything on or in front of it. */
export function elevationView(room: Room, wall: Wall): ElevationView {
  const { mounted, floor } = elevationItems(room, wall);
  return {
    wall,
    length: wallLength(room, wall),
    height: room.height,
    openings: room.openings.filter((o) => o.wall === wall).sort((a, b) => a.offset - b.offset).map(openingView),
    mounted,
    floor,
  };
}
