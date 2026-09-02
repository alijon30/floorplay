// src/three/Scene.tsx
import { useCallback, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { ContactShadows } from '@react-three/drei';
import { useRoom } from '../store';
import { findCatalogItem } from '../engine/catalog';
import { cameraPreset } from '../engine/camera';
import { ghostsFor } from '../plan/ghosts';
import Floor from './Floor';
import Walls from './Walls';
import Furniture from './Furniture';
import Sun from './Sun';
import CameraRig from './CameraRig';
import { M } from './units';

export default function Scene() {
  const room = useRoom((s) => s.rooms[s.currentId]!);
  const ui = useRoom((s) => s.ui);
  const setCamera = useRoom((s) => s.setCamera);
  const select = useRoom((s) => s.select);
  const ghosts = useMemo(() => ghostsFor(room, room.proposals, ui.hoveredProposalId), [room, ui.hoveredProposalId]);
  const onLook = useCallback((yaw: number, pitch: number) => setCamera({ yaw, pitch }), [setCamera]);
  const toggle = () => {
    if (ui.camera.mode === 'walk') setCamera({ mode: 'orbit' });
    else setCamera(cameraPreset(room, 'from_door') ?? { mode: 'walk', x: room.width / 2, y: room.depth - 60, z: 160, yaw: 0, pitch: 0 });
  };
  const w = room.width * M, d = room.depth * M;
  const cx = w / 2, cz = d / 2, span = Math.max(w, d);
  return (
    <div className="relative h-full w-full bg-neutral-900">
      <Canvas shadows camera={{ fov: 55, near: 0.05, far: 100, position: [cx - span * 0.9, span * 0.75, cz - span * 1.1] }}>
        <color attach="background" args={['#dbe4ec']} />
        <Sun hour={room.daylightHour} northWall={room.northWall} width={room.width} depth={room.depth} />
        {/*
          The room hangs 2 cm below world zero. drei's ContactShadows blurs its render
          target through a plane pinned to the world origin, so its own group has to sit
          below that plane and centered on it in x and z, or the blur pass renders an empty
          target and no shadow ever appears. Dropping the room by a hair lets the shadow
          catcher keep its natural place 5 mm above the floor.
        */}
        <group position={[0, -0.02, 0]}>
          <Floor width={room.width} depth={room.depth} />
          <Walls room={room} />
          <ContactShadows position={[0, 0.005, 0]} scale={[2 * w, 2 * d]} opacity={0.45} blur={2.2} far={2} resolution={1024} color="#3a3128" />
          {room.items.map((item) => {
            const cat = findCatalogItem(room, item.catalogId);
            return cat ? <Furniture key={item.id} item={item} cat={cat} selected={ui.selectedItemId === item.id} onSelect={select} /> : null;
          })}
          {ghosts.map((g) => {
            const cat = findCatalogItem(room, g.catalogId);
            return cat ? <Furniture key={`${g.proposalId}:${g.opIndex}`} item={{ id: g.itemId ?? 'ghost', catalogId: g.catalogId, x: g.x, y: g.y, rotation: g.rotation, locked: false }} cat={cat} ghost={g.kind !== 'remove'} removal={g.kind === 'remove'} /> : null;
          })}
        </group>
        <CameraRig pose={ui.camera} width={room.width} depth={room.depth} onLook={onLook} />
      </Canvas>
      <div className="absolute right-3 top-3 flex gap-2 text-xs">
        <button className="rounded border border-neutral-700 bg-neutral-900/80 px-2 py-1 hover:border-emerald-500" onClick={toggle}>{ui.camera.mode === 'walk' ? 'Orbit view' : 'Walk through'}</button>
      </div>
      {ui.camera.mode === 'walk' && <div className="absolute bottom-3 left-3 rounded bg-neutral-900/80 px-2 py-1 text-[11px] text-neutral-300">WASD or arrows to move · drag to look</div>}
    </div>
  );
}
