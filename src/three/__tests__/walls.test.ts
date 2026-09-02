import { describe, it, expect } from 'vitest';
import { makeDemoRoom } from '../../engine/rooms';
import { wallSegments } from '../Walls';

describe('wallSegments', () => {
  it('splits the bottom wall around the door and adds a lintel', () => {
    const room = makeDemoRoom();
    const segs = wallSegments(room, 'bottom');
    const walls = segs.filter((s) => s.kind === 'wall');
    expect(walls).toHaveLength(3);
    const lintel = walls.find((s) => s.y > 2)!;
    expect(lintel.h).toBeCloseTo(0.6, 5);
    expect(lintel.w).toBeCloseTo(0.8, 5);
    expect(walls.every((s) => Math.abs(s.z - (5.2 + 0.05)) < 1e-6)).toBe(true);
  });

  it('adds sill, lintel and glass for a window on the right wall', () => {
    const room = makeDemoRoom();
    const segs = wallSegments(room, 'right');
    expect(segs.filter((s) => s.kind === 'glass')).toHaveLength(1);
    const sill = segs.find((s) => s.kind === 'wall' && s.h < 1 && s.y < 0.5)!;
    expect(sill.h).toBeCloseTo(0.9, 5);
    expect(segs.every((s) => Math.abs(s.x - (3.6 + 0.05)) < 1e-6)).toBe(true);
  });

  it('returns one full box for a wall without openings', () => {
    const segs = wallSegments(makeDemoRoom(), 'top');
    expect(segs).toHaveLength(1);
    expect(segs[0]).toMatchObject({ w: 3.6, h: 2.6, d: 0.1 });
  });
});
