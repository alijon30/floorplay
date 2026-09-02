// src/engine/camera.ts
import type { CameraPose, Room } from './types';
import { findCatalogItem } from './catalog';
import { doorInsidePoint, frontVector, openingSpan } from './geometry';

export type CameraPreset = 'overview' | 'from_door' | 'at_desk' | 'on_bed' | 'at_window';
export const CAMERA_PRESETS: CameraPreset[] = ['overview', 'from_door', 'at_desk', 'on_bed', 'at_window'];

export function yawOf(dx: number, dy: number): number {
  return Math.round(((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360);
}

export function dirOf(yaw: number): { dx: number; dy: number } {
  const r = (yaw * Math.PI) / 180;
  // `|| 0` normalises -0 so results compare cleanly
  return { dx: Math.round(Math.sin(r) * 1000) / 1000 || 0, dy: Math.round(-Math.cos(r) * 1000) / 1000 || 0 };
}

const INTO_ROOM: Record<string, number> = { bottom: 0, top: 180, left: 90, right: 270 };

export function cameraPreset(room: Room, preset: CameraPreset): CameraPose | null {
  const walk = (x: number, y: number, yaw: number, z = 160, pitch = 0): CameraPose => ({ mode: 'walk', x: Math.round(x), y: Math.round(y), z, yaw, pitch });
  const first = (category: string) => room.items.find((i) => findCatalogItem(room, i.catalogId)?.category === category);
  switch (preset) {
    case 'overview':
      return { mode: 'orbit', x: room.width / 2, y: room.depth / 2, z: 160, yaw: 0, pitch: 0 };
    case 'from_door': {
      const door = room.openings.find((o) => o.kind === 'door');
      if (!door) return null;
      const p = doorInsidePoint(room, door);
      const yaw = INTO_ROOM[door.wall]!;
      const d = dirOf(yaw);
      return walk(p.x + d.dx * 40, p.y + d.dy * 40, yaw);
    }
    case 'at_desk': {
      const desk = first('desk');
      const cat = desk && findCatalogItem(room, desk.catalogId);
      if (!desk || !cat) return null;
      const f = frontVector(desk.rotation);
      const dist = cat.depth / 2 + 80;
      return walk(desk.x + f.dx * dist, desk.y + f.dy * dist, yawOf(-f.dx, -f.dy), 160, -10);
    }
    case 'on_bed': {
      const bed = first('bed');
      if (!bed) return null;
      const f = frontVector(bed.rotation);
      return walk(bed.x, bed.y, yawOf(f.dx, f.dy), 60);
    }
    case 'at_window': {
      const win = room.openings.find((o) => o.kind === 'window');
      if (!win) return null;
      const span = openingSpan(room, win, 1);
      const yaw = INTO_ROOM[win.wall]!;
      const d = dirOf(yaw);
      return walk(span.x + span.w / 2 + d.dx * 60, span.y + span.h / 2 + d.dy * 60, yaw);
    }
  }
}

export function itemsInView(room: Room, pose: CameraPose): { id: string; name: string; distanceCm: number; side: 'left' | 'center' | 'right' }[] {
  const dir = dirOf(pose.yaw);
  const out: { id: string; name: string; distanceCm: number; side: 'left' | 'center' | 'right' }[] = [];
  for (const item of room.items) {
    const name = findCatalogItem(room, item.catalogId)?.name ?? item.catalogId;
    const vx = item.x - pose.x;
    const vy = item.y - pose.y;
    const dist = Math.hypot(vx, vy);
    if (pose.mode === 'orbit') { out.push({ id: item.id, name, distanceCm: Math.round(dist), side: 'center' }); continue; }
    if (dist > 800) continue;
    const dot = dist === 0 ? 1 : (vx * dir.dx + vy * dir.dy) / dist;
    if (dot < Math.cos(Math.PI / 4)) continue;
    const cross = dir.dx * vy - dir.dy * vx;
    const side = Math.abs(cross) / Math.max(1, dist) < 0.25 ? 'center' : cross > 0 ? 'right' : 'left';
    out.push({ id: item.id, name, distanceCm: Math.round(dist), side });
  }
  return out.sort((a, b) => a.distanceCm - b.distanceCm);
}
