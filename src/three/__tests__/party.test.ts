import { describe, it, expect } from 'vitest';
import type { Room } from '../../engine/types';
import { buildHomeFromTemplate } from '../../engine/homeTemplates';
import { cornerShared, onParty, partyIntervals, splitByParty, TRIM_INSET, WALL_INSET } from '../party';
import type { Box } from '../Walls';
import { M, WALL_T } from '../units';

const byId = (rooms: Room[]): Record<string, Room> => Object.fromEntries(rooms.map((r) => [r.id, r]));
const find = (rooms: Room[], re: RegExp): Room => rooms.find((r) => re.test(r.name))!;

describe('party walls', () => {
  const { home, rooms } = buildHomeFromTemplate('one-bedroom');
  const map = byId(rooms);
  const living = find(rooms, /living/i);
  const bedroom = find(rooms, /bedroom/i);

  it('reads which stretches of each wall another room stands against', () => {
    const p = partyIntervals(home, map, living.id);
    expect(p.left).toEqual([[0, 420]]);
    expect(p.bottom).toEqual([[0, 340]]);
    expect(p.right).toEqual([[0, 420]]);
    expect(p.top).toBeUndefined();
    expect(partyIntervals(home, map, bedroom.id).top).toEqual([[0, 340]]);
  });

  it('steps the party run of a wall inside to half a wall and leaves the outer run where it was', () => {
    const D = living.depth * M;
    const full: Box = { x: (living.width * M) / 2, y: 1.3, z: D + WALL_T / 2, w: living.width * M, h: 2.6, d: WALL_T, kind: 'wall' };
    const pieces = splitByParty([full], 'bottom', [[0, 340]], WALL_INSET);
    expect(pieces).toHaveLength(2);
    const [party, outer] = pieces as [Box, Box];
    expect(party.x).toBeCloseTo(1.7, 6);
    expect(party.w).toBeCloseTo(3.4, 6);
    expect(party.d).toBeCloseTo(WALL_T / 2, 6);
    expect(party.z + party.d / 2).toBeCloseTo(D, 6); // its outer face is on the line
    expect(outer.x).toBeCloseTo((3.4 + 4.5) / 2, 6);
    expect(outer.w).toBeCloseTo(1.1, 6);
    expect(outer.z).toBeCloseTo(D + WALL_T / 2, 6);
    expect(outer.d).toBeCloseTo(WALL_T, 6);
  });

  it('moves trim in by half a wall without changing its thickness', () => {
    const board: Box = { x: 1, y: 0.04, z: 0.01, w: 2, h: 0.08, d: 0.02, kind: 'wall' };
    const [piece] = splitByParty([board], 'top', [[0, 200]], TRIM_INSET) as [Box];
    expect(piece.z).toBeCloseTo(0.01 + WALL_T / 2, 6);
    expect(piece.d).toBeCloseTo(0.02, 6);
  });

  it('leaves boxes alone when the wall is nobody\'s party wall', () => {
    const b: Box = { x: 1, y: 1, z: -WALL_T / 2, w: 2, h: 2, d: WALL_T, kind: 'wall' };
    expect(splitByParty([b], 'top', undefined, WALL_INSET)).toEqual([b]);
    expect(splitByParty([b], 'top', [], WALL_INSET)).toEqual([b]);
    expect(onParty(b, 'top', [[250, 300]])).toBe(false);
    expect(onParty(b, 'top', [[150, 300]])).toBe(true);
  });

  it('drops the corner post wherever a party wall runs right up to the corner', () => {
    const p = partyIntervals(home, map, living.id);
    expect(cornerShared(p, 'top', 'left', living.width, living.depth)).toBe(true); // hall reaches the top-left corner
    expect(cornerShared(p, 'bottom', 'left', living.width, living.depth)).toBe(true); // bedroom starts at the left edge
    expect(cornerShared(p, 'bottom', 'right', living.width, living.depth)).toBe(false); // bedroom is narrower than the living room
    const q = partyIntervals(home, map, bedroom.id);
    expect(cornerShared(q, 'top', 'right', bedroom.width, bedroom.depth)).toBe(true);
    expect(cornerShared(q, 'bottom', 'right', bedroom.width, bedroom.depth)).toBe(false);
  });
});
