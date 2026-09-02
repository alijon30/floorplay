// src/three/Sun.tsx
import { useMemo } from 'react';
import * as THREE from 'three';
import type { Wall } from '../engine/types';
import { dayFactor, sunAzimuth } from '../engine/daylight';
import { M } from './units';

const NORTH: Record<Wall, [number, number]> = { top: [0, -1], right: [1, 0], bottom: [0, 1], left: [-1, 0] };

export default function Sun({ hour, northWall, width, depth }: { hour: number; northWall: Wall; width: number; depth: number }) {
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
  return (
    <>
      <hemisphereLight args={['#dbeafe', '#3f3f46', 0.35 + 0.4 * dayFactor(hour)]} />
      <primitive object={target} />
      <directionalLight
        position={position} intensity={intensity} color={color} castShadow target={target}
        shadow-mapSize-width={2048} shadow-mapSize-height={2048}
        shadow-camera-left={-6} shadow-camera-right={6} shadow-camera-top={6} shadow-camera-bottom={-6} shadow-camera-near={1} shadow-camera-far={40}
      />
    </>
  );
}
