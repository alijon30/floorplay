// src/three/Furniture.tsx
import { useRef, type ReactElement, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Edges, Html, RoundedBox } from '@react-three/drei';
import type { CatalogItem, PlacedItem, Wall } from '../engine/types';
import { isMounted, itemColor } from '../engine/catalog';
import { finish, materialTypeOf, type MaterialType } from '../engine/materials';
import { footprint } from '../engine/geometry';
import { makeFabricTexture, makeWoodTexture } from './textures';
import { GHOST_BLUE, ghostMaterial } from './ghost';
import ModelBody from './ModelPiece';
import { modelFor } from './models';
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

/** Rough perceived lightness, 0 to 1: enough to choose a worktop that contrasts with its units. */
function lightness(hex: string): number {
  const c = scratch.set(hex);
  return 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
}

// The finishes the shapes below reach for directly: hardware, frames, upholstery liners.
const WALNUT = finish('walnut');
const BLACK_STAIN = finish('black-stain');
const WHITE_OAK = finish('white-oak');
const LINEN = finish('linen');
const BRASS = finish('brass');
const STEEL = finish('steel');
const BLACK_METAL = finish('black-metal');
const CONCRETE = finish('concrete');
const TERRACOTTA_POT = '#a9694c';
const CUSHION_WHITE = '#faf7f2';

/**
 * How each material behaves under the studio lights.
 *
 * This is the whole point of naming finishes rather than picking hexes: oak and brass can be
 * the same lightness on screen and still have to answer light completely differently, and a
 * room only reads as furnished when they do.
 */
const PROFILE: Record<MaterialType, { roughness: number; metalness: number }> = {
  wood: { roughness: 0.55, metalness: 0 },
  fabric: { roughness: 0.95, metalness: 0 },
  metal: { roughness: 0.35, metalness: 0.85 },
  surface: { roughness: 0.7, metalness: 0 },
  leaf: { roughness: 0.8, metalness: 0 },
};

type MatProps = G & {
  color: string;
  /** Force the material rather than deriving it from the colour: a stone pot, a linen shade. */
  mat?: MaterialType;
  roughness?: number;
  metalness?: number;
  emissive?: string;
  emissiveIntensity?: number;
  side?: THREE.Side;
  /** Skip the grain or weave map: glass, screens and mirrors are the smoothest things here. */
  flat?: boolean;
};

/*
 * One material object per distinct finish, shared by every mesh that wears it.
 *
 * A furnished room is several hundred meshes and most of them are one of a dozen finishes, so
 * building a material per mesh would compile the same shader over and over and hand the GPU a
 * hundred copies of the same uniforms. Keying the cache on everything that can differ means a
 * whole wall of oak drawer fronts is one material and one texture upload.
 */
const materials = new Map<string, THREE.MeshStandardMaterial>();

function materialFor(spec: MatProps): THREE.MeshStandardMaterial {
  const side = spec.side ?? THREE.FrontSide;
  if (spec.removal || spec.ghost) return ghostMaterial(!!spec.removal, side);
  const type = spec.mat ?? materialTypeOf(spec.color);
  const p = PROFILE[type];
  const roughness = spec.roughness ?? p.roughness;
  const metalness = spec.metalness ?? p.metalness;
  const emissive = spec.emissive ?? '#000000';
  const emissiveIntensity = spec.emissiveIntensity ?? 1;
  const key = `${spec.color}|${type}|${roughness}|${metalness}|${emissive}|${emissiveIntensity}|${side}|${spec.flat ? 1 : 0}`;
  const hit = materials.get(key);
  if (hit) return hit;
  const map = spec.flat ? null
    : type === 'wood' ? makeWoodTexture(spec.color)
      : type === 'fabric' ? makeFabricTexture(spec.color) : null;
  const m = new THREE.MeshStandardMaterial({
    // The map is already drawn in the finish's own colour, so tinting it again would darken it.
    color: map ? '#ffffff' : spec.color,
    map,
    roughness,
    metalness,
    emissive,
    emissiveIntensity,
    side,
  });
  materials.set(key, m);
  return m;
}

