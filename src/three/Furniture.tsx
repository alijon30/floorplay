// src/three/Furniture.tsx
import type { ReactElement } from 'react';
import type { CatalogItem, PlacedItem } from '../engine/types';
import { M } from './units';

type Props = { item: PlacedItem; cat: CatalogItem; ghost?: boolean; removal?: boolean };

function Mat({ color, ghost, removal }: { color: string; ghost?: boolean; removal?: boolean }) {
  if (removal) return <meshStandardMaterial color="#ef4444" transparent opacity={0.35} />;
  if (ghost) return <meshStandardMaterial color="#34d399" transparent opacity={0.4} />;
  return <meshStandardMaterial color={color} />;
}

function Box({ w, h, d, x = 0, y, z = 0, color, ghost, removal }: { w: number; h: number; d: number; x?: number; y: number; z?: number; color: string; ghost?: boolean; removal?: boolean }) {
  return (
    <mesh position={[x, y, z]} castShadow={!ghost} receiveShadow>
      <boxGeometry args={[w, h, d]} />
      <Mat color={color} ghost={ghost} removal={removal} />
    </mesh>
  );
}

export default function Furniture({ item, cat, ghost, removal }: Props) {
  const w = cat.width * M, d = cat.depth * M, h = cat.height * M;
  const c = cat.color;
  const g = { ghost, removal };
  let body: ReactElement;
  switch (cat.shape) {
    case 'bed':
      body = (
        <group>
          <Box w={w} h={h * 0.6} d={d} y={h * 0.3} color="#8b7355" {...g} />
          <Box w={w - 0.08} h={h * 0.4} d={d - 0.08} y={h * 0.8} color={c} {...g} />
          <Box w={w * 0.4} h={0.1} d={0.35} x={-w * 0.22} y={h + 0.05} z={-d / 2 + 0.25} color="#f5f5f4" {...g} />
          <Box w={w * 0.4} h={0.1} d={0.35} x={w * 0.22} y={h + 0.05} z={-d / 2 + 0.25} color="#f5f5f4" {...g} />
        </group>
      );
      break;
    case 'sofa':
      body = (
        <group>
          <Box w={w} h={h * 0.5} d={d} y={h * 0.25} color={c} {...g} />
          <Box w={w} h={h} d={0.2} y={h / 2} z={-d / 2 + 0.1} color={c} {...g} />
          <Box w={0.15} h={h * 0.8} d={d} x={-w / 2 + 0.075} y={h * 0.4} color={c} {...g} />
          <Box w={0.15} h={h * 0.8} d={d} x={w / 2 - 0.075} y={h * 0.4} color={c} {...g} />
        </group>
      );
      break;
    case 'desk':
    case 'table': {
      const top = cat.shape === 'desk' ? 0.04 : 0.06;
      body = (
        <group>
          <Box w={w} h={top} d={d} y={h - top / 2} color={c} {...g} />
          {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz], i) => (
            <Box key={i} w={0.05} h={h - top} d={0.05} x={sx! * (w / 2 - 0.05)} y={(h - top) / 2} z={sz! * (d / 2 - 0.05)} color="#3f3f46" {...g} />
          ))}
        </group>
      );
      break;
    }
    case 'chair':
      body = (
        <group>
          <Box w={w} h={0.05} d={d} y={h * 0.45} color={c} {...g} />
          <Box w={w} h={h * 0.55} d={0.05} y={h * 0.45 + h * 0.275} z={-d / 2 + 0.025} color={c} {...g} />
          <Box w={0.04} h={h * 0.45} d={0.04} y={h * 0.225} color="#3f3f46" {...g} />
        </group>
      );
      break;
    case 'wardrobe':
      body = (
        <group>
          <Box w={w} h={h} d={d} y={h / 2} color={c} {...g} />
          <Box w={0.01} h={h - 0.1} d={0.01} y={h / 2} z={d / 2 + 0.005} color="#57534e" {...g} />
        </group>
      );
      break;
    case 'shelf': {
      const shelves = Math.max(2, Math.round(h / 0.4));
      body = (
        <group>
          <Box w={w} h={h} d={0.02} y={h / 2} z={-d / 2 + 0.01} color={c} {...g} />
          <Box w={0.02} h={h} d={d} x={-w / 2 + 0.01} y={h / 2} color={c} {...g} />
          <Box w={0.02} h={h} d={d} x={w / 2 - 0.01} y={h / 2} color={c} {...g} />
          {Array.from({ length: shelves + 1 }, (_, i) => <Box key={i} w={w} h={0.02} d={d} y={(i * h) / shelves} color={c} {...g} />)}
        </group>
      );
      break;
    }
    case 'rug':
      body = <Box w={w} h={0.01} d={d} y={0.005} color={c} {...g} />;
      break;
    case 'lamp':
      body = (
        <group>
          <mesh position={[0, h / 2, 0]} castShadow={!ghost}><cylinderGeometry args={[0.015, 0.015, h, 12]} /><Mat color="#71717a" {...g} /></mesh>
          <mesh position={[0, h - 0.12, 0]}><cylinderGeometry args={[w / 2, w / 3, 0.25, 16, 1, true]} /><meshStandardMaterial color={c} side={2} transparent opacity={ghost ? 0.4 : 0.9} /></mesh>
          {!ghost && <pointLight position={[0, h - 0.1, 0]} intensity={0.6} color="#ffd9a0" distance={3} />}
        </group>
      );
      break;
    case 'plant':
      body = (
        <group>
          <mesh position={[0, h * 0.15, 0]} castShadow={!ghost}><cylinderGeometry args={[w * 0.35, w * 0.3, h * 0.3, 12]} /><Mat color="#78716c" {...g} /></mesh>
          <mesh position={[0, h - w * 0.5, 0]} castShadow={!ghost}><sphereGeometry args={[w * 0.5, 16, 12]} /><Mat color={c} {...g} /></mesh>
        </group>
      );
      break;
    case 'tv':
      body = (
        <group>
          <Box w={w} h={h} d={d} y={h / 2} color={c} {...g} />
          <Box w={w * 0.9} h={w * 0.5} d={0.03} y={h + w * 0.25} z={-d / 2 + 0.03} color="#111827" {...g} />
        </group>
      );
      break;
    default:
      body = <Box w={w} h={h} d={d} y={h / 2} color={c} {...g} />;
  }
  return (
    <group position={[item.x * M, 0, item.y * M]} rotation={[0, (-item.rotation * Math.PI) / 180, 0]}>
      {body}
    </group>
  );
}
