// src/three/Sun.tsx
import { useMemo } from 'react';
import * as THREE from 'three';
import type { Wall } from '../engine/types';
import { dayFactor, sunAzimuth } from '../engine/daylight';
import { M } from './units';

const NORTH: Record<Wall, [number, number]> = { top: [0, -1], right: [1, 0], bottom: [0, 1], left: [-1, 0] };

/**
 * One sun for whatever is on the plan: a room at the origin, or a whole home standing at `x, y`.
 *
 * A home gets a single light rather than one per room — two suns at two elevations would put
 * two shadows under the same chair the moment you walked between rooms — so the extent it is
 * hung around and aimed at is the home's, while the hour and the north wall stay the current
 * room's, which is the only room whose daylight anyone is editing.
 */
export default function Sun({ hour, northWall, width, depth, x = 0, y = 0, castShadow = true }: { hour: number; northWall: Wall; width: number; depth: number; x?: number; y?: number; castShadow?: boolean }) {
  const { position, intensity, color } = useMemo(() => {
    const az = sunAzimuth(hour) ?? 0;
    const f = dayFactor(hour);
    const [nx, nz] = NORTH[northWall];
    const ex = -nz, ez = nx;
    const a = (az * Math.PI) / 180;
    const hx = nx * Math.cos(a) + ex * Math.sin(a);
    const hz = nz * Math.cos(a) + ez * Math.sin(a);
    const elev = ((60 * Math.PI) / 180) * Math.max(0, Math.sin((Math.PI * (hour - 6)) / 14));
    const R = 15;
    const cx = (x + width / 2) * M, cz = (y + depth / 2) * M;
    const position: [number, number, number] = [cx + hx * Math.cos(elev) * R, Math.sin(elev) * R + 0.5, cz + hz * Math.cos(elev) * R];
    const warm = new THREE.Color('#ffd2a1'), white = new THREE.Color('#ffffff');
    return { position, intensity: 0.2 + 2.6 * f, color: warm.lerp(white, Math.min(1, f * 1.2)) };
  }, [hour, northWall, width, depth, x, y]);
  const target = useMemo(() => { const t = new THREE.Object3D(); t.position.set((x + width / 2) * M, 0, (y + depth / 2) * M); return t; }, [width, depth, x, y]);
  // Fit the shadow frustum to the room so a 2048 map spends its texels on the floor.
  const S = Math.max(4, Math.max(width, depth) * M * 0.9);
  const f = dayFactor(hour);
  // The bounce a real room gets off the wall the sun is not on: without it every surface
  // facing away from the window falls to a flat, lifeless grey.
  const cx = (x + width / 2) * M, cz = (y + depth / 2) * M;
  const fill: [number, number, number] = [2 * cx - position[0], Math.max(1.6, position[1] * 0.55), 2 * cz - position[2]];
  return (
    <>
      {/* Warm ground tint stands in for floor bounce; without it the walls read as grey. */}
      <hemisphereLight args={['#e8f1fb', '#c2b09a', 0.6 + 0.5 * f]} />
      <primitive object={target} />
      <directionalLight
        position={position} intensity={intensity} color={color} castShadow={castShadow} target={target}
        shadow-mapSize-width={2048} shadow-mapSize-height={2048} shadow-bias={-0.0004}
        // A soft edge: a hard-edged shadow from a 15 m sun is the single most synthetic thing
        // in an interior render.
        shadow-radius={4}
        shadow-camera-left={-S} shadow-camera-right={S} shadow-camera-top={S} shadow-camera-bottom={-S} shadow-camera-near={1} shadow-camera-far={40}
      />
      <directionalLight position={fill} intensity={0.25} color="#ffd9b3" target={target} />
    </>
  );
}
