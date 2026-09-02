// src/three/Furniture.tsx
import type { ReactElement, ReactNode } from 'react';
import * as THREE from 'three';
import { Edges, Html, RoundedBox } from '@react-three/drei';
import type { CatalogItem, PlacedItem } from '../engine/types';
import { M } from './units';

type Props = {
  item: PlacedItem;
  cat: CatalogItem;
  ghost?: boolean;
  removal?: boolean;
  selected?: boolean;
  onSelect?: (id: string) => void;
};

type G = { ghost?: boolean; removal?: boolean };

const scratch = new THREE.Color();
/** Blend a catalog color toward another, for duvets, door panels and screens. */
function mix(hex: string, toward: string, t: number): string {
  return scratch.set(hex).lerp(new THREE.Color(toward), t).getStyle();
}

type MatProps = G & {
  color: string;
  roughness?: number;
  metalness?: number;
  emissive?: string;
  emissiveIntensity?: number;
  side?: THREE.Side;
};

function Mat({ color, ghost, removal, roughness = 0.8, metalness = 0, emissive = '#000000', emissiveIntensity = 1, side = THREE.FrontSide }: MatProps) {
  if (removal) return <meshStandardMaterial color="#ef4444" transparent opacity={0.35} roughness={0.5} side={side} />;
  if (ghost) return <meshStandardMaterial color="#34d399" transparent opacity={0.4} roughness={0.5} side={side} />;
  return <meshStandardMaterial color={color} roughness={roughness} metalness={metalness} emissive={emissive} emissiveIntensity={emissiveIntensity} side={side} />;
}

type PartProps = MatProps & {
  w: number; h: number; d: number;
  x?: number; y: number; z?: number;
  radius?: number;
  children?: ReactNode;
};

/**
 * One rounded slab. The radius is clamped to the part, and very thin parts (shelf boards,
 * rugs, screens) fall back to a plain box because an extrude bevel wider than the part
 * itself produces inverted geometry.
 */
function Part({ w, h, d, x = 0, y, z = 0, radius = 0.02, children, ...m }: PartProps) {
  const r = Math.min(radius, Math.min(w, h, d) * 0.45);
  const mat = <Mat {...m} />;
  if (r < 0.004) {
    return (
      <mesh position={[x, y, z]} castShadow={!m.ghost} receiveShadow>
        <boxGeometry args={[w, h, d]} />
        {mat}
        {children}
      </mesh>
    );
  }
  return (
    <RoundedBox args={[w, h, d]} radius={r} smoothness={4} bevelSegments={2} position={[x, y, z]} castShadow={!m.ghost} receiveShadow>
      {mat}
      {children}
    </RoundedBox>
  );
}

const SIGNS: [number, number][] = [[-1, -1], [1, -1], [-1, 1], [1, 1]];