/** `dispose={null}`: the cache owns these, so unmounting one sofa must not free every sofa's material. */
function Mat(props: MatProps) {
  return <primitive object={materialFor(props)} attach="material" dispose={null} />;
}

type PartProps = MatProps & {
  w: number; h: number; d: number;
  x?: number; y: number; z?: number;
  radius?: number;
  rot?: [number, number, number];
  children?: ReactNode;
};

/**
 * One rounded slab. The radius is clamped to the part, and very thin parts (shelf boards,
 * rugs, screens) fall back to a plain box because an extrude bevel wider than the part
 * itself produces inverted geometry.
 */
function Part({ w, h, d, x = 0, y, z = 0, radius = 0.02, rot, children, ...m }: PartProps) {
  const r = Math.min(radius, Math.min(w, h, d) * 0.45);
  const mat = <Mat {...m} />;
  if (r < 0.004) {
    return (
      <mesh position={[x, y, z]} rotation={rot} castShadow={!m.ghost} receiveShadow>
        <boxGeometry args={[w, h, d]} />
        {mat}
        {children}
      </mesh>
    );
  }
  return (
    <RoundedBox args={[w, h, d]} radius={r} smoothness={4} bevelSegments={2} position={[x, y, z]} rotation={rot} castShadow={!m.ghost} receiveShadow>
      {mat}
      {children}
    </RoundedBox>
  );
}

/** A turned leg: wider where it meets the frame, narrower on the floor. */
function Leg({ x, z, h, top, bottom, ...m }: MatProps & { x: number; z: number; h: number; top: number; bottom: number }) {
  return (
    <mesh position={[x, h / 2, z]} castShadow={!m.ghost} receiveShadow>
      <cylinderGeometry args={[top, bottom, h, 10]} />
      <Mat {...m} />
    </mesh>
  );
}

const SIGNS: [number, number][] = [[-1, -1], [1, -1], [-1, 1], [1, 1]];

/** Muted two-tone prints, so a gallery wall is not four copies of one picture. */
const PRINTS: [string, string][] = [
  ['#c7cec4', '#b8674a'],
  ['#d8d0c2', '#2f3d5c'],
  ['#d9b8ad', '#3f5d4a'],
  ['#c9a544', '#9a9a94'],
];

/** Deterministic index from an id, so a picture keeps its print across reloads. */
function pick<T>(list: T[], id: string): T {
  let n = 0;
  for (let i = 0; i < id.length; i++) n = (n * 31 + id.charCodeAt(i)) >>> 0;
  return list[n % list.length]!;
}

