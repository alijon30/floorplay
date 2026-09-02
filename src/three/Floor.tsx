// src/three/Floor.tsx
import { useMemo } from 'react';
import type { FloorFinish } from '../engine/types';
import { FLOOR_FALLBACK, floorTileM, makeFloorTexture } from './textures';
import { M } from './units';

export default function Floor({ width, depth, finish }: { width: number; depth: number; finish: FloorFinish }) {
  const w = width * M, d = depth * M;
  const map = useMemo(() => {
    const tex = makeFloorTexture(finish);
    // One texture per finish, one floor on screen: setting the repeat here is safe.
    const tile = floorTileM(finish);
    if (tex) tex.repeat.set(Math.max(1, w / tile), Math.max(1, d / tile));
    return tex;
  }, [w, d, finish]);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[w / 2, 0, d / 2]} receiveShadow>
      <planeGeometry args={[w, d]} />
      <meshStandardMaterial map={map} color={map ? '#ffffff' : FLOOR_FALLBACK[finish]} roughness={finish === 'tile' ? 0.45 : 0.85} metalness={0} />
    </mesh>
  );
}
