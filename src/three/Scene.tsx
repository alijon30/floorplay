// src/three/Scene.tsx
import { useCallback, useEffect, useMemo } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { useRoom } from '../store';
import { findCatalogItem } from '../engine/catalog';
import { cameraPreset } from '../engine/camera';
import { ghostsFor } from '../plan/ghosts';
import Viewport from '../ui/Viewport';
import { Icon } from '../ui/icons';
import { ICON_BTN, ICON_BTN_ON } from '../ui/styles';
import Floor from './Floor';
import Walls from './Walls';
import Furniture from './Furniture';
import Sun from './Sun';
import CameraRig from './CameraRig';
import { makeGroundFadeTexture } from './textures';
import { M } from './units';

/**
 * Keep the live renderer's shadow map in step with the toggle.
 *
 * The Canvas remounts on the flag (see `key` below), which is what actually rebuilds the
 * renderer with the new setting. This runs inside the fresh canvas as belt and braces: it
 * flips the shadow map itself and marks every material for a recompile, so a renderer that
 * survives the remount cannot keep drawing stale shadows.
 */
function ShadowSync({ enabled }: { enabled: boolean }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    gl.shadowMap.enabled = enabled;
    gl.shadowMap.needsUpdate = true;
    scene.traverse((o) => {
      const mat = (o as { material?: THREE.Material | THREE.Material[] }).material;
      if (!mat) return;
      for (const m of Array.isArray(mat) ? mat : [mat]) m.needsUpdate = true;
    });
  }, [enabled, gl, scene]);
  return null;
}

/**
 * The room the metalwork reflects.
 *
 * A metal in a physically based renderer has no diffuse colour of its own — all it can show
 * is what is around it. With nothing around it, brass handles, steel appliances and the mirror
 * all render as black holes. `RoomEnvironment` builds a lit box out of plain meshes in code,
 * so a pre-filtered probe of it costs one render at startup, ships no image, and needs no
 * network. Kept low: it is there to give metal something to catch, not to relight the room.
 */
function StudioEnvironment() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const target = pmrem.fromScene(room, 0.04);
    scene.environment = target.texture;
    scene.environmentIntensity = 0.35;
    return () => {
      scene.environment = null;
      target.dispose();
      pmrem.dispose();
      room.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        const mat = m.material;
        for (const one of Array.isArray(mat) ? mat : mat ? [mat] : []) one.dispose();
      });
    };
  }, [gl, scene]);
  return null;
}

/** The disc of shade the room stands on, so the floor does not end at a hard edge. */
function GroundFade({ w, d }: { w: number; d: number }) {
  const map = useMemo(makeGroundFadeTexture, []);
  if (!map) return null;
  const span = Math.max(w, d) * 2.6;
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[w / 2, -0.002, d / 2]} renderOrder={-1}>
      <planeGeometry args={[span, span]} />
      <meshBasicMaterial map={map} transparent depthWrite={false} opacity={0.9} />
    </mesh>
  );
}

