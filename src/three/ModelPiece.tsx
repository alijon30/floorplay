// src/three/ModelPiece.tsx
/**
 * Drawing one catalog item from a photographed model instead of from boxes.
 *
 * The model arrives as somebody's scan of a real object: its own size, its own orientation, its
 * own baked-in wear. Everything here is about getting that object to answer to the catalog —
 * standing on the floor, facing the room, filling the footprint the plan drew for it, and going
 * translucent when the piece is a proposal rather than a fact. Which items get a model at all,
 * and how each is fitted, is decided in `models.ts`.
 *
 * Nothing here can stop the room rendering. The file may be missing, the decoder may fail, the
 * network may be down: the piece falls back to the procedural shape and the room carries on.
 */
import { Component, Suspense, useMemo, type ReactNode } from 'react';
import * as THREE from 'three';
import { Edges, useGLTF } from '@react-three/drei';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { CatalogItem } from '../engine/types';
import { fitScale, modelFor, type ModelSpec } from './models';
import { GHOST_BLUE, ghostMaterial } from './ghost';
import { M } from './units';

/**
 * Where a model sits and how big it is, measured once per file.
 *
 * drei hands back the same scene object for every item that shares a model, so this is measured
 * on the first one and read from the map by the rest. `yaw` is folded in here rather than at
 * render time, because the box that matters is the one after the piece has been turned to face
 * the room.
 */
const boxes = new Map<string, { size: THREE.Vector3; center: THREE.Vector3; floor: number }>();

function measure(scene: THREE.Object3D, spec: ModelSpec) {
  const key = `${spec.file}|${spec.yaw ?? 0}`;
  const hit = boxes.get(key);
  if (hit) return hit;
  const box = new THREE.Box3().setFromObject(scene);
  if (spec.yaw) box.applyMatrix4(new THREE.Matrix4().makeRotationY((spec.yaw * Math.PI) / 180));
  const out = {
    size: box.getSize(new THREE.Vector3()),
    center: box.getCenter(new THREE.Vector3()),
    floor: box.min.y,
  };
  boxes.set(key, out);
  return out;
}

/*
 * Tinted materials, keyed by the material they came from and the colour asked for.
 *
 * A recoloured piece needs its own material, but four navy dining chairs need one between them,
 * and cloning per mesh would hand the GPU four copies of the same shader and the same textures.
 * The clone keeps the model's maps, so a walnut tinted sage is still walnut *grain*.
 */
const tinted = new Map<string, THREE.Material>();

/** A material with the item's finish multiplied through it, or the original where that would lie. */
function skinned(mat: THREE.Material, color: string | undefined, ghost: boolean, removal: boolean): THREE.Material {
  if (ghost || removal) return ghostMaterial(removal, mat.side);
  if (!color) return mat;
  const std = mat as THREE.MeshStandardMaterial;
  if (!std.color) return mat;
  // Metal and glass answer to the room they stand in rather than to a swatch: a brass handle
  // multiplied by sage is neither brass nor sage, and a tinted window is a stain, not a finish.
  // Everything else takes the colour, exactly as the procedural shapes do — someone who recolours
  // a piece has to see it change, whichever of the two drew it.
  //
  // The map test is the whole test. glTF defaults `metallicFactor` to 1 and leaves the real value
  // to the texture, so every one of these models reads as solid metal by that number alone: the
  // factor only means what it says when there is no map behind it.
  if (!std.metalnessMap && typeof std.metalness === 'number' && std.metalness > 0.5) return mat;
  if (mat.transparent) return mat;

  const key = `${mat.uuid}|${color}`;
  const hit = tinted.get(key);
  if (hit) return hit;
  const next = std.clone();
  next.color = std.color.clone().multiply(new THREE.Color(color));
  tinted.set(key, next);
  return next;
}

/** Paint the clone and let every mesh in it take part in the room's light. */
function skin(root: THREE.Object3D, color: string | undefined, ghost: boolean, removal: boolean): void {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    // A proposal that cast a shadow would look decided; it is a suggestion until it is accepted.
    mesh.castShadow = !ghost;
    mesh.receiveShadow = true;
    mesh.material = Array.isArray(mesh.material)
      ? mesh.material.map((one) => skinned(one, color, ghost, removal))
      : skinned(mesh.material, color, ghost, removal);
  });
}

