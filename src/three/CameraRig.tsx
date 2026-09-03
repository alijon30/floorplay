// src/three/CameraRig.tsx
import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { CameraPose, Rect } from '../engine/types';
import { M } from './units';

const keys = new Set<string>();
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (e) => { if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(e.key.toLowerCase())) keys.add(e.key.toLowerCase()); });
  window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
  // Without this a key held while the window loses focus never sees its keyup and walks forever.
  window.addEventListener('blur', () => keys.clear());
}

/**
 * Where the orbit view stands: outside the top-left corner of the plan, looking back at it.
 *
 * A single room is read from about the height of the wall you are looking in over. A home has
 * walls inside it as well, and at a room's angle the nearest of those hides whatever stands
 * behind it, so a whole plan is looked down on from higher up and a little closer in.
 */
export function orbitPosition(bounds: Rect, dollhouse: boolean): [number, number, number] {
  const cx = (bounds.x + bounds.w / 2) * M, cz = (bounds.y + bounds.h / 2) * M;
  const span = Math.max(bounds.w, bounds.h) * M;
  const [back, lift, side] = dollhouse ? [0.7, 1.05, 0.85] : [0.9, 0.75, 1.1];
  return [cx - span * back, span * lift, cz - span * side];
}

/**
 * The camera over one plan: a single room standing at the origin, or a whole home.
 *
 * `bounds` is the only thing that changes between the two. It is what the orbit view frames
 * and what a walk is kept inside, so in Home view the walker can cross a doorway into the next
 * room instead of being stopped at the wall of the one they started in.
 */
export default function CameraRig({ pose, bounds, dollhouse = false, onLook }: { pose: CameraPose; bounds: Rect; dollhouse?: boolean; onLook: (yaw: number, pitch: number) => void }) {
  const { camera, gl } = useThree();
  const yaw = useRef(pose.yaw);
  const pitch = useRef(pose.pitch);
  const cx = (bounds.x + bounds.w / 2) * M, cz = (bounds.y + bounds.h / 2) * M;
  // How far out the orbit may go is the plan's own diagonal: a home has to be pulled back
  // from further than a room, and pushed into from further out before it clips.
  const diag = Math.hypot(bounds.w, bounds.h) * M;
  // Eye level rather than the floor, so the orbit view frames the furniture.
  const center: [number, number, number] = [cx, 0.8, cz];

  // Position only. Looking around writes yaw/pitch back to the store, so depending on the
  // whole pose here would teleport the walker back to the stored spot on every look-drag.
  useEffect(() => {
    if (pose.mode === 'walk') { camera.position.set(pose.x * M, pose.z * M, pose.y * M); return; }
    // A three-quarter view from outside the top-left corner. Walls turn themselves off
    // once the camera passes outside them, so this can sit low enough to read as a room —
    // and cutting away the top and left walls leaves the door and window walls on screen.
    camera.position.set(...orbitPosition(bounds, dollhouse));
  }, [pose.mode, pose.x, pose.y, pose.z, camera, bounds, dollhouse]);

  useEffect(() => {
    yaw.current = pose.yaw;
    pitch.current = pose.pitch;
  }, [pose.yaw, pose.pitch]);

  useEffect(() => {
    if (pose.mode !== 'walk') return;
    const el = gl.domElement;
    let dragging = false, lx = 0, ly = 0;
    const down = (e: PointerEvent) => { dragging = true; lx = e.clientX; ly = e.clientY; };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      yaw.current = (yaw.current + (e.clientX - lx) * 0.3 + 360) % 360;
      pitch.current = Math.max(-60, Math.min(60, pitch.current - (e.clientY - ly) * 0.3));
      lx = e.clientX; ly = e.clientY;
    };
    const up = () => { if (dragging) onLook(Math.round(yaw.current), Math.round(pitch.current)); dragging = false; };
    el.addEventListener('pointerdown', down); window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
    return () => { el.removeEventListener('pointerdown', down); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
  }, [pose.mode, gl, onLook]);

  useFrame((_, dt) => {
    if (pose.mode !== 'walk') return;
    const y = (yaw.current * Math.PI) / 180, p = (pitch.current * Math.PI) / 180;
    const dir = new THREE.Vector3(Math.sin(y) * Math.cos(p), Math.sin(p), -Math.cos(y) * Math.cos(p));
    const flat = new THREE.Vector3(Math.sin(y), 0, -Math.cos(y));
    const side = new THREE.Vector3(Math.cos(y), 0, Math.sin(y));
    const speed = 1.5 * dt;
    if (keys.has('w') || keys.has('arrowup')) camera.position.addScaledVector(flat, speed);
    if (keys.has('s') || keys.has('arrowdown')) camera.position.addScaledVector(flat, -speed);
    if (keys.has('a') || keys.has('arrowleft')) camera.position.addScaledVector(side, -speed);
    if (keys.has('d') || keys.has('arrowright')) camera.position.addScaledVector(side, speed);
    camera.position.x = Math.min((bounds.x + bounds.w) * M - 0.2, Math.max(bounds.x * M + 0.2, camera.position.x));
    camera.position.z = Math.min((bounds.y + bounds.h) * M - 0.2, Math.max(bounds.y * M + 0.2, camera.position.z));
    camera.lookAt(camera.position.clone().add(dir));
  });

  return pose.mode === 'orbit'
    ? <OrbitControls target={center} maxPolarAngle={Math.PI / 2.05} minDistance={Math.max(1, diag * 0.1)} maxDistance={3 * diag} />
    : null;
}
