// src/three/Walls.tsx
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Opening, RoomFinish, RoomShell, Wall } from '../engine/types';
import { DEFAULT_FINISH, WALLS } from '../engine/types';
import { wallColor } from '../engine/wallColor';
import { finish } from '../engine/materials';
import { makePlasterTexture } from './textures';
import { M, WALL_T } from './units';

export interface Box { x: number; y: number; z: number; w: number; h: number; d: number; kind: 'wall' | 'glass' }

/** Baseboard height and how far it stands proud of the wall, in meters. */
export const BASEBOARD_H = 0.08;
const BASEBOARD_T = 0.02;
/** Painted skirting: a dark stain, so it reads as a line at the foot of every wall. */
const BASEBOARD_COLOR = finish('black-stain');

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

/**
 * Baseboard boxes (meters, centered) hugging the inside face of one wall, split around
 * doors only. Windows sit well above the board, so they do not interrupt it. The left and
 * right runs are trimmed by the board thickness so the top and bottom runs own the corners.
 */
export function baseboardSegments(room: RoomShell & { openings: Opening[] }, wall: Wall): Box[] {
  const horizontal = wall === 'top' || wall === 'bottom';
  const L = (horizontal ? room.width : room.depth) * M;
  const doors = room.openings.filter((o) => o.wall === wall && o.kind === 'door').sort((a, b) => a.offset - b.offset);

  const spans: [number, number][] = [];
  let cursor = horizontal ? 0 : BASEBOARD_T;
  const end = horizontal ? L : L - BASEBOARD_T;
  for (const o of doors) {
    const u0 = o.offset * M, u1 = (o.offset + o.width) * M;
    if (u0 > cursor) spans.push([cursor, Math.min(u0, end)]);
    cursor = Math.max(cursor, u1);
  }
  if (cursor < end) spans.push([cursor, end]);

  const y = BASEBOARD_H / 2, h = BASEBOARD_H, t = BASEBOARD_T;
  return spans
    .filter(([u0, u1]) => u1 - u0 > 1e-6)
    .map(([u0, u1]) => {
      const len = u1 - u0, mid = (u0 + u1) / 2;
      switch (wall) {
        case 'top': return { x: mid, y, z: t / 2, w: len, h, d: t, kind: 'wall' as const };
        case 'bottom': return { x: mid, y, z: room.depth * M - t / 2, w: len, h, d: t, kind: 'wall' as const };
        case 'left': return { x: t / 2, y, z: mid, w: t, h, d: len, kind: 'wall' as const };
        case 'right': return { x: room.width * M - t / 2, y, z: mid, w: t, h, d: len, kind: 'wall' as const };
      }
    });
}

/** Corner posts, in the order [top-left, top-right, bottom-left, bottom-right]. */
const CORNER_WALLS: [Wall, Wall][] = [['top', 'left'], ['top', 'right'], ['bottom', 'left'], ['bottom', 'right']];

/** How far outside the wall the daylight panel hangs, in meters. */
const SKY_GAP = 0.01;
/** Daylight seen through the glass. Flat and unlit, so the hour of day never dims it. */
const SKY_COLOR = '#dfe7ee';

/**
 * Where the panel of daylight goes for one pane: just outside the wall it is set into,
 * exactly the size of the opening.
 *
 * Beyond every window is the void the studio backdrop is made of, which through a pane reads
 * as a black rectangle punched in the wall. A flat panel of sky behind the glass is what turns
 * the opening back into a window. Derived from the glass boxes `wallSegments` already returns,
 * so the geometry the walls are built from is untouched.
 */
function skyPanel(room: RoomShell, wall: Wall, b: Box): { position: [number, number, number]; rotation: [number, number, number]; size: [number, number] } {
  switch (wall) {
    case 'top': return { position: [b.x, b.y, -WALL_T - SKY_GAP], rotation: [0, 0, 0], size: [b.w, b.h] };
    case 'bottom': return { position: [b.x, b.y, room.depth * M + WALL_T + SKY_GAP], rotation: [0, 0, 0], size: [b.w, b.h] };
    case 'left': return { position: [-WALL_T - SKY_GAP, b.y, b.z], rotation: [0, Math.PI / 2, 0], size: [b.d, b.h] };
    case 'right': return { position: [room.width * M + WALL_T + SKY_GAP, b.y, b.z], rotation: [0, Math.PI / 2, 0], size: [b.d, b.h] };
  }
}

