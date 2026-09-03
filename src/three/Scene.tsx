// src/three/Scene.tsx
import { useCallback, useEffect, useMemo, type ReactNode } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { useRoom } from '../store';
import type { Rect, Room, Wall } from '../engine/types';
import { findCatalogItem } from '../engine/catalog';
import { cameraPreset, toHomePose } from '../engine/camera';
import { homeBounds, interiorWalls, placementOf } from '../engine/home';
import { ghostsFor } from '../plan/ghosts';
import Viewport from '../ui/Viewport';
import { Icon } from '../ui/icons';
import { ICON_BTN, ICON_BTN_ON } from '../ui/styles';
import Floor from './Floor';
import Walls from './Walls';
import Furniture from './Furniture';
import { preloadModels } from './ModelPiece';
import Sun from './Sun';
import CameraRig, { orbitPosition } from './CameraRig';
import ViewToggle from '../elevation/ViewToggle';
import { makeGroundFadeTexture } from './textures';
import type { Cutaway } from './cutaway';
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

/** The disc of shade the plan stands on, so the floor does not end at a hard edge. */
function GroundFade({ bounds }: { bounds: Rect }) {
  const map = useMemo(makeGroundFadeTexture, []);
  if (!map) return null;
  const w = bounds.w * M, d = bounds.h * M;
  const span = Math.max(w, d) * 2.6;
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[(bounds.x + bounds.w / 2) * M, -0.002, (bounds.y + bounds.h / 2) * M]} renderOrder={-1}>
      <planeGeometry args={[span, span]} />
      <meshBasicMaterial map={map} transparent depthWrite={false} opacity={0.9} />
    </mesh>
  );
}

/**
 * One room built from its own top-left corner: floor, walls, and everything standing on it.
 *
 * Drawn at the origin on its own, and inside a `<group>` carrying it to its place on the plan
 * when a whole home is on screen. Nothing in here knows which of the two it is in; the offset
 * lives on the group outside it, and `cutaway` is what tells the walls whose edge the camera
 * has to pass before one of them steps aside.
 */
function RoomBody({ room, cutaway, highlight, selectedItemId, onSelect, children }: {
  room: Room;
  cutaway?: Cutaway;
  highlight?: Wall | null;
  selectedItemId?: string | null;
  onSelect?: (id: string) => void;
  children?: ReactNode;
}) {
  return (
    <>
      <Floor width={room.width} depth={room.depth} finish={room.finish.floor} />
      <Walls room={room} highlight={highlight ?? null} cutaway={cutaway} />
      {room.items.map((item) => {
        const cat = findCatalogItem(room, item.catalogId);
        return cat ? <Furniture key={item.id} item={item} cat={cat} selected={selectedItemId === item.id} onSelect={onSelect} roomW={room.width} roomD={room.depth} cutaway={cutaway} /> : null;
      })}
      {children}
    </>
  );
}

