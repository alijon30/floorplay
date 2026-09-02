// src/three/Floor.tsx
import { M } from './units';

export default function Floor({ width, depth }: { width: number; depth: number }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[(width * M) / 2, 0, (depth * M) / 2]} receiveShadow>
      <planeGeometry args={[width * M, depth * M]} />
      <meshStandardMaterial color="#c8b79a" />
    </mesh>
  );
}
