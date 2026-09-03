import { describe, it, expect } from 'vitest';
import { makeDemoRoom } from '../rooms';
import { placeTest } from '../validate';
import { cameraPreset, itemsInView, toHomePose, yawOf, dirOf } from '../camera';

describe('camera', () => {
  it('converts between yaw and direction', () => {
    expect(yawOf(0, -1)).toBe(0);
    expect(yawOf(1, 0)).toBe(90);
    expect(yawOf(0, 1)).toBe(180);
    expect(yawOf(-1, 0)).toBe(270);
    expect(dirOf(90)).toEqual({ dx: 1, dy: 0 });
  });

  it('builds presets from the room', () => {
    const room = makeDemoRoom();
    room.items = [placeTest(room, 'desk-120', 60, 30, 0, 'desk'), placeTest(room, 'bed-queen-160', 260, 300, 0, 'bed')];
    expect(cameraPreset(room, 'overview')).toMatchObject({ mode: 'orbit' });
    expect(cameraPreset(room, 'from_door')).toEqual({ mode: 'walk', x: 60, y: 465, z: 160, yaw: 0, pitch: 0 });
    expect(cameraPreset(room, 'at_desk')).toEqual({ mode: 'walk', x: 60, y: 140, z: 160, yaw: 0, pitch: -10 });
    expect(cameraPreset(room, 'on_bed')).toEqual({ mode: 'walk', x: 260, y: 300, z: 60, yaw: 180, pitch: 0 });
    expect(cameraPreset(room, 'at_window')).toEqual({ mode: 'walk', x: 300, y: 260, z: 160, yaw: 270, pitch: 0 });
    room.items = [];
    expect(cameraPreset(room, 'at_desk')).toBeNull();
  });

  it('carries a pose onto the home plan without turning it', () => {
    const pose = { mode: 'walk' as const, x: 60, y: 465, z: 160, yaw: 90, pitch: -10 };
    expect(toHomePose(pose, { x: 200, y: 550 })).toEqual({ mode: 'walk', x: 260, y: 1015, z: 160, yaw: 90, pitch: -10 });
    // A standalone room stands on no plan, so its own coordinates are already the world's.
    expect(toHomePose(pose, null)).toBe(pose);
  });

  it('lists items inside a 90 degree view cone', () => {
    const room = makeDemoRoom();
    room.items = [placeTest(room, 'desk-120', 60, 30, 0, 'desk'), placeTest(room, 'sofa-2', 300, 480, 0, 'sofa')];
    const seen = itemsInView(room, { mode: 'walk', x: 60, y: 465, z: 160, yaw: 0, pitch: 0 });
    expect(seen.map((s) => s.id)).toEqual(['desk']);
    expect(seen[0]).toMatchObject({ name: 'Desk 120', distanceCm: 435, side: 'center' });
    expect(itemsInView(room, { mode: 'orbit', x: 0, y: 0, z: 0, yaw: 0, pitch: 0 })).toHaveLength(2);
  });
});
