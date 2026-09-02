// src/three/Furniture.tsx
import { useRef, type ReactElement, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Edges, Html, RoundedBox } from '@react-three/drei';
import type { CatalogItem, PlacedItem, Wall } from '../engine/types';
import { isMounted, itemColor } from '../engine/catalog';
import { footprint } from '../engine/geometry';
import { M } from './units';

type Props = {
  item: PlacedItem;
  cat: CatalogItem;
  ghost?: boolean;
  removal?: boolean;
  selected?: boolean;
  onSelect?: (id: string) => void;
  /** Room size in cm. Only needed to work out which wall a mounted item hangs on. */
  roomW?: number;
  roomD?: number;
};

/** The wall a mounted item hangs on: whichever its footprint sits closest to. */
function hangingWall(item: PlacedItem, cat: CatalogItem, roomW: number, roomD: number): Wall {
  const r = footprint(item, cat);
  const d: [Wall, number][] = [
    ['top', r.y],
    ['bottom', roomD - (r.y + r.h)],
    ['left', r.x],
    ['right', roomW - (r.x + r.w)],
  ];
  return d.reduce((a, b) => (b[1] < a[1] ? b : a))[0];
}

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

export default function Furniture({ item, cat, ghost, removal, selected, onSelect, roomW, roomD }: Props) {
  const w = cat.width * M, d = cat.depth * M, h = cat.height * M;
  const c = itemColor(cat, item.color);
  // A wall-mounted piece is built from its own bottom up, exactly like a floor-standing one,
  // and then lifted whole: the mount height is the only thing that differs.
  const mounted = isMounted(cat);
  const mountY = (cat.mountHeight ?? 0) * M;

  // A picture hanging on a wall the dollhouse cutaway has taken away would otherwise float in
  // mid-air, so it steps out with the wall it is fixed to. The test matches the one in Walls.
  const root = useRef<THREE.Group>(null);
  const wall = mounted && roomW !== undefined && roomD !== undefined ? hangingWall(item, cat, roomW, roomD) : null;
  useFrame(({ camera }) => {
    const gRoot = root.current;
    if (!gRoot || !wall) return;
    const p = camera.position;
    const hidden = wall === 'top' ? p.z < -0.02
      : wall === 'bottom' ? p.z > roomD! * M + 0.02
        : wall === 'left' ? p.x < -0.02
          : p.x > roomW! * M + 0.02;
    gRoot.visible = !hidden;
  });
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
      if (mounted) {
        // A pendant hangs from a cord that runs up out of the top of its own box.
        const shadeH = Math.min(h, 0.24);
        body = (
          <group>
            <mesh position={[0, h + 0.3, 0]}>
              <cylinderGeometry args={[0.006, 0.006, 0.6, 6]} />
              <Mat color="#3f3f46" roughness={0.6} {...g} />
            </mesh>
            <mesh position={[0, shadeH / 2, 0]}>
              <cylinderGeometry args={[w * 0.16, w * 0.5, shadeH, 24, 1, true]} />
              <Mat color={c} roughness={0.9} emissive={c} emissiveIntensity={0.7} side={THREE.DoubleSide} {...g} />
              {edges}
            </mesh>
            {!ghost && !removal && <pointLight position={[0, 0.02, 0]} intensity={0.6} color="#ffd9a0" distance={4} decay={2} />}
          </group>
        );
        break;
      }
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
      if (mounted) {
        // A wall TV is the panel and nothing else: no stand, no cabinet under it.
        body = (
          <group>
            <Part w={w} h={h} d={d} y={h / 2} color="#1b1f27" roughness={0.45} radius={0.008} {...g}>{edges}</Part>
            <Part w={w - 0.05} h={h - 0.05} d={0.006} y={h / 2} z={d / 2 + 0.004} color="#0a0e16" roughness={0.2} metalness={0.5} {...g} />
          </group>
        );
        break;
      }
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
    case 'counter': {
      const topH = 0.04, plinth = 0.08;
      const bodyH = h - topH - plinth;
      const doors = Math.max(1, Math.round(w / 0.6));
      body = (
        <group>
          <Part w={w - 0.06} h={plinth} d={d - 0.06} y={plinth / 2} color="#3f3f46" roughness={0.7} {...g} />
          <Part w={w} h={bodyH} d={d} y={plinth + bodyH / 2} color={c} {...g}>{edges}</Part>
          {Array.from({ length: doors }, (_, i) => (
            <Part
              key={i} w={w / doors - 0.02} h={bodyH - 0.04} d={0.016}
              x={-w / 2 + (i + 0.5) * (w / doors)} y={plinth + bodyH / 2} z={d / 2 + 0.004}
              color={mix(c, '#000000', 0.06)} radius={0.006} {...g}
            />
          ))}
          {/* The worktop overhangs the carcass, which is what makes a run of units read as one counter. */}
          <Part w={w + 0.02} h={topH} d={d + 0.02} y={h - topH / 2} color={mix(c, '#ffffff', 0.4)} roughness={0.35} radius={0.008} {...g} />
        </group>
      );
      break;
    }
    case 'appliance': {
      const front = mix(c, '#000000', 0.5);
      body = (
        <group>
          <Part w={w} h={h} d={d} y={h / 2} color={c} roughness={0.4} metalness={0.25} {...g}>{edges}</Part>
          <Part w={w - 0.04} h={h - 0.06} d={0.02} y={h / 2} z={d / 2 + 0.005} color={front} roughness={0.3} metalness={0.3} radius={0.008} {...g} />
          <Part w={0.022} h={Math.min(0.5, h * 0.5)} d={0.035} x={w / 2 - 0.07} y={h * 0.6} z={d / 2 + 0.03} color="#9aa0a8" roughness={0.25} metalness={0.65} radius={0.008} {...g} />
        </group>
      );
      break;
    }
    case 'stool': {
      const seatH = 0.05, r = Math.max(0.1, w * 0.45);
      body = (
        <group>
          <mesh position={[0, 0.015, 0]} castShadow={!ghost} receiveShadow>
            <cylinderGeometry args={[r * 0.78, r * 0.86, 0.03, 20]} />
            <Mat color="#3f3f46" roughness={0.5} metalness={0.35} {...g} />
          </mesh>
          <mesh position={[0, (h - seatH) / 2, 0]} castShadow={!ghost}>
            <cylinderGeometry args={[0.028, 0.032, h - seatH, 12]} />
            <Mat color="#3f3f46" roughness={0.5} metalness={0.35} {...g} />
          </mesh>
          {h > 0.6 && (
            <mesh position={[0, h * 0.28, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow={!ghost}>
              <torusGeometry args={[r * 0.7, 0.012, 8, 24]} />
              <Mat color="#9aa0a8" roughness={0.3} metalness={0.6} {...g} />
            </mesh>
          )}
          <mesh position={[0, h - seatH / 2, 0]} castShadow={!ghost} receiveShadow>
            <cylinderGeometry args={[r, r, seatH, 24]} />
            <Mat color={c} roughness={0.7} {...g} />
            {edges}
          </mesh>
        </group>
      );
      break;
    }
    case 'bench': {
      const seatH = 0.05, legH = h - seatH;
      body = (
        <group>
          <Part w={w} h={seatH} d={d} y={h - seatH / 2} color={c} radius={0.012} {...g}>{edges}</Part>
          {SIGNS.map(([sx, sz], i) => (
            <Part key={i} w={0.05} h={legH} d={0.05} x={sx * (w / 2 - 0.06)} y={legH / 2} z={sz * (d / 2 - 0.05)} color={mix(c, '#000000', 0.25)} roughness={0.6} radius={0.008} {...g} />
          ))}
        </group>
      );
      break;
    }
    case 'picture':
    case 'mirror': {
      const face = cat.shape === 'mirror';
      const inset = Math.max(0.03, Math.min(w, h) * 0.07);
      body = (
        <group>
          <Part w={w} h={h} d={d} y={h / 2} color={c} roughness={0.5} radius={0.006} {...g}>{edges}</Part>
          <Part
            w={Math.max(0.02, w - inset * 2)} h={Math.max(0.02, h - inset * 2)} d={Math.max(0.004, d * 0.35)}
            y={h / 2} z={d * 0.34}
            // A fully metallic pane renders black without an environment to reflect, so the
            // glass is a pale, barely-metallic gloss with a little self-light instead.
            color={face ? '#cfe0ea' : mix(c, '#ffffff', 0.62)}
            roughness={face ? 0.06 : 0.85} metalness={face ? 0.15 : 0}
            emissive={face ? '#9fb8c8' : '#000000'} emissiveIntensity={face ? 0.14 : 1}
            radius={0.004} {...g}
          />
        </group>
      );
      break;
    }
    case 'curtain': {
      const panelW = w * 0.44, t = Math.max(0.02, d * 0.55);
      body = (
        <group>
          <mesh position={[0, h - 0.02, -d * 0.1]} rotation={[0, 0, Math.PI / 2]} castShadow={!ghost}>
            <cylinderGeometry args={[0.016, 0.016, w + 0.12, 10]} />
            <Mat color="#9aa0a8" roughness={0.3} metalness={0.6} {...g} />
          </mesh>
          {[-1, 1].map((s) => (
            <Part key={s} w={panelW} h={h - 0.04} d={t} x={s * (w / 2 - panelW / 2)} y={(h - 0.04) / 2} color={c} roughness={0.95} radius={0.03} {...g}>
              {s === -1 ? edges : null}
            </Part>
          ))}
        </group>
      );
      break;
    }
    case 'hooks': {
      const n = Math.max(2, Math.round(w / 0.18));
      const plate = Math.max(0.02, d * 0.25);
      body = (
        <group>
          <Part w={w} h={h} d={plate} y={h / 2} z={-d / 2 + plate / 2} color={c} radius={0.006} {...g}>{edges}</Part>
          {Array.from({ length: n }, (_, i) => {
            const x = -w / 2 + ((i + 0.5) * w) / n;
            return (
              <group key={i}>
                <Part w={0.014} h={0.014} d={d * 0.8} x={x} y={h * 0.6} z={0} color="#9aa0a8" roughness={0.3} metalness={0.6} radius={0.006} {...g} />
                <Part w={0.02} h={0.05} d={0.02} x={x} y={h * 0.42} z={d / 2 - 0.01} color="#9aa0a8" roughness={0.3} metalness={0.6} radius={0.008} {...g} />
              </group>
            );
          })}
        </group>
      );
      break;
    }
    case 'wallshelf': {
      const board = Math.min(0.04, h * 0.35);
      body = (
        <group>
          <Part w={w} h={board} d={d} y={h - board / 2} color={c} radius={0.006} {...g}>{edges}</Part>
          {[-1, 1].map((s) => (
            <Part key={s} w={0.02} h={h - board} d={d * 0.75} x={s * (w / 2 - 0.07)} y={(h - board) / 2} z={-d * 0.1} color={mix(c, '#000000', 0.3)} roughness={0.6} radius={0.005} {...g} />
          ))}
        </group>
      );
      break;
    }
    case 'pouf':
      body = <Part w={w} h={h} d={d} y={h / 2} radius={Math.min(w, d, h) * 0.45} color={c} roughness={0.95} {...g}>{edges}</Part>;
      break;
    case 'crib': {
      const post = 0.05, rail = 0.035, baseY = h * 0.4;
      const along = (len: number) => Math.max(3, Math.round(len / 0.13));
      const nz = along(d), nx = along(w);
      body = (
        <group>
          {SIGNS.map(([sx, sz], i) => (
            <Part key={i} w={post} h={h} d={post} x={sx * (w / 2 - post / 2)} y={h / 2} z={sz * (d / 2 - post / 2)} color={c} radius={0.008} {...g} />
          ))}
          <Part w={w - post * 2} h={0.1} d={d - post * 2} y={baseY} color={mix(c, '#ffffff', 0.5)} roughness={0.9} radius={0.02} {...g}>{edges}</Part>
          {/* Slats: enough to read as a rail from across the room, not one per real bar. */}
          {[-1, 1].map((s) => (
            <group key={`z${s}`}>
              <Part w={rail} h={rail} d={d} x={s * (w / 2 - post / 2)} y={h - rail / 2} color={c} radius={0.006} {...g} />
              {Array.from({ length: nz }, (_, i) => (
                <Part key={i} w={0.018} h={h - baseY - 0.1} d={0.018} x={s * (w / 2 - post / 2)} y={baseY + 0.05 + (h - baseY - 0.1) / 2} z={-d / 2 + post + ((i + 0.5) * (d - post * 2)) / nz} color={c} radius={0.005} {...g} />
              ))}
            </group>
          ))}
          {[-1, 1].map((s) => (
            <group key={`x${s}`}>
              <Part w={w} h={rail} d={rail} y={h - rail / 2} z={s * (d / 2 - post / 2)} color={c} radius={0.006} {...g} />
              {Array.from({ length: nx }, (_, i) => (
                <Part key={i} w={0.018} h={h - baseY - 0.1} d={0.018} x={-w / 2 + post + ((i + 0.5) * (w - post * 2)) / nx} y={baseY + 0.05 + (h - baseY - 0.1) / 2} z={s * (d / 2 - post / 2)} color={c} radius={0.005} {...g} />
              ))}
            </group>
          ))}
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
      ref={root}
      position={[item.x * M, 0, item.y * M]}
      rotation={[0, (-item.rotation * Math.PI) / 180, 0]}
      onClick={interactive ? (e) => { e.stopPropagation(); onSelect(item.id); } : undefined}
    >
      <group position={[0, mountY, 0]}>{body}</group>
      {selected && interactive && (
        <Html center distanceFactor={6} position={[0, mountY + h + 0.3, 0]} pointerEvents="none" zIndexRange={[30, 0]}>
          <div className="whitespace-nowrap rounded-full bg-neutral-900/85 px-2 py-0.5 text-[11px] font-medium text-white shadow ring-1 ring-emerald-400/60">
            {cat.name}
          </div>
        </Html>
      )}
    </group>
  );
}
