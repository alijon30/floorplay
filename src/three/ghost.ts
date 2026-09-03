// src/three/ghost.ts
import * as THREE from 'three';

/**
 * The two colours the interface uses to speak over the top of a room, rather than to furnish it.
 *
 * A ghost is a piece the agent is proposing and a removal is one it wants gone; neither is a
 * finish anybody chose, so both are painted in the accent and warning colours from `index.css`
 * instead of in oak or linen. Keep these in step with `--accent` and `--bad` there.
 */
export const GHOST_BLUE = '#7c9cff';
export const REMOVAL_RED = '#e5655d';

const cache = new Map<string, THREE.MeshStandardMaterial>();

/**
 * The translucent material a proposed or doomed piece wears, shared across every mesh that wears
 * it. Both the procedural shapes and the loaded models paint themselves with this, which is what
 * makes a proposed sofa read the same whichever of the two drew it.
 */
export function ghostMaterial(removal: boolean, side: THREE.Side = THREE.FrontSide): THREE.MeshStandardMaterial {
  const key = `${removal ? 'removal' : 'ghost'}|${side}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const m = new THREE.MeshStandardMaterial({
    color: removal ? REMOVAL_RED : GHOST_BLUE,
    transparent: true,
    opacity: removal ? 0.32 : 0.38,
    roughness: 0.5,
    side,
  });
  cache.set(key, m);
  return m;
}
