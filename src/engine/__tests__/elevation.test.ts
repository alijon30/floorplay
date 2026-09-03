import { describe, it, expect } from 'vitest';
import { makeDemoRoom } from '../rooms';
import { findCatalogItem } from '../catalog';
import { placeTest } from '../validate';
import { elevationItems, elevationView, offsetOnWall, projectOnWall, wallPlacement, mountHeightOf, FLOOR_NEAR_CM, MOUNT_NEAR_CM } from '../elevation';
import { wallColor, withAllWallsColor, withWallColor } from '../wallColor';
import type { Room, Wall } from '../types';
import { WALLS } from '../types';

/** The demo studio is 360 wide by 520 deep, 260 high, with a door on `bottom` and a window on `right`. */
function room(): Room {
  return makeDemoRoom();
}

/** Hang `catalogId` on `wall` at `offset` the way the elevation and `place_on_wall` both do. */
function hang(r: Room, catalogId: string, wall: Wall, offset: number, id: string): Room {
  const cat = findCatalogItem(r, catalogId)!;
  const p = wallPlacement(r, cat, wall, offset);
  return { ...r, items: [...r.items, { id, catalogId, x: p.x, y: p.y, rotation: p.rotation, locked: false }] };
}

describe('wallPlacement', () => {
  it('puts an item flush on each wall, facing the room, at the offset asked for', () => {
    const r = room();
    const cat = findCatalogItem(r, 'picture-60')!; // 60 wide, 4 deep
    expect(wallPlacement(r, cat, 'top', 120)).toEqual({ x: 150, y: 2, rotation: 0 });
    expect(wallPlacement(r, cat, 'bottom', 120)).toEqual({ x: 150, y: 518, rotation: 180 });
    expect(wallPlacement(r, cat, 'left', 120)).toEqual({ x: 2, y: 150, rotation: 270 });
    expect(wallPlacement(r, cat, 'right', 120)).toEqual({ x: 358, y: 150, rotation: 90 });
  });

  it('round-trips through offsetOnWall on every wall', () => {
    const r = room();
    const cat = findCatalogItem(r, 'mirror-rect-80')!;
    for (const wall of WALLS) {
      const p = wallPlacement(r, cat, wall, 90);
      expect(offsetOnWall(cat, wall, p.x, p.y), wall).toBe(90);
    }
  });
});

describe('projectOnWall', () => {
  it('measures along the same axis openings use, and out from the wall', () => {
    const r = room();
    const rect = { x: 100, y: 40, w: 60, h: 20 };
    expect(projectOnWall(r, rect, 'top')).toEqual({ offset: 100, span: 60, distance: 40 });
    expect(projectOnWall(r, rect, 'bottom')).toEqual({ offset: 100, span: 60, distance: 460 });
    expect(projectOnWall(r, rect, 'left')).toEqual({ offset: 40, span: 20, distance: 100 });
    expect(projectOnWall(r, rect, 'right')).toEqual({ offset: 40, span: 20, distance: 200 });
  });
});