export default function Furniture({ item, cat, ghost, removal, selected, onSelect }: Props) {
  const w = cat.width * M, d = cat.depth * M, h = cat.height * M;
  const c = cat.color;
  const g: G = { ghost, removal };
  const interactive = !ghost && !removal && !!onSelect;
  // The outline rides on the item's main body only; hanging it off every part would draw
  // a cage of green lines instead of a silhouette.
  const edges = selected && interactive ? <Edges color="#34d399" lineWidth={2} /> : null;

  let body: ReactElement;
  switch (cat.shape) {
    case 'bed': {
      const frameH = h * 0.55, matH = h * 0.5, top = frameH + matH;
      const headTop = top + 0.42, headBottom = h * 0.2;
      body = (
        <group>
          <Part w={w} h={frameH} d={d} y={frameH / 2} color="#6f5942" roughness={0.75} {...g} />
          <Part w={w - 0.06} h={matH} d={d - 0.06} y={frameH + matH / 2} color={c} radius={0.03} {...g}>{edges}</Part>
          <Part w={w + 0.05} h={headTop - headBottom} d={0.06} y={(headTop + headBottom) / 2} z={-d / 2 - 0.03} color="#6f5942" roughness={0.75} {...g} />
          <Part w={w - 0.05} h={0.06} d={d * 0.6} y={top + 0.03} z={d / 2 - d * 0.3} color={mix(c, '#ffffff', 0.45)} roughness={0.9} radius={0.03} {...g} />
          {[-1, 1].map((s) => (
            <Part key={s} w={w * 0.4} h={0.1} d={0.32} x={s * w * 0.22} y={top + 0.05} z={-d / 2 + 0.26} color="#faf7f2" roughness={0.9} radius={0.045} {...g} />
          ))}
        </group>
      );
      break;
    }
    case 'sofa': {
      const legH = 0.09, seatH = h * 0.28, seatTop = legH + seatH, armT = 0.14;
      const inner = Math.max(0.2, w - armT * 2);
      const n = Math.max(1, Math.round(inner / 0.72));
      const cw = inner / n - 0.02;
      body = (
        <group>
          {SIGNS.map(([sx, sz], i) => (
            <Part key={i} w={0.05} h={legH} d={0.05} x={sx * (w / 2 - 0.09)} y={legH / 2} z={sz * (d / 2 - 0.09)} color="#4a3a2c" roughness={0.6} {...g} />
          ))}
          <Part w={w} h={seatH} d={d} y={legH + seatH / 2} color={c} {...g}>{edges}</Part>
          <Part w={w} h={h - legH} d={0.16} y={legH + (h - legH) / 2} z={-d / 2 + 0.08} color={c} {...g} />
          {Array.from({ length: n }, (_, i) => {
            const x = -inner / 2 + (i + 0.5) * (inner / n);
            return (
              <group key={i}>
                <Part w={cw} h={0.12} d={d - 0.24} x={x} y={seatTop + 0.05} z={0.03} color={mix(c, '#ffffff', 0.14)} radius={0.035} {...g} />
                <Part w={cw} h={h - seatTop - 0.06} d={0.12} x={x} y={seatTop + (h - seatTop) / 2} z={-d / 2 + 0.21} color={mix(c, '#ffffff', 0.2)} radius={0.035} {...g} />
              </group>
            );
          })}
          {[-1, 1].map((s) => (
            <Part key={s} w={armT} h={h * 0.72 - legH} d={d} x={s * (w / 2 - armT / 2)} y={legH + (h * 0.72 - legH) / 2} color={mix(c, '#000000', 0.06)} radius={0.05} {...g} />
          ))}
        </group>
      );
      break;
    }
    case 'desk':
    case 'table': {
      const top = cat.shape === 'desk' ? 0.04 : 0.05;
      body = (
        <group>
          <Part w={w} h={top} d={d} y={h - top / 2} color={c} radius={0.012} {...g}>{edges}</Part>
          {SIGNS.map(([sx, sz], i) => (
            <Part key={i} w={0.05} h={h - top} d={0.05} x={sx * (w / 2 - 0.06)} y={(h - top) / 2} z={sz * (d / 2 - 0.06)} color="#3f3f46" roughness={0.55} metalness={0.25} radius={0.008} {...g} />
          ))}
        </group>
      );
      break;
    }
    case 'chair': {
      const seatY = h * 0.45, legH = seatY - 0.03;
      body = (
        <group>
          <Part w={w} h={0.06} d={d} y={seatY} color={c} radius={0.018} {...g}>{edges}</Part>
          <Part w={w} h={h * 0.48} d={0.05} y={seatY + 0.03 + h * 0.24} z={-d / 2 + 0.03} color={c} radius={0.018} {...g} />
          {SIGNS.map(([sx, sz], i) => (
            <Part key={i} w={0.035} h={legH} d={0.035} x={sx * (w / 2 - 0.045)} y={legH / 2} z={sz * (d / 2 - 0.045)} color="#3f3f46" roughness={0.55} metalness={0.25} radius={0.006} {...g} />
          ))}
        </group>
      );
      break;
    }
    case 'wardrobe': {
      const panel = mix(c, '#000000', 0.07);
      body = (
        <group>
          <Part w={w} h={h} d={d} y={h / 2} color={c} {...g}>{edges}</Part>
          {[-1, 1].map((s) => (
            <group key={s}>
              <Part w={w / 2 - 0.02} h={h - 0.07} d={0.02} x={s * (w / 4)} y={h / 2} z={d / 2 + 0.005} color={panel} radius={0.008} {...g} />
              <Part w={0.016} h={0.14} d={0.016} x={s * 0.04} y={h * 0.5} z={d / 2 + 0.025} color="#9aa0a8" roughness={0.3} metalness={0.6} radius={0.006} {...g} />
            </group>
          ))}
        </group>
      );
      break;
    }
    case 'shelf': {
      const n = Math.max(2, Math.round(h / 0.4));
      body = (
        <group>
          <Part w={w} h={h} d={0.02} y={h / 2} z={-d / 2 + 0.01} color={mix(c, '#000000', 0.1)} {...g}>{edges}</Part>
          {[-1, 1].map((s) => (
            <Part key={s} w={0.022} h={h} d={d} x={s * (w / 2 - 0.011)} y={h / 2} color={c} radius={0.006} {...g} />
          ))}
          {Array.from({ length: n + 1 }, (_, i) => (
            <Part key={i} w={w - 0.044} h={0.022} d={d - 0.02} y={0.011 + (i * (h - 0.022)) / n} z={0.01} color={c} radius={0.006} {...g} />
          ))}
        </group>
      );
      break;
    }
    case 'rug':
      // Kept under the contact-shadow plane so a rug reads as a rug and not as a shadow.
      body = <Part w={w} h={0.003} d={d} y={0.0025} color={c} roughness={0.95} {...g}>{edges}</Part>;
      break;
    case 'lamp': {
      const shadeH = 0.26, shadeY = h - shadeH / 2;
      body = (
        <group>
          <mesh position={[0, 0.012, 0]} castShadow={!ghost} receiveShadow>
            <cylinderGeometry args={[w * 0.32, w * 0.35, 0.024, 20]} />
            <Mat color="#4b5563" roughness={0.5} metalness={0.4} {...g} />
          </mesh>
          <mesh position={[0, (h - shadeH) / 2, 0]} castShadow={!ghost}>
            <cylinderGeometry args={[0.016, 0.016, h - shadeH, 12]} />
            <Mat color="#6b7280" roughness={0.45} metalness={0.5} {...g} />
          </mesh>
          <mesh position={[0, shadeY, 0]}>
            <cylinderGeometry args={[w * 0.34, w * 0.48, shadeH, 24, 1, true]} />
            <Mat color={c} roughness={0.9} emissive={c} emissiveIntensity={0.6} side={THREE.DoubleSide} {...g} />
            {edges}
          </mesh>
          {!ghost && !removal && <pointLight position={[0, shadeY - 0.04, 0]} intensity={0.55} color="#ffd9a0" distance={3.2} decay={2} />}
        </group>
      );
      break;
    }
    case 'plant': {
      const potH = h * 0.26, r1 = w * 0.36, r2 = w * 0.29, r3 = w * 0.26;
      const y1 = h - r1, y2 = h - r2 * 2.4, y3 = h - r3 * 3.4;
      const stemTop = Math.min(y1, y3);
      body = (
        <group>
          <mesh position={[0, potH / 2, 0]} castShadow={!ghost} receiveShadow>
            <cylinderGeometry args={[w * 0.32, w * 0.26, potH, 20]} />
            <Mat color="#a9694c" roughness={0.85} {...g} />
            {edges}
          </mesh>
          <mesh position={[0, potH - 0.008, 0]}>
            <cylinderGeometry args={[w * 0.3, w * 0.3, 0.02, 20]} />
            <Mat color="#3b2f26" roughness={1} {...g} />
          </mesh>
          <mesh position={[0, (potH + stemTop) / 2, 0]} castShadow={!ghost}>
            <cylinderGeometry args={[0.018, 0.024, Math.max(0.02, stemTop - potH), 8]} />
            <Mat color={mix(c, '#000000', 0.35)} roughness={0.9} {...g} />
          </mesh>
          <mesh position={[0, y1, 0]} castShadow={!ghost}>
            <sphereGeometry args={[r1, 18, 14]} />
            <Mat color={c} roughness={0.9} {...g} />
          </mesh>
          <mesh position={[w * 0.26, y2, -w * 0.1]} castShadow={!ghost}>
            <sphereGeometry args={[r2, 16, 12]} />
            <Mat color={mix(c, '#ffffff', 0.16)} roughness={0.9} {...g} />
          </mesh>
          <mesh position={[-w * 0.24, y3, w * 0.14]} castShadow={!ghost}>
            <sphereGeometry args={[r3, 16, 12]} />
            <Mat color={mix(c, '#000000', 0.18)} roughness={0.9} {...g} />
          </mesh>
        </group>
      );
      break;
    }
    case 'tv': {
      const panelH = w * 0.5, panelY = h + 0.1 + panelH / 2;
      body = (
        <group>
          <Part w={w} h={h} d={d} y={h / 2} color={c} roughness={0.5} {...g}>{edges}</Part>
          <Part w={0.09} h={0.1} d={0.06} y={h + 0.05} z={-d / 2 + 0.09} color="#1b1f27" roughness={0.4} {...g} />
          <Part w={w * 0.86} h={panelH} d={0.028} y={panelY} z={-d / 2 + 0.08} color="#1b1f27" roughness={0.45} radius={0.01} {...g} />
          <Part w={w * 0.82} h={panelH - 0.04} d={0.006} y={panelY} z={-d / 2 + 0.098} color="#0a0e16" roughness={0.2} metalness={0.5} {...g} />
        </group>
      );
      break;
    }
    default: {
      const drawers = cat.category === 'dresser' || cat.category === 'nightstand' ? Math.max(1, Math.min(3, Math.round(h / 0.3))) : 0;
      const dh = drawers > 0 ? (h - 0.06) / drawers : 0;
      body = (
        <group>
          <Part w={w} h={h} d={d} y={h / 2} color={c} {...g}>{edges}</Part>
          {Array.from({ length: drawers }, (_, i) => (
            <group key={i}>
              <Part w={w - 0.06} h={dh - 0.02} d={0.018} y={0.03 + dh * (i + 0.5)} z={d / 2 + 0.004} color={mix(c, '#000000', 0.08)} radius={0.008} {...g} />
              <Part w={w * 0.28} h={0.014} d={0.016} y={0.03 + dh * (i + 0.5)} z={d / 2 + 0.022} color="#9aa0a8" roughness={0.3} metalness={0.6} radius={0.005} {...g} />
            </group>
          ))}
        </group>
      );
    }
  }

  return (
    <group
      position={[item.x * M, 0, item.y * M]}
      rotation={[0, (-item.rotation * Math.PI) / 180, 0]}
      onClick={interactive ? (e) => { e.stopPropagation(); onSelect(item.id); } : undefined}
    >
      {body}
      {selected && interactive && (
        <Html center distanceFactor={6} position={[0, h + 0.3, 0]} pointerEvents="none" zIndexRange={[30, 0]}>
          <div className="whitespace-nowrap rounded-full bg-neutral-900/85 px-2 py-0.5 text-[11px] font-medium text-white shadow ring-1 ring-emerald-400/60">
            {cat.name}
          </div>
        </Html>
      )}
    </group>
  );
}