export default function Scene() {
  const room = useRoom((s) => s.rooms[s.currentId]!);
  const rooms = useRoom((s) => s.rooms);
  const home = useRoom((s) => s.currentHome());
  const ui = useRoom((s) => s.ui);
  const setCamera = useRoom((s) => s.setCamera);
  const select = useRoom((s) => s.select);
  const setShowShadows = useRoom((s) => s.setShowShadows);
  const shadows = ui.showShadows;
  const walking = ui.camera.mode === 'walk';
  /* The plan toggle drives the 3D view too: Home means the whole flat, walls, doors and all. */
  const homeView = home !== null && ui.planView === 'home';
  const onPlan = useMemo(
    () => (homeView && home ? home.rooms.filter((p) => rooms[p.roomId]).map((p) => ({ p, room: rooms[p.roomId]! })) : []),
    [homeView, home, rooms],
  );
  const ghosts = useMemo(() => ghostsFor(room, room.proposals, ui.hoveredProposalId), [room, ui.hoveredProposalId]);
  /*
   * Ask for every model this room can want, up front. The pieces already in it would fetch their
   * own as they render, but a proposal's ghost appears the instant the agent answers, and a room
   * that has to go to the network at that moment shows the procedural shape first and swaps it a
   * beat later. One pass over the catalog on load spares the swap. In Home view every room on
   * the plan is on screen at once, so every room's models are asked for together.
   */
  useEffect(() => {
    const list = onPlan.length ? onPlan.map((r) => r.room) : [room];
    preloadModels(list.flatMap((r) => r.items.map((i) => findCatalogItem(r, i.catalogId))).filter((c) => c !== undefined));
  }, [room, onPlan]);
  const onLook = useCallback((yaw: number, pitch: number) => setCamera({ yaw, pitch }), [setCamera]);
  const toggle = () => {
    if (walking) setCamera({ mode: 'orbit' });
    else setCamera(cameraPreset(room, 'from_door') ?? { mode: 'walk', x: room.width / 2, y: room.depth - 60, z: 160, yaw: 0, pitch: 0 });
  };

  /*
   * What the camera frames and what a walk is kept inside: the room on its own, or the whole
   * plan. Everything below sizes itself off this — the sun, the ground fade, the contact
   * shadow and the orbit rig — so a home is lit and framed as one building rather than as
   * whichever room happens to be current.
   */
  const bounds: Rect = useMemo(
    () => (homeView && home ? homeBounds(home, rooms) : { x: 0, y: 0, w: room.width, h: room.depth }),
    [homeView, home, rooms, room.width, room.depth],
  );
  /*
   * The cutaway is worked out once for the whole plan rather than room by room. A wall only
   * steps aside when the camera is outside the home's own edge, and never when another room
   * stands behind it: judged per room, walking into the living room would strip the bedroom
   * bare, and the wall the two of them share would vanish for one and stay for the other.
   */
  const cutaways = useMemo(() => {
    if (!homeView || !home) return {} as Record<string, Cutaway>;
    return Object.fromEntries(home.rooms.map((p) => [p.roomId, { rect: bounds, keep: interiorWalls(home, rooms, p.roomId) } satisfies Cutaway]));
  }, [homeView, home, rooms, bounds]);
  // Poses are stored in the current room's own coordinates; the plan they are drawn on may not
  // be the room's. `set_camera` and its presets never have to know which view is up.
  const placement = homeView && home ? placementOf(home, room.id) : null;
  const pose = useMemo(() => toHomePose(ui.camera, placement), [ui.camera, placement]);

  const w = room.width * M, d = room.depth * M;
  const bw = bounds.w * M, bd = bounds.h * M;
  const cx = (bounds.x + bounds.w / 2) * M, cz = (bounds.y + bounds.h / 2) * M;
  const ghostNodes = ghosts.map((g) => {
    const cat = findCatalogItem(room, g.catalogId);
    return cat ? <Furniture key={`${g.proposalId}:${g.opIndex}`} item={{ id: g.itemId ?? 'ghost', catalogId: g.catalogId, x: g.x, y: g.y, rotation: g.rotation, locked: false }} cat={cat} ghost={g.kind !== 'remove'} removal={g.kind === 'remove'} roomW={room.width} roomD={room.depth} cutaway={cutaways[room.id]} /> : null;
  });

  const toolbar = (
    <>
      <ViewToggle />
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
          camera={{ fov: 55, near: 0.05, far: 100, position: orbitPosition(bounds, homeView) }}
          /*
            Filmic tone mapping is what stops a sunlit wall clipping to flat white and lets the
            highlight on a brass handle roll off instead of blowing out. The slight exposure lift
            puts the mid-tones back where they sat before the curve took hold.
          */
          gl={{ toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
        >
          <ShadowSync enabled={shadows} />
          <StudioEnvironment />
          {/* One sun over the whole plan, at the hour the current room is set to. */}
          <Sun hour={room.daylightHour} northWall={room.northWall} x={bounds.x} y={bounds.y} width={bounds.w} depth={bounds.h} castShadow={shadows} />
          {/*
            The room hangs 2 cm below world zero. drei's ContactShadows blurs its render
            target through a plane pinned to the world origin, so its own group has to sit
            below that plane and centered on it in x and z, or the blur pass renders an empty
            target and no shadow ever appears. Dropping the room by a hair lets the shadow
            catcher keep its natural place 5 mm above the floor.
          */}
          <group position={[0, -0.02, 0]}>
            <GroundFade bounds={bounds} />
            {shadows && (homeView
              ? <ContactShadows position={[cx, 0.014, cz]} scale={[bw * 1.15, bd * 1.15]} opacity={0.45} blur={2.2} far={2} resolution={1024} color="#3a3128" />
              : <ContactShadows position={[0, 0.014, 0]} scale={[2 * w, 2 * d]} opacity={0.45} blur={2.2} far={2} resolution={1024} color="#3a3128" />)}
            {homeView
              ? onPlan.map(({ p, room: r }) => {
                const current = p.roomId === room.id;
                return (
                  /* Every room stands at its own top-left on the shared plan. The doorways
                     between them are already openings in both rooms, so the walls arrive
                     with the holes cut and a door reads as one hole through one wall. */
                  <group key={p.roomId} position={[p.x * M, 0, p.y * M]}>
                    <RoomBody
                      room={r}
                      cutaway={cutaways[p.roomId]}
                      highlight={current ? ui.highlightWall : null}
                      selectedItemId={current ? ui.selectedItemId : null}
                      onSelect={current ? select : undefined}
                    >
                      {current ? ghostNodes : null}
                    </RoomBody>
                  </group>
                );
              })
              : (
                <RoomBody room={room} highlight={ui.highlightWall} selectedItemId={ui.selectedItemId} onSelect={select}>
                  {ghostNodes}
                </RoomBody>
              )}
          </group>
          <CameraRig pose={pose} bounds={bounds} dollhouse={homeView} onLook={onLook} />
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