export default function Walls({ room }: { room: RoomShell & { openings: Opening[]; finish?: RoomFinish } }) {
  /*
   * One paint per wall, read through `wallColor` so a wall with no override of its own falls
   * back to the room default and a room saved before per-wall colour existed still paints.
   *
   * Painted plaster, not a flat fill: a wall is the biggest surface on screen and the one that
   * gives the game away when the sun grazes it and finds nothing to catch. Four textures rather
   * than one, keyed on the four colours, so a room whose walls all match still makes only the
   * textures those colours need and a repaint of one wall leaves the other three alone.
   */
  const paints = useMemo(() => Object.fromEntries(WALLS.map((w) => [w, wallColor(room, w)])) as Record<Wall, string>, [room]);
  const plasters = useMemo(() => {
    const cache = new Map<string, ReturnType<typeof makePlasterTexture>>();
    return Object.fromEntries(WALLS.map((w) => {
      const hex = paints[w];
      if (!cache.has(hex)) cache.set(hex, makePlasterTexture(hex));
      return [w, cache.get(hex)!];
    })) as Record<Wall, ReturnType<typeof makePlasterTexture>>;
  }, [paints]);
  // The corner posts belong to two walls at once, so they take the room default rather than
  // either neighbour's override: a post painted like one of its walls reads as a mistake.
  const paint = room.finish?.wall ?? DEFAULT_FINISH.wall;
  const plaster = useMemo(() => makePlasterTexture(paint), [paint]);
  // Each wall spans only its own dimension, which leaves a WALL_T slit at every corner.
  const H = room.height * M;
  const W = room.width * M, D = room.depth * M;
  const lo = -WALL_T / 2;
  const corners: [number, number][] = [
    [lo, lo],
    [W + WALL_T / 2, lo],
    [lo, D + WALL_T / 2],
    [W + WALL_T / 2, D + WALL_T / 2],
  ];

  const wallRefs = useRef<Partial<Record<Wall, THREE.Group | null>>>({});
  const cornerRefs = useRef<(THREE.Mesh | null)[]>([]);

  // Dollhouse cutaway: a wall the camera has stepped outside of would otherwise fill the
  // frame with its blank outer face. Hiding it is what lets the orbit camera sit low
  // enough to read as a room instead of a floor plan. Walking inside hides nothing.
  useFrame(({ camera }) => {
    const p = camera.position;
    const hidden: Record<Wall, boolean> = {
      top: p.z < -0.02,
      bottom: p.z > D + 0.02,
      left: p.x < -0.02,
      right: p.x > W + 0.02,
    };
    for (const w of WALLS) {
      const g = wallRefs.current[w];
      if (g) g.visible = !hidden[w];
    }
    // A corner post only closes the slit between two visible walls.
    CORNER_WALLS.forEach(([a, b], i) => {
      const m = cornerRefs.current[i];
      if (m) m.visible = !hidden[a] && !hidden[b];
    });
  });

  return (
    <group>
      {corners.map(([x, z], i) => (
        <mesh key={`corner${i}`} ref={(m) => { cornerRefs.current[i] = m; }} position={[x, H / 2, z]} castShadow receiveShadow>
          <boxGeometry args={[WALL_T, H, WALL_T]} />
          <meshStandardMaterial map={plaster} color={plaster ? '#ffffff' : paint} roughness={0.95} metalness={0} />
        </mesh>
      ))}
      {WALLS.map((w) => {
        const wallPaint = paints[w];
        const wallPlaster = plasters[w];
        return (
        <group key={w} ref={(g) => { wallRefs.current[w] = g; }}>
          {/* The daylight behind the glass, drawn first: it is opaque, so it lands in the
              opaque pass and the panes blend over it in the right order. */}
          {wallSegments(room, w).filter((b) => b.kind === 'glass').map((b, i) => {
            const p = skyPanel(room, w, b);
            return (
              <mesh key={`sky${i}`} position={p.position} rotation={p.rotation}>
                <planeGeometry args={p.size} />
                <meshBasicMaterial color={SKY_COLOR} side={THREE.DoubleSide} toneMapped={false} />
              </mesh>
            );
          })}
          {wallSegments(room, w).map((b, i) => (
            <mesh key={`s${i}`} position={[b.x, b.y, b.z]} castShadow={b.kind === 'wall'} receiveShadow>
              <boxGeometry args={[b.w, b.h, b.d]} />
              {b.kind === 'wall'
                ? <meshStandardMaterial map={wallPlaster} color={wallPlaster ? '#ffffff' : wallPaint} roughness={0.95} metalness={0} />
                : <meshPhysicalMaterial color="#dfe8f0" emissive="#cfdbe6" emissiveIntensity={0.7} transparent opacity={0.55} roughness={0.05} metalness={0} toneMapped={false} />}
            </mesh>
          ))}
          {baseboardSegments(room, w).map((b, i) => (
            <mesh key={`b${i}`} position={[b.x, b.y, b.z]} receiveShadow>
              <boxGeometry args={[b.w, b.h, b.d]} />
              <meshStandardMaterial color={BASEBOARD_COLOR} roughness={0.6} metalness={0} />
            </mesh>
          ))}
        </group>
        );
      })}
    </group>
  );
}