export default function Furniture({ item, cat, ghost, removal, selected, onSelect, roomW, roomD }: Props) {
  const w = cat.width * M, d = cat.depth * M, h = cat.height * M;
  const c = itemColor(cat, item.color);
  // A wall-mounted piece is built from its own bottom up, exactly like a floor-standing one,
  // and then lifted whole: the mount height is the only thing that differs.
  const mounted = isMounted(cat);
  const mountY = (item.mountHeight ?? cat.mountHeight ?? 0) * M;

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
  const edges = selected && interactive ? <Edges color={GHOST_BLUE} lineWidth={2} /> : null;

  let body: ReactElement;
  switch (cat.shape) {
    case 'bed': {
      const frameH = h * 0.42, matH = h * 0.58, top = frameH + matH;
      const headTop = top + 0.36, headBottom = h * 0.12;
      // The duvet covers the foot two thirds and stops in a turned-back fold, which is what
      // separates a made bed from a slab of foam with a sheet painted on it.
      const duvetD = d * 0.6, duvetZ = d / 2 - duvetD / 2 - 0.02;
      const foldZ = duvetZ - duvetD / 2 - 0.05;
      body = (
        <group>
          {/* The mattress is inset, so the timber rail shows all the way round it. Without
              that border a made bed in a pale linen is one undivided white mass. */}
          <Part w={w} h={frameH} d={d} y={frameH / 2} color={WALNUT} radius={0.012} {...g} />
          <Part w={w - 0.06} h={matH} d={d - 0.06} y={frameH + matH / 2} color={CUSHION_WHITE} mat="fabric" radius={0.04} {...g}>{edges}</Part>
          <Part w={w + 0.06} h={headTop - headBottom} d={0.08} y={(headTop + headBottom) / 2} z={-d / 2 - 0.04} color={c} mat="fabric" radius={0.03} {...g} />
          <Part w={w - 0.14} h={0.08} d={duvetD} y={top + 0.03} z={duvetZ} color={mix(c, '#ffffff', 0.08)} mat="fabric" radius={0.03} {...g} />
          <Part w={w - 0.14} h={0.055} d={0.13} y={top + 0.055} z={foldZ} color={mix(c, '#ffffff', 0.55)} mat="fabric" radius={0.026} {...g} />
          {[-1, 1].map((s) => (
            <Part key={s} w={w * 0.4} h={0.12} d={0.34} x={s * w * 0.22} y={top + 0.06} z={-d / 2 + 0.3} rot={[-0.12, 0, 0]} color={CUSHION_WHITE} mat="fabric" radius={0.055} {...g} />
          ))}
        </group>
      );
      break;
    }
    case 'sofa': {
      const legH = 0.1, seatH = h * 0.26, seatTop = legH + seatH, armT = 0.15;
      const inner = Math.max(0.2, w - armT * 2);
      const n = Math.max(1, Math.round(inner / 0.72));
      const gap = 0.01;
      const cw = inner / n - gap;
      const backH = h - seatTop - 0.05;
      body = (
        <group>
          {SIGNS.map(([sx, sz], i) => (
            <Leg key={i} x={sx * (w / 2 - 0.1)} z={sz * (d / 2 - 0.1)} h={legH} top={0.02} bottom={0.015} color={WALNUT} {...g} />
          ))}
          <Part w={w} h={seatH} d={d} y={legH + seatH / 2} color={c} radius={0.03} {...g}>{edges}</Part>
          <Part w={w} h={h - legH} d={0.17} y={legH + (h - legH) / 2} z={-d / 2 + 0.085} color={c} radius={0.04} {...g} />
          {Array.from({ length: n }, (_, i) => {
            const x = -inner / 2 + (i + 0.5) * (inner / n);
            return (
              <group key={i}>
                <Part w={cw} h={0.13} d={d - 0.26} x={x} y={seatTop + 0.055} z={0.04} color={mix(c, '#ffffff', 0.1)} radius={0.045} {...g} />
                {/* Tipped back a little, the way a cushion actually leans into the frame. */}
                <Part
                  w={cw} h={backH} d={0.13} x={x} y={seatTop + 0.04 + backH / 2} z={-d / 2 + 0.23}
                  rot={[0.13, 0, 0]} color={mix(c, '#ffffff', 0.16)} radius={0.045} {...g}
                />
              </group>
            );
          })}
          {[-1, 1].map((s) => (
            <Part key={s} w={armT} h={h * 0.7 - legH} d={d} x={s * (w / 2 - armT / 2)} y={legH + (h * 0.7 - legH) / 2} color={mix(c, '#000000', 0.05)} radius={0.07} {...g} />
          ))}
        </group>
      );
      break;
    }
    case 'desk':
    case 'table': {
      const top = 0.03;
      const legH = h - top;
      const legWood = lightness(c) > 0.6 ? mix(c, '#000000', 0.12) : c;
      body = (
        <group>
          {/* A 3 cm top with a real bevel: the edge is where a table stops looking like a plane. */}
          <Part w={w} h={top} d={d} y={h - top / 2} color={c} radius={0.008} {...g}>{edges}</Part>
          {SIGNS.map(([sx, sz], i) => (
            <Leg key={i} x={sx * (w / 2 - 0.07)} z={sz * (d / 2 - 0.07)} h={legH} top={0.022} bottom={0.015} color={legWood} {...g} />
          ))}
        </group>
      );
      break;
    }
    case 'chair': {
      const seatY = h * 0.45, legH = seatY - 0.03;
      const backH = h * 0.44;
      const backY = seatY + 0.03 + backH / 2;
      const legWood = lightness(c) > 0.6 ? mix(c, '#000000', 0.15) : c;
      body = (
        <group>
          <Part w={w} h={0.05} d={d} y={seatY} color={c} radius={0.016} {...g}>{edges}</Part>
          {/* Two panels leaning at slightly different angles read as one curved backrest. */}
          <Part w={w * 0.96} h={backH * 0.55} d={0.028} y={backY - backH * 0.22} z={-d / 2 + 0.045} rot={[0.1, 0, 0]} color={c} radius={0.012} {...g} />
          <Part w={w * 0.96} h={backH * 0.52} d={0.028} y={backY + backH * 0.24} z={-d / 2 + 0.075} rot={[0.24, 0, 0]} color={c} radius={0.012} {...g} />
          {SIGNS.map(([sx, sz], i) => (
            <Leg key={i} x={sx * (w / 2 - 0.05)} z={sz * (d / 2 - 0.05)} h={legH} top={0.017} bottom={0.012} color={legWood} {...g} />
          ))}
        </group>
      );
      break;
    }
    case 'wardrobe': {
      const plinth = 0.04;
      const carcassH = h - plinth;
      const doorH = carcassH - 0.05;
      const doorW = w / 2 - 0.0055; // a 3 mm shadow gap down the middle and at each end
      body = (
        <group>
          <Part w={w - 0.05} h={plinth} d={d - 0.04} y={plinth / 2} color={BLACK_STAIN} radius={0.006} {...g} />
          <Part w={w} h={carcassH} d={d} y={plinth + carcassH / 2} color={c} {...g}>{edges}</Part>
          {[-1, 1].map((s) => (
            <group key={s}>
              <Part w={doorW} h={doorH} d={0.02} x={s * (w / 4)} y={plinth + carcassH / 2} z={d / 2 + 0.006} color={mix(c, '#000000', 0.05)} radius={0.006} {...g} />
              <Part w={0.014} h={0.16} d={0.014} x={s * 0.035} y={plinth + carcassH * 0.5} z={d / 2 + 0.028} color={BRASS} radius={0.006} {...g} />
            </group>
          ))}
        </group>
      );
      break;
    }
    case 'shelf': {
      const n = Math.max(2, Math.round(h / 0.4));
      const slab = 0.018;
      body = (
        <group>
          <Part w={w} h={h} d={0.016} y={h / 2} z={-d / 2 + 0.008} color={mix(c, '#000000', 0.1)} {...g}>{edges}</Part>
          {[-1, 1].map((s) => (
            <Part key={s} w={slab} h={h} d={d} x={s * (w / 2 - slab / 2)} y={h / 2} color={c} radius={0.005} {...g} />
          ))}
          {Array.from({ length: n + 1 }, (_, i) => (
            <Part key={i} w={w - slab * 2} h={slab} d={d - 0.018} y={slab / 2 + (i * (h - slab)) / n} z={0.009} color={c} radius={0.005} {...g} />
          ))}
        </group>
      );
      break;
    }
    case 'rug':
      // A centimetre of pile, with the weave the fabric map gives it. It stays under the
      // contact-shadow plane, so a sofa standing on a rug still grounds itself on the rug.
      body = <Part w={w} h={0.01} d={d} y={0.005} color={c} mat="fabric" {...g}>{edges}</Part>;
      break;
    case 'lamp': {
      // The catalog colour names the metalwork; every shade is the same warm linen, because
      // what a lamp contributes to a room is its light, not its cloth.
      const shade = <Mat color={LINEN} mat="fabric" emissive="#ffe7c4" emissiveIntensity={0.85} side={THREE.DoubleSide} {...g} />;
      if (mounted) {
        const shadeH = Math.min(h, 0.24);
        body = (
          <group>
            <mesh position={[0, h + 0.3, 0]}>
              <cylinderGeometry args={[0.005, 0.005, 0.6, 6]} />
              <Mat color={c} {...g} />
            </mesh>
            <mesh position={[0, shadeH / 2, 0]}>
              <cylinderGeometry args={[w * 0.16, w * 0.5, shadeH, 24, 1, true]} />
              {shade}
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
            <cylinderGeometry args={[w * 0.3, w * 0.34, 0.024, 20]} />
            <Mat color={c} {...g} />
          </mesh>
          <mesh position={[0, (h - shadeH) / 2, 0]} castShadow={!ghost}>
            <cylinderGeometry args={[0.011, 0.014, h - shadeH, 12]} />
            <Mat color={c} {...g} />
          </mesh>
          <mesh position={[0, shadeY, 0]}>
            <cylinderGeometry args={[w * 0.34, w * 0.48, shadeH, 24, 1, true]} />
            {shade}
            {edges}
          </mesh>
          {!ghost && !removal && <pointLight position={[0, shadeY - 0.04, 0]} intensity={0.55} color="#ffd9a0" distance={3.2} decay={2} />}
        </group>
      );
      break;
    }
    case 'plant': {
      const potH = h * 0.24, potR = w * 0.32;
      const pot = pick([TERRACOTTA_POT, CONCRETE, TERRACOTTA_POT], cat.id);
      const canopy = h - potH;
      const dark = mix(c, '#000000', 0.28);
      // Five to seven flattened blades fanned round the stem: a palm, not a snowman.
      const blades = 5 + (cat.width > 45 ? 2 : 0);
      body = (
        <group>
          <mesh position={[0, potH / 2, 0]} castShadow={!ghost} receiveShadow>
            <cylinderGeometry args={[potR, potR * 0.8, potH, 20]} />
            <Mat color={pot} mat="surface" {...g} />
            {edges}
          </mesh>
          <mesh position={[0, potH - 0.008, 0]}>
            <cylinderGeometry args={[potR * 0.94, potR * 0.94, 0.02, 20]} />
            <Mat color="#3b2f26" mat="surface" {...g} />
          </mesh>
          <mesh position={[0, potH + canopy * 0.34, 0]} castShadow={!ghost}>
            <cylinderGeometry args={[0.012, 0.02, canopy * 0.7, 8]} />
            <Mat color={dark} {...g} />
          </mesh>
          {Array.from({ length: blades }, (_, i) => {
            const a = (i / blades) * Math.PI * 2 + 0.4;
            const lean = 0.5 + (i % 2) * 0.28;
            const len = w * (0.52 + 0.14 * ((i * 7) % 3));
            const y = potH + canopy * (0.6 + 0.12 * ((i * 5) % 3));
            return (
              <mesh
                key={i}
                position={[Math.cos(a) * len * 0.55, y, Math.sin(a) * len * 0.55]}
                rotation={[0, -a, lean]}
                scale={[len, len * 0.1, len * 0.42]}
                castShadow={!ghost}
              >
                <sphereGeometry args={[0.5, 12, 8]} />
                <Mat color={i % 2 === 0 ? c : dark} {...g} />
              </mesh>
            );
          })}
        </group>
      );
      break;
    }
    case 'tv': {
      const screen = <Mat color="#0a0e16" flat roughness={0.06} metalness={0.55} emissive="#0d1626" emissiveIntensity={0.5} {...g} />;
      if (mounted) {
        // A wall TV is the panel and nothing else: no stand, no cabinet under it.
        body = (
          <group>
            <Part w={w} h={h} d={d} y={h / 2} color={BLACK_METAL} radius={0.006} {...g}>{edges}</Part>
            <mesh position={[0, h / 2, d / 2 + 0.005]} castShadow={false} receiveShadow>
              <boxGeometry args={[w - 0.04, h - 0.04, 0.006]} />
              {screen}
            </mesh>
          </group>
        );
        break;
      }
      const panelH = w * 0.5, panelY = h + 0.1 + panelH / 2;
      body = (
        <group>
          <Part w={w} h={h} d={d} y={h / 2} color={c} {...g}>{edges}</Part>
          {Array.from({ length: 2 }, (_, i) => (
            <Part key={i} w={w / 2 - 0.02} h={h - 0.06} d={0.016} x={(i - 0.5) * (w / 2)} y={h / 2} z={d / 2 + 0.005} color={mix(c, '#000000', 0.15)} radius={0.005} {...g} />
          ))}
          <Part w={0.09} h={0.1} d={0.06} y={h + 0.05} z={-d / 2 + 0.09} color={BLACK_METAL} {...g} />
          <Part w={w * 0.86} h={panelH} d={0.026} y={panelY} z={-d / 2 + 0.08} color={BLACK_METAL} radius={0.008} {...g} />
          <mesh position={[0, panelY, -d / 2 + 0.096]} receiveShadow>
            <boxGeometry args={[w * 0.82, panelH - 0.035, 0.006]} />
            {screen}
          </mesh>
        </group>
      );
      break;
    }
    case 'counter': {
      const topH = 0.04, plinth = 0.08;
      const bodyH = h - topH - plinth;
      const doors = Math.max(1, Math.round(w / 0.6));
      // Dark units take a warm timber worktop, pale ones a stone. Either way the top is a
      // different material from the doors, which is what a fitted kitchen actually looks like.
      const worktop = lightness(c) < 0.35 ? WHITE_OAK : CONCRETE;
      body = (
        <group>
          <Part w={w - 0.08} h={plinth} d={d - 0.08} y={plinth / 2} color={BLACK_STAIN} {...g} />
          <Part w={w} h={bodyH} d={d} y={plinth + bodyH / 2} color={c} {...g}>{edges}</Part>
          {Array.from({ length: doors }, (_, i) => (
            <group key={i}>
              <Part
                w={w / doors - 0.012} h={bodyH - 0.03} d={0.016}
                x={-w / 2 + (i + 0.5) * (w / doors)} y={plinth + bodyH / 2} z={d / 2 + 0.005}
                color={mix(c, '#000000', 0.05)} radius={0.005} {...g}
              />
              <Part
                w={Math.min(0.18, w / doors - 0.1)} h={0.012} d={0.014}
                x={-w / 2 + (i + 0.5) * (w / doors)} y={plinth + bodyH - 0.06} z={d / 2 + 0.022}
                color={BRASS} radius={0.005} {...g}
              />
            </group>
          ))}
          {/* A 2 cm overhang all round is what makes a run of units read as one counter. */}
          <Part w={w + 0.04} h={topH} d={d + 0.04} y={h - topH / 2} color={worktop} radius={0.006} {...g} />
        </group>
      );
      break;
    }
    case 'appliance': {
      body = (
        <group>
          <Part w={w} h={h} d={d} y={h / 2} color={c} {...g}>{edges}</Part>
          <Part w={w - 0.03} h={h - 0.04} d={0.02} y={h / 2} z={d / 2 + 0.005} color={mix(c, '#000000', 0.12)} radius={0.006} {...g} />
          {/* One horizontal bar across the door: the handle every white good has. */}
          <Part w={w - 0.14} h={0.022} d={0.034} y={h - Math.min(0.12, h * 0.18)} z={d / 2 + 0.03} color={STEEL} radius={0.009} {...g} />
        </group>
      );
      break;
    }
    case 'stool': {
      const seatH = 0.05, r = Math.max(0.1, w * 0.45);
      const metal = lightness(c) > 0.6 ? BLACK_METAL : c;
      body = (
        <group>
          <mesh position={[0, 0.015, 0]} castShadow={!ghost} receiveShadow>
            <cylinderGeometry args={[r * 0.78, r * 0.86, 0.03, 20]} />
            <Mat color={metal} {...g} />
          </mesh>
          <mesh position={[0, (h - seatH) / 2, 0]} castShadow={!ghost}>
            <cylinderGeometry args={[0.022, 0.03, h - seatH, 12]} />
            <Mat color={metal} {...g} />
          </mesh>
          {h > 0.6 && (
            <mesh position={[0, h * 0.28, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow={!ghost}>
              <torusGeometry args={[r * 0.7, 0.012, 8, 24]} />
              <Mat color={BRASS} {...g} />
            </mesh>
          )}
          <mesh position={[0, h - seatH / 2, 0]} castShadow={!ghost} receiveShadow>
            <cylinderGeometry args={[r, r * 0.96, seatH, 24]} />
            <Mat color={c} {...g} />
            {edges}
          </mesh>
        </group>
      );
      break;
    }
    case 'bench': {
      const seatH = 0.05, legH = h - seatH;
      const legWood = lightness(c) > 0.6 ? mix(c, '#000000', 0.18) : c;
      body = (
        <group>
          <Part w={w} h={seatH} d={d} y={h - seatH / 2} color={c} radius={0.01} {...g}>{edges}</Part>
          {SIGNS.map(([sx, sz], i) => (
            <Leg key={i} x={sx * (w / 2 - 0.07)} z={sz * (d / 2 - 0.06)} h={legH} top={0.022} bottom={0.016} color={legWood} {...g} />
          ))}
        </group>
      );
      break;
    }
    case 'picture':
    case 'mirror': {
      const face = cat.shape === 'mirror';
      // The frame is four rails around an opening, not a solid slab: a print sunk inside a
      // solid box is a print nobody can see.
      const frameT = Math.max(0.02, Math.min(w, h) * 0.08);
      const openW = Math.max(0.02, w - frameT * 2), openH = Math.max(0.02, h - frameT * 2);
      const [skyTone, earthTone] = pick(PRINTS, cat.id);
      const printW = openW * 0.86, printH = openH * 0.86;
      body = (
        <group>
          <Part w={w} h={h} d={d * 0.22} y={h / 2} z={-d * 0.39} color={mix(c, '#000000', 0.3)} {...g}>{edges}</Part>
          {[[0, h - frameT / 2, w, frameT], [0, frameT / 2, w, frameT],
            [-(w - frameT) / 2, h / 2, frameT, openH], [(w - frameT) / 2, h / 2, frameT, openH]].map(([x, y, rw, rh], i) => (
            <Part key={i} w={rw!} h={rh!} d={d} x={x} y={y!} color={c} radius={0.004} {...g} />
          ))}
          {face ? (
            // A metallic pane needs an environment to reflect; the studio probe gives it one,
            // and the faint self-light keeps it from going flat when the room is dim.
            <Part
              w={openW} h={openH} d={d * 0.5} y={h / 2} z={d * 0.1}
              color={mix(STEEL, '#eaf1f6', 0.5)} flat roughness={0.05} metalness={0.45}
              emissive="#9fb8c8" emissiveIntensity={0.12} radius={0.003} {...g}
            />
          ) : (
            <group>
              {/* Mount board recessed inside the rails, then a two-tone print floated on it. */}
              <Part w={openW} h={openH} d={d * 0.45} y={h / 2} z={-d * 0.1} color="#efeae0" mat="surface" radius={0.002} {...g} />
              <Part w={printW} h={printH * 0.58} d={0.005} y={h / 2 + printH * 0.21} z={d * 0.16} color={skyTone} mat="surface" roughness={0.85} radius={0.002} {...g} />
              <Part w={printW} h={printH * 0.42} d={0.005} y={h / 2 - printH * 0.29} z={d * 0.16} color={earthTone} mat="surface" roughness={0.85} radius={0.002} {...g} />
            </group>
          )}
        </group>
      );
      break;
    }
    case 'curtain': {
      const panelW = w * 0.44, t = Math.max(0.02, d * 0.55);
      const folds = 4;
      const foldW = panelW / folds;
      body = (
        <group>
          <mesh position={[0, h - 0.02, -d * 0.1]} rotation={[0, 0, Math.PI / 2]} castShadow={!ghost}>
            <cylinderGeometry args={[0.014, 0.014, w + 0.12, 10]} />
            <Mat color={BLACK_METAL} {...g} />
          </mesh>
          {[-1, 1].map((s) => (
            <group key={s} position={[s * (w / 2 - panelW / 2), 0, 0]}>
              {/* Overlapping vertical folds: a hanging cloth, not a plank of colour. */}
              {Array.from({ length: folds }, (_, i) => {
                const x = -panelW / 2 + (i + 0.5) * foldW;
                const deep = i % 2 === 0;
                return (
                  <Part
                    key={i} w={foldW * 1.35} h={h - 0.04} d={deep ? t : t * 0.62}
                    x={x} y={(h - 0.04) / 2} z={deep ? 0 : t * 0.18}
                    color={deep ? c : mix(c, '#ffffff', 0.12)} mat="fabric" radius={Math.min(0.035, foldW * 0.6)} {...g}
                  >
                    {s === -1 && i === 0 ? edges : null}
                  </Part>
                );
              })}
            </group>
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
                <Part w={0.014} h={0.014} d={d * 0.8} x={x} y={h * 0.6} z={0} color={BRASS} radius={0.006} {...g} />
                <Part w={0.02} h={0.05} d={0.02} x={x} y={h * 0.42} z={d / 2 - 0.01} color={BRASS} radius={0.008} {...g} />
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
          <Part w={w} h={board} d={d} y={h - board / 2} color={c} radius={0.005} {...g}>{edges}</Part>
          {[-1, 1].map((s) => (
            <Part key={s} w={0.018} h={h - board} d={d * 0.75} x={s * (w / 2 - 0.07)} y={(h - board) / 2} z={-d * 0.1} color={BLACK_METAL} radius={0.004} {...g} />
          ))}
        </group>
      );
      break;
    }
    case 'pouf':
      body = <Part w={w} h={h} d={d} y={h / 2} radius={Math.min(w, d, h) * 0.45} color={c} mat="fabric" {...g}>{edges}</Part>;
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
          <Part w={w - post * 2} h={0.1} d={d - post * 2} y={baseY} color={CUSHION_WHITE} mat="fabric" radius={0.02} {...g}>{edges}</Part>
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
              {/* A 1.5 cm reveal round each front, so the carcass shows as a shadow line. */}
              <Part w={w - 0.03} h={dh - 0.015} d={0.018} y={0.03 + dh * (i + 0.5)} z={d / 2 + 0.005} color={mix(c, '#000000', 0.06)} radius={0.006} {...g} />
              <Part w={w * 0.3} h={0.013} d={0.014} y={0.03 + dh * (i + 0.5)} z={d / 2 + 0.021} color={BRASS} radius={0.005} {...g} />
            </group>
          ))}
        </group>
      );
    }
  }

  /*
   * A photographed model stands in for the shape above wherever the catalog entry's proportions
   * are close enough to the model's for the swap to be honest; `modelFor` is what decides that,
   * and returns null for everything else. The procedural body is built either way and handed to
   * `ModelBody` as its fallback, so a model still in flight — or one that never arrives — leaves
   * a fully furnished room rather than a hole in it.
   */
  const model = modelFor(cat);
  const drawn = model
    ? (
      <ModelBody
        spec={model}
        cat={cat}
        color={item.color}
        ghost={ghost}
        removal={removal}
        outlined={selected && interactive}
        procedural={body}
      />
    )
    : body;

  return (
    <group
      ref={root}
      position={[item.x * M, 0, item.y * M]}
      rotation={[0, (-item.rotation * Math.PI) / 180, 0]}
      onClick={interactive ? (e) => { e.stopPropagation(); onSelect(item.id); } : undefined}
    >
      <group position={[0, mountY, 0]}>{drawn}</group>
      {selected && interactive && (
        <Html center distanceFactor={6} position={[0, mountY + h + 0.3, 0]} pointerEvents="none" zIndexRange={[30, 0]}>
          <div className="whitespace-nowrap rounded-full border border-accent/50 bg-panel/90 px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-[0.06em] text-fg shadow-xl">
            {cat.name}
          </div>
        </Html>
      )}
    </group>
  );
}
