import { describe, it, expect } from 'vitest';
import { makeDemoRoom } from '../../engine/rooms';
import { placeTest } from '../../engine/validate';
import { analyze } from '../../engine/analyze';
import { ghostsFor } from '../ghosts';
import type { Proposal } from '../../engine/types';

function proposal(id: string, ops: Proposal['ops']): Proposal {
  const m = analyze(makeDemoRoom()).metrics;
  return { id, label: id, ops, metricsBefore: m, metricsAfter: m, violationsAfter: [], createdAt: 0 };
}

describe('ghostsFor', () => {
  it('resolves place, move, swap and remove into rects', () => {
    const room = makeDemoRoom();
    room.items = [placeTest(room, 'desk-120', 60, 30, 0, 'd')];
    const p = proposal('p1', [
      { type: 'place', item: placeTest(room, 'bed-queen-160', 260, 300, 0, 'b') },
      { type: 'move', id: 'b', x: 200, y: 300, rotation: 90 },
      { type: 'swap', id: 'd', catalogId: 'desk-100' },
      { type: 'remove', id: 'd' },
    ]);
    const g = ghostsFor(room, [p], null);
    expect(g.map((x) => x.kind)).toEqual(['place', 'move', 'swap', 'remove']);
    expect(g[1]!.rect).toEqual({ x: 100, y: 220, w: 200, h: 160 });
    expect(g[2]!.rect).toEqual({ x: 10, y: 5, w: 100, h: 50 });
    expect(g[3]!.itemId).toBe('d');
  });

  it('filters to the hovered proposal', () => {
    const room = makeDemoRoom();
    const a = proposal('a', [{ type: 'place', item: placeTest(room, 'desk-120', 60, 30, 0, 'x') }]);
    const b = proposal('b', [{ type: 'place', item: placeTest(room, 'sofa-2', 180, 300, 0, 'y') }]);
    expect(ghostsFor(room, [a, b], null)).toHaveLength(2);
    expect(ghostsFor(room, [a, b], 'b').map((g) => g.proposalId)).toEqual(['b']);
  });
});