/**
 * A clone of the model, scaled and stood on the floor in the item's own frame.
 *
 * The item's group is already at the item's position and rotation, so this only has to put the
 * model's box where the catalog says the item's box is: centred on the origin in plan, its
 * underside at y = 0, its front at +z.
 */
function build(scene: THREE.Object3D, spec: ModelSpec, cat: CatalogItem, color: string | undefined, ghost: boolean, removal: boolean): THREE.Group {
  const { size, center, floor } = measure(scene, spec);
  const [sx, sy, sz] = fitScale(
    { w: size.x, d: size.z, h: size.y },
    { w: cat.width * M, d: cat.depth * M, h: cat.height * M },
    spec.fit,
  );
  const inner = cloneSkinned(scene);
  inner.rotation.y = ((spec.yaw ?? 0) * Math.PI) / 180;
  skin(inner, color, ghost, removal);

  const group = new THREE.Group();
  group.scale.set(sx, sy, sz);
  group.position.set(-center.x * sx, -floor * sy, -center.z * sz);
  group.add(inner);
  return group;
}

type PieceProps = {
  spec: ModelSpec;
  cat: CatalogItem;
  /** The placement's colour override, if it has one. Without it the model keeps its own look. */
  color?: string;
  ghost?: boolean;
  removal?: boolean;
};

function Piece({ spec, cat, color, ghost, removal }: PieceProps) {
  const { scene } = useGLTF(spec.file, false, true);
  const object = useMemo(
    () => build(scene, spec, cat, color, !!ghost, !!removal),
    [scene, spec, cat, color, ghost, removal],
  );
  // `dispose={null}`: the clone shares its geometry and its untinted materials with drei's cached
  // scene, so freeing them when one sofa unmounts would empty every other sofa in the room.
  return <primitive object={object} dispose={null} />;
}

/**
 * The selection silhouette: the catalog's own box, which is also the rectangle the plan drew.
 *
 * Every fit mode either matches that box or shrinks to sit inside it, so an outline drawn on the
 * catalog's numbers always contains what is drawn, and the plan and the 3D view agree about where
 * the piece is and how much room it takes.
 */
function Outline({ cat }: { cat: CatalogItem }) {
  const w = cat.width * M, h = cat.height * M, d = cat.depth * M;
  return (
    <mesh position={[0, h / 2, 0]} raycast={() => null}>
      <boxGeometry args={[w, h, d]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      <Edges color={GHOST_BLUE} lineWidth={2} />
    </mesh>
  );
}

/**
 * The last line of defence: a model that throws hands the room back its procedural shape.
 *
 * `useGLTF` suspends while it fetches and throws when it cannot — a missing file, a decoder that
 * would not start, a corrupt buffer. Suspense covers the first case and this covers the second,
 * so no failure in a decorative asset can take down the canvas.
 */
class Fallback extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: unknown) {
    console.warn('[floorplay] falling back to the procedural shape:', error);
  }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

export type ModelBodyProps = PieceProps & {
  /** Drawn while the model is in flight, and for good if it never arrives. */
  procedural: ReactNode;
  outlined?: boolean;
};

export default function ModelBody({ procedural, outlined, ...piece }: ModelBodyProps) {
  return (
    <Fallback fallback={procedural}>
      <Suspense fallback={procedural}>
        <Piece {...piece} />
      </Suspense>
      {outlined ? <Outline cat={piece.cat} /> : null}
    </Fallback>
  );
}

/**
 * Start fetching the models a set of items will ask for.
 *
 * Without this each model is requested by the piece that needs it, at the moment it first
 * renders, which staggers a room's worth of downloads across several frames of pop-in. Called
 * with the room's catalog entries, it asks for all of them at once and lets drei's cache hand
 * the same scene to every item that shares a model.
 */
export function preloadModels(cats: CatalogItem[]): void {
  const seen = new Set<string>();
  for (const cat of cats) {
    const spec = modelFor(cat);
    if (!spec || seen.has(spec.file)) continue;
    seen.add(spec.file);
    useGLTF.preload(spec.file, false, true);
  }
}
