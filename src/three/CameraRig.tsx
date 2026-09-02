// src/three/CameraRig.tsx
import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { CameraPose } from '../engine/types';
import { M } from './units';

const keys = new Set<string>();
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (e) => { if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(e.key.toLowerCase())) keys.add(e.key.toLowerCase()); });
  window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
}

export default function CameraRig({ pose, width, depth, onLook }: { pose: CameraPose; width: number; depth: number; onLook: (yaw: number, pitch: number) => void }) {
  const { camera, gl } = useThree();
  const yaw = useRef(pose.yaw);
  const pitch = useRef(pose.pitch);
  const center: [number, number, number] = [(width * M) / 2, 0, (depth * M) / 2];

  useEffect(() => {
    yaw.current = pose.yaw;
    pitch.current = pose.pitch;
    if (pose.mode === 'walk') camera.position.set(pose.x * M, pose.z * M, pose.y * M);
    else camera.position.set(center[0], Math.max(width, depth) * M * 0.9, center[2] + Math.max(width, depth) * M * 0.8);
  }, [pose, camera, width, depth]);

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
    camera.position.x = Math.min(width * M - 0.2, Math.max(0.2, camera.position.x));
    camera.position.z = Math.min(depth * M - 0.2, Math.max(0.2, camera.position.z));
    camera.lookAt(camera.position.clone().add(dir));
  });

  return pose.mode === 'orbit' ? <OrbitControls target={center} maxPolarAngle={Math.PI / 2.05} /> : null;
}