describe('elevationItems', () => {
  it('reports a hung picture on its own wall at its offset and mount height', () => {
    const r = hang(room(), 'picture-60', 'top', 120, 'p1');
    const { mounted } = elevationItems(r, 'top');
    expect(mounted).toHaveLength(1);
    expect(mounted[0]).toMatchObject({ id: 'p1', catalogId: 'picture-60', offset: 120, width: 60, bottom: 110, top: 190, distance: 0 });
  });

  it('does not put a picture on the other three walls', () => {
    const r = hang(room(), 'picture-60', 'top', 120, 'p1');
    for (const wall of ['bottom', 'left', 'right'] as Wall[]) {
      expect(elevationItems(r, wall).mounted, wall).toHaveLength(0);
    }
  });

  it('honours a per-placement mount height over the catalog default', () => {
    const r = hang(room(), 'picture-60', 'left', 200, 'p1');
    const raised: Room = { ...r, items: r.items.map((i) => ({ ...i, mountHeight: 150 })) };
    expect(elevationItems(raised, 'left').mounted[0]).toMatchObject({ bottom: 150, top: 230 });
    expect(mountHeightOf({ mountHeight: 150 }, findCatalogItem(r, 'picture-60')!)).toBe(150);
    expect(mountHeightOf({}, findCatalogItem(r, 'picture-60')!)).toBe(110);
  });

  it('takes a picture nudged off the wall, but not one across the room', () => {
    const r = room();
    const cat = findCatalogItem(r, 'picture-40')!;
    const near = { ...r, items: [{ id: 'near', catalogId: 'picture-40', x: 100, y: cat.depth / 2 + MOUNT_NEAR_CM - 1, rotation: 0 as const, locked: false }] };
    expect(elevationItems(near, 'top').mounted.map((m) => m.id)).toEqual(['near']);
    const far = { ...r, items: [{ id: 'far', catalogId: 'picture-40', x: 100, y: 200, rotation: 0 as const, locked: false }] };
    expect(elevationItems(far, 'top').mounted).toHaveLength(0);
  });

  it('draws floor furniture within a metre of the wall as a silhouette, furthest first', () => {
    const r = room();
    // Sofa 160x85 against the top wall; wardrobe 100x60 sitting 90 cm off it.
    const staged: Room = {
      ...r,
      items: [
        placeTest(r, 'sofa-2', 100, 42.5, 0, 'sofa'),
        placeTest(r, 'wardrobe-100', 280, 120, 0, 'wardrobe'),
        placeTest(r, 'table-coffee-90', 180, 400, 0, 'far-table'),
      ],
    };
    const { floor } = elevationItems(staged, 'top');
    expect(floor.map((f) => f.id)).toEqual(['wardrobe', 'sofa']);
    expect(floor[1]).toMatchObject({ id: 'sofa', offset: 20, width: 160, bottom: 0, height: 80, distance: 0 });
    expect(floor[0]!.distance).toBe(90);
    expect(floor[0]!.distance).toBeLessThanOrEqual(FLOOR_NEAR_CM);
  });

  it('keeps a mounted item out of the floor silhouettes and vice versa', () => {
    const r = hang(room(), 'wall-shelf-60', 'left', 100, 'shelf');
    const staged: Room = { ...r, items: [...r.items, placeTest(r, 'desk-120', 60, 300, 90, 'desk')] };
    const { mounted, floor } = elevationItems(staged, 'left');
    expect(mounted.map((m) => m.id)).toEqual(['shelf']);
    expect(floor.map((f) => f.id)).toEqual(['desk']);
  });

  it('is deterministic: the same room always projects the same way', () => {
    const r = hang(hang(room(), 'picture-60', 'top', 200, 'b'), 'picture-40', 'top', 40, 'a');
    expect(elevationItems(r, 'top').mounted.map((m) => m.id)).toEqual(['a', 'b']);
    expect(elevationItems(r, 'top')).toEqual(elevationItems(r, 'top'));
  });
});

describe('elevationView', () => {
  it('carries the wall size and only that wall openings, sill honoured', () => {
    const r = room();
    const right = elevationView(r, 'right');
    expect(right).toMatchObject({ wall: 'right', length: 520, height: 260 });
    expect(right.openings).toEqual([{ id: 'window-east', kind: 'window', offset: 190, width: 140, height: 120, sill: 90, top: 210 }]);
    const bottom = elevationView(r, 'bottom');
    expect(bottom.length).toBe(360);
    expect(bottom.openings[0]).toMatchObject({ kind: 'door', sill: 0, top: 200 });
    expect(elevationView(r, 'top').openings).toEqual([]);
  });
});

describe('wallColor', () => {
  it('falls back to the room default, and to the app default for a room with no finish', () => {
    const r = room();
    expect(wallColor(r, 'top')).toBe(r.finish.wall);
    expect(wallColor({ finish: undefined }, 'left')).toBe('#efe9df');
  });

  it('paints one wall without touching the others, and clears back to a single colour', () => {
    const r = room();
    const one = withWallColor(r.finish, 'right', '#3b4f6b');
    expect(wallColor({ finish: one }, 'right')).toBe('#3b4f6b');
    expect(wallColor({ finish: one }, 'top')).toBe(r.finish.wall);
    const all = withAllWallsColor(one, '#a8b48a');
    expect(all.walls).toBeUndefined();
    for (const wall of WALLS) expect(wallColor({ finish: all }, wall), wall).toBe('#a8b48a');
  });
});