export default function Scene() {
  const room = useRoom((s) => s.rooms[s.currentId]!);
  const ui = useRoom((s) => s.ui);
  const setCamera = useRoom((s) => s.setCamera);
  const select = useRoom((s) => s.select);
  const setShowShadows = useRoom((s) => s.setShowShadows);
  const shadows = ui.showShadows;
  const walking = ui.camera.mode === 'walk';
  const ghosts = useMemo(() => ghostsFor(room, room.proposals, ui.hoveredProposalId), [room, ui.hoveredProposalId]);
  const onLook = useCallback((yaw: number, pitch: number) => setCamera({ yaw, pitch }), [setCamera]);
  const toggle = () => {
    if (walking) setCamera({ mode: 'orbit' });
    else setCamera(cameraPreset(room, 'from_door') ?? { mode: 'walk', x: room.width / 2, y: room.depth - 60, z: 160, yaw: 0, pitch: 0 });
  };
  const w = room.width * M, d = room.depth * M;
  const cx = w / 2, cz = d / 2, span = Math.max(w, d);

  const toolbar = (
    <>
      <button
        className={walking ? ICON_BTN_ON : ICON_BTN}
        aria-label={walking ? 'Orbit view' : 'Walk through'}
        title={walking ? 'Back to the orbit view' : 'Walk through the room from the door'}
        aria-pressed={walking}
        onClick={toggle}
      ><Icon name={walking ? 'orbit' : 'walk'} /></button>
      <button
        className={shadows ? ICON_BTN_ON : ICON_BTN}
        aria-label="Shadows"
        title="Cast and catch shadows in the 3D view"
        aria-pressed={shadows}
        onClick={() => setShowShadows(!shadows)}
      ><Icon name="shadows" /></button>
      <button
        className={ICON_BTN}
        aria-label="Fit the room in view"
        title="Frame the whole room again"
        onClick={() => setCamera({ mode: 'orbit' })}
      ><Icon name="fit" /></button>
    </>
  );

  return (
    <Viewport label="3D" toolbar={toolbar}>
      {/*
        The gradient lives on the div rather than in the scene: the canvas is left transparent,
        which keeps the studio backdrop out of the renderer's colour pipeline and out of the
        way of the shadow passes.
      */}
      <div
        className="h-full w-full"
        style={{ background: 'radial-gradient(120% 100% at 50% 32%, #1c1c21 0%, #151519 55%, #0e0e10 100%)' }}
      >
        {/*
          react-three-fiber reads `shadows` only when it builds the renderer, so the key
          remounts the canvas on the toggle. Without it the checkbox changed nothing on screen.
        */}
        <Canvas
          key={shadows ? 'shadows-on' : 'shadows-off'}
          shadows={shadows}
          camera={{ fov: 55, near: 0.05, far: 100, position: [cx - span * 0.9, span * 0.75, cz - span * 1.1] }}
          /*
            Filmic tone mapping is what stops a sunlit wall clipping to flat white and lets the
            highlight on a brass handle roll off instead of blowing out. The slight exposure lift
            puts the mid-tones back where they sat before the curve took hold.
          */
          gl={{ toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
        >
          <ShadowSync enabled={shadows} />
          <StudioEnvironment />
          <Sun hour={room.daylightHour} northWall={room.northWall} width={room.width} depth={room.depth} castShadow={shadows} />
          {/*
            The room hangs 2 cm below world zero. drei's ContactShadows blurs its render
            target through a plane pinned to the world origin, so its own group has to sit
            below that plane and centered on it in x and z, or the blur pass renders an empty
            target and no shadow ever appears. Dropping the room by a hair lets the shadow
            catcher keep its natural place 5 mm above the floor.
          */}
          <group position={[0, -0.02, 0]}>
            <GroundFade w={w} d={d} />
            <Floor width={room.width} depth={room.depth} finish={room.finish.floor} />
            <Walls room={room} />
            {shadows && <ContactShadows position={[0, 0.014, 0]} scale={[2 * w, 2 * d]} opacity={0.45} blur={2.2} far={2} resolution={1024} color="#3a3128" />}
            {room.items.map((item) => {
              const cat = findCatalogItem(room, item.catalogId);
              return cat ? <Furniture key={item.id} item={item} cat={cat} selected={ui.selectedItemId === item.id} onSelect={select} roomW={room.width} roomD={room.depth} /> : null;
            })}
            {ghosts.map((g) => {
              const cat = findCatalogItem(room, g.catalogId);
              return cat ? <Furniture key={`${g.proposalId}:${g.opIndex}`} item={{ id: g.itemId ?? 'ghost', catalogId: g.catalogId, x: g.x, y: g.y, rotation: g.rotation, locked: false }} cat={cat} ghost={g.kind !== 'remove'} removal={g.kind === 'remove'} roomW={room.width} roomD={room.depth} /> : null;
            })}
          </group>
          <CameraRig pose={ui.camera} width={room.width} depth={room.depth} onLook={onLook} />
        </Canvas>
      </div>
      {walking && (
        <div className="pointer-events-none absolute bottom-3 left-3 rounded-md border border-line bg-panel/85 px-2 py-1 text-[11px] text-muted backdrop-blur">
          <span className="font-mono text-fg">WASD</span> or arrows to move · drag to look
        </div>
      )}
    </Viewport>
  );
}
