// src/three/Sun.tsx
import { useMemo } from 'react';
import * as THREE from 'three';
import type { Wall } from '../engine/types';
import { dayFactor, sunAzimuth } from '../engine/daylight';
import { M } from './units';

const NORTH: Record<Wall, [number, number]> = { top: [0, -1], right: [1, 0], bottom: [0, 1], left: [-1, 0] };

export default function Sun({ hour, northWall, width, depth, castShadow = true }: { hour: number; northWall: Wall; width: number; depth: number; castShadow?: boolean }) {
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
    const cx = (width * M) / 2, cz = (depth * M) / 2;
    const position: [number, number, number] = [cx + hx * Math.cos(elev) * R, Math.sin(elev) * R + 0.5, cz + hz * Math.cos(elev) * R];
    const warm = new THREE.Color('#ffd2a1'), white = new THREE.Color('#ffffff');
    return { position, intensity: 0.2 + 2.6 * f, color: warm.lerp(white, Math.min(1, f * 1.2)) };
  }, [hour, northWall, width, depth]);
  const target = useMemo(() => { const t = new THREE.Object3D(); t.position.set((width * M) / 2, 0, (depth * M) / 2); return t; }, [width, depth]);
  // Fit the shadow frustum to the room so a 2048 map spends its texels on the floor.
  const S = Math.max(4, Math.max(width, depth) * M * 0.9);
  const f = dayFactor(hour);
  return (
    <>
      {/* Warm ground tint stands in for floor bounce; without it the walls read as grey. */}
      <hemisphereLight args={['#e8f1fb', '#c2b09a', 0.6 + 0.5 * f]} />
      <primitive object={target} />
      <directionalLight
        position={position} intensity={intensity} color={color} castShadow={castShadow} target={target}
        shadow-mapSize-width={2048} shadow-mapSize-height={2048} shadow-bias={-0.0004}
        shadow-camera-left={-S} shadow-camera-right={S} shadow-camera-top={S} shadow-camera-bottom={-S} shadow-camera-near={1} shadow-camera-far={40}
      />
    </>
  );
}
