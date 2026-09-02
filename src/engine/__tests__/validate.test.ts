import { describe, it, expect } from 'vitest';
import { makeDemoRoom } from '../rooms';
import { itemViolations, validateRoom, budgetUsed, placeTest } from '../validate';
import type { Room, Rotation } from '../types';

function withItems(room: Room, specs: [string, number, number, Rotation?][]): Room {
  return { ...room, items: specs.map(([cat, x, y, rot], i) => placeTest(room, cat, x, y, rot ?? 0, `i${i}`)) };
}

describe('itemViolations', () => {
  it('accepts a desk along the top wall facing into the room', () => {
    const room = withItems(makeDemoRoom(), [['desk-120', 60, 30]]);
    expect(itemViolations(room, room.items[0]!)).toEqual([]);
  });

  it('flags out of bounds', () => {
    const room = withItems(makeDemoRoom(), [['desk-120', 30, 100]]);
    expect(itemViolations(room, room.items[0]!).map((v) => v.kind)).toContain('out_of_bounds');
  });

  it('flags overlap with the intersection as zone', () => {
    const room = withItems(makeDemoRoom(), [['desk-120', 100, 100], ['desk-120', 160, 100]]);
    const v = itemViolations(room, room.items[0]!).find((x) => x.kind === 'overlap')!;
    expect(v.itemIds).toEqual(['i0', 'i1']);
    expect(v.zone).toEqual({ x: 100, y: 70, w: 60, h: 60 });
  });

  it('flags a wardrobe in the door swing', () => {
    const room = withItems(makeDemoRoom(), [['wardrobe-100', 60, 470, 180]]);
    expect(itemViolations(room, room.items[0]!).map((v) => v.kind)).toContain('blocks_door');
  });

  it('flags a tall item touching the window but not a low one', () => {
    const tall = withItems(makeDemoRoom(), [['wardrobe-100', 330, 260, 90]]);
    expect(itemViolations(tall, tall.items[0]!).map((v) => v.kind)).toContain('blocks_window');
    const low = withItems(makeDemoRoom(), [['dresser-100', 337, 260, 90]]);
    expect(itemViolations(low, low.items[0]!).map((v) => v.kind)).not.toContain('blocks_window');
  });

  it('flags clearance against a wall and against another item', () => {
    const facingWall = withItems(makeDemoRoom(), [['wardrobe-100', 330, 100, 270]]);
    expect(itemViolations(facingWall, facingWall.items[0]!).map((v) => v.kind)).toContain('clearance');
    const bedFree = withItems(makeDemoRoom(), [['bed-queen-160', 80, 300]]);
    expect(itemViolations(bedFree, bedFree.items[0]!)).toEqual([]);
    const bedBlocked = withItems(makeDemoRoom(), [['bed-queen-160', 80, 300], ['wardrobe-100', 190, 300, 90]]);
    expect(itemViolations(bedBlocked, bedBlocked.items[0]!).map((v) => v.kind)).toContain('clearance');
  });

  it('lets a chair sit inside the clearance of the desk it belongs to', () => {
    // Desk against the top wall needs 90 cm in front; its own chair is tucked into that zone.
    const room = withItems(makeDemoRoom(), [['desk-120', 60, 30], ['chair-office', 60, 105, 180]]);
    expect(itemViolations(room, room.items[0]!).map((v) => v.kind)).not.toContain('clearance');
    // The chair still occupies the floor: something on top of it is an overlap.
    const shared = withItems(makeDemoRoom(), [['chair-office', 60, 105, 180], ['nightstand-45', 60, 105]]);
    expect(itemViolations(shared, shared.items[1]!).map((v) => v.kind)).toContain('overlap');
  });

  it('ignores rugs for overlap', () => {
    const room = withItems(makeDemoRoom(), [['rug-160x230', 180, 260], ['sofa-2', 180, 260]]);
    expect(itemViolations(room, room.items[1]!).map((v) => v.kind)).not.toContain('overlap');
  });

  it('hangs a picture over a sofa without an overlap either way', () => {
    // Sofa flush to the top wall, picture on that wall right above it.
    const room = withItems(makeDemoRoom(), [['sofa-2', 180, 42.5], ['picture-60', 180, 2]]);
    expect(itemViolations(room, room.items[1]!)).toEqual([]);
    expect(itemViolations(room, room.items[0]!)).toEqual([]);
  });

  it('flags a picture that hangs past the end of the wall', () => {
    const room = withItems(makeDemoRoom(), [['picture-60', 10, 2]]);
    expect(itemViolations(room, room.items[0]!).map((v) => v.kind)).toEqual(['out_of_bounds']);
  });

  it('lets wall-mounted items hang over the door and the window', () => {
    // The door is on the bottom wall at offset 20, so this picture is inside its approach zone.
    const overDoor = withItems(makeDemoRoom(), [['picture-40', 60, 518]]);
    expect(itemViolations(overDoor, overDoor.items[0]!)).toEqual([]);
    // Curtains stand in the window strip on the right wall, where a wardrobe would be flagged.
    const atWindow = withItems(makeDemoRoom(), [['curtain-200', 355, 260, 90]]);
    expect(itemViolations(atWindow, atWindow.items[0]!)).toEqual([]);
  });
});

describe('validateRoom', () => {
  it('reports each overlap once and adds over_budget', () => {
    const base = makeDemoRoom();
    base.brief.budget = 200;
    const room = withItems(base, [['desk-120', 100, 100], ['desk-120', 160, 100]]);
    const v = validateRoom(room);
    expect(v.filter((x) => x.kind === 'overlap')).toHaveLength(1);
    expect(v.some((x) => x.kind === 'over_budget')).toBe(true);
    expect(budgetUsed(room)).toBe(258);
  });
});
