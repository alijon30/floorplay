// src/three/Walls.tsx
import type { Opening, RoomShell, Wall } from '../engine/types';
import { M, WALL_T } from './units';

export interface Box { x: number; y: number; z: number; w: number; h: number; d: number; kind: 'wall' | 'glass' }

/** Boxes (meters, centered) for one wall, split around its openings. */
export function wallSegments(room: RoomShell & { openings: Opening[] }, wall: Wall): Box[] {
  const horizontal = wall === 'top' || wall === 'bottom';
  const L = (horizontal ? room.width : room.depth) * M;
  const H = room.height * M;
  const openings = room.openings.filter((o) => o.wall === wall).sort((a, b) => a.offset - b.offset);

  // 1D pieces along the wall: [u0, u1, y0, y1, kind]
  const pieces: [number, number, number, number, Box['kind']][] = [];
  let cursor = 0;
  for (const o of openings) {
    const u0 = o.offset * M, u1 = (o.offset + o.width) * M;
    if (u0 > cursor) pieces.push([cursor, u0, 0, H, 'wall']);
    if (o.kind === 'door') {
      pieces.push([u0, u1, o.height * M, H, 'wall']);
    } else {
      const sill = (o.sill ?? 90) * M, top = sill + o.height * M;
      pieces.push([u0, u1, 0, sill, 'wall']);
      pieces.push([u0, u1, sill, top, 'glass']);
      if (top < H) pieces.push([u0, u1, top, H, 'wall']);
    }
    cursor = u1;
  }
  if (cursor < L) pieces.push([cursor, L, 0, H, 'wall']);

  return pieces
    .filter(([u0, u1, y0, y1]) => u1 - u0 > 1e-6 && y1 - y0 > 1e-6)
    .map(([u0, u1, y0, y1, kind]) => {
      const len = u1 - u0, mid = (u0 + u1) / 2, h = y1 - y0, y = (y0 + y1) / 2;
      switch (wall) {
        case 'top': return { x: mid, y, z: -WALL_T / 2, w: len, h, d: WALL_T, kind };
        case 'bottom': return { x: mid, y, z: room.depth * M + WALL_T / 2, w: len, h, d: WALL_T, kind };
        case 'left': return { x: -WALL_T / 2, y, z: mid, w: WALL_T, h, d: len, kind };
        case 'right': return { x: room.width * M + WALL_T / 2, y, z: mid, w: WALL_T, h, d: len, kind };
      }
    });
}

export default function Walls({ room }: { room: RoomShell & { openings: Opening[] } }) {
  const walls: Wall[] = ['top', 'right', 'bottom', 'left'];
  // Each wall spans only its own dimension, which leaves a WALL_T slit at every corner.
  const H = room.height * M;
  const lo = -WALL_T / 2;
  const corners: [number, number][] = [
    [lo, lo],
    [room.width * M + WALL_T / 2, lo],
    [lo, room.depth * M + WALL_T / 2],
    [room.width * M + WALL_T / 2, room.depth * M + WALL_T / 2],
  ];
  return (
    <group>
      {corners.map(([x, z], i) => (
        <mesh key={`corner${i}`} position={[x, H / 2, z]} castShadow receiveShadow>
          <boxGeometry args={[WALL_T, H, WALL_T]} />
          <meshStandardMaterial color="#e7e5e4" />
        </mesh>
      ))}
      {walls.flatMap((w) => wallSegments(room, w).map((b, i) => (
        <mesh key={`${w}${i}`} position={[b.x, b.y, b.z]} castShadow={b.kind === 'wall'} receiveShadow>
          <boxGeometry args={[b.w, b.h, b.d]} />
          {b.kind === 'wall'
            ? <meshStandardMaterial color="#e7e5e4" />
            : <meshPhysicalMaterial color="#bae6fd" transparent opacity={0.25} roughness={0.1} />}
        </mesh>
      )))}
    </group>
  );
}
