// src/three/Floor.tsx
import { useMemo } from 'react';
import { PLANK_TILE_M, makePlankTexture } from './textures';
import { M } from './units';

export default function Floor({ width, depth }: { width: number; depth: number }) {
  const w = width * M, d = depth * M;
  const map = useMemo(() => {
    const tex = makePlankTexture();
    // One shared texture, one floor: setting the repeat here is safe.
    if (tex) tex.repeat.set(Math.max(1, w / PLANK_TILE_M), Math.max(1, d / PLANK_TILE_M));
    return tex;
  }, [w, d]);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[w / 2, 0, d / 2]} receiveShadow>
      <planeGeometry args={[w, d]} />
      <meshStandardMaterial map={map} color={map ? '#ffffff' : '#c8b79a'} roughness={0.85} metalness={0} />
    </mesh>
  );
}
