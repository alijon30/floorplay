import { describe, it, expect } from 'vitest';
import type { Room } from '../types';
import { HOME_TEMPLATES, HOME_TEMPLATE_KEYS, buildHomeFromTemplate, homeTemplateFor } from '../homeTemplates';
import { homeReachability, roomRectInHome, sharedSegments } from '../home';
import { analyze } from '../analyze';
import { intersects } from '../geometry';
import { BLOCKING_KINDS } from '../nearest';

const byId = (rooms: Room[]): Record<string, Room> => Object.fromEntries(rooms.map((r) => [r.id, r]));

describe('home templates', () => {
  it('offers every key exactly once, each with rooms and doorways', () => {
    expect(HOME_TEMPLATES.map((t) => t.key)).toEqual(HOME_TEMPLATE_KEYS);
    for (const t of HOME_TEMPLATES) {
      expect(homeTemplateFor(t.key)).toBe(t);
      expect(t.name.length, t.key).toBeGreaterThan(0);
      expect(t.blurb.length, t.key).toBeGreaterThan(10);
      expect(t.rooms.length, t.key).toBeGreaterThanOrEqual(2);
      expect(t.doorways.length, t.key).toBeGreaterThanOrEqual(1);
    }
  });

  it('lays the rooms out edge to edge with no two overlapping', () => {
    for (const t of HOME_TEMPLATES) {
      const { home, rooms } = buildHomeFromTemplate(t.key);
      const map = byId(rooms);
      const rects = home.rooms.map((p) => roomRectInHome(home, map, p.roomId));
      for (let i = 0; i < rects.length; i += 1) {
        for (let j = i + 1; j < rects.length; j += 1) {
          expect(intersects(rects[i]!, rects[j]!), `${t.key}: ${home.rooms[i]!.roomId} and ${home.rooms[j]!.roomId}`).toBe(false);
        }
      }
    }
  });

  it('cuts every doorway inside a wall the two rooms really share, mirrored on both sides', () => {
    for (const t of HOME_TEMPLATES) {
      const { home, rooms } = buildHomeFromTemplate(t.key);
      const map = byId(rooms);
      expect(home.doorways.length, t.key).toBe(t.doorways.length);
      for (const d of home.doorways) {
        for (const side of [d.a, d.b]) {
          const seg = sharedSegments(home, map, side.roomId)
            .find((s) => s.wall === side.wall && s.otherRoomId === (side === d.a ? d.b.roomId : d.a.roomId));
          expect(seg, `${t.key}: ${d.id} on ${side.wall} of ${map[side.roomId]?.name}`).toBeDefined();
          expect(side.offset, `${t.key}: ${d.id}`).toBeGreaterThanOrEqual(seg!.start);
          expect(side.offset + d.width, `${t.key}: ${d.id}`).toBeLessThanOrEqual(seg!.end);
          const opening = map[side.roomId]!.openings.find((o) => o.doorwayId === d.id);
          expect(opening, `${t.key}: ${d.id} opening in ${side.roomId}`).toMatchObject({ kind: 'door', wall: side.wall, offset: side.offset, width: d.width });
        }
        // The two halves name the same line on the plan.
        const rectA = roomRectInHome(home, map, d.a.roomId);
        const rectB = roomRectInHome(home, map, d.b.roomId);
        const vertical = d.a.wall === 'left' || d.a.wall === 'right';
        expect(vertical ? rectA.y + d.a.offset : rectA.x + d.a.offset, `${t.key}: ${d.id}`)
          .toBe(vertical ? rectB.y + d.b.offset : rectB.x + d.b.offset);
      }
    }
  });

  it('leaves every room reachable through the doorways from the entrance', () => {
    for (const t of HOME_TEMPLATES) {
      const { home, rooms } = buildHomeFromTemplate(t.key);
      const reach = homeReachability(home, byId(rooms));
      expect(reach.unreachable, t.key).toEqual([]);
      expect(reach.entranceRoomId, t.key).toBe(home.entranceRoomId);
    }
  });

  it('leaves every room with nothing blocked once the doorways are cut', () => {
    for (const t of HOME_TEMPLATES) {
      const { rooms } = buildHomeFromTemplate(t.key);
      for (const room of rooms) {
        const blocking = analyze(room).violations.filter((v) => BLOCKING_KINDS.has(v.kind));
        expect(blocking.map((v) => v.message), `${t.key}: ${room.name}`).toEqual([]);
      }
    }
  });

  it('mints fresh rooms every time so two copies of a home can stand side by side', () => {
    const a = buildHomeFromTemplate('one-bedroom');
    const b = buildHomeFromTemplate('one-bedroom');
    expect(a.home.id).not.toBe(b.home.id);
    expect(a.rooms.map((r) => r.id)).not.toEqual(b.rooms.map((r) => r.id));
    expect(a.home.doorways.map((d) => d.id)).not.toEqual(b.home.doorways.map((d) => d.id));
    expect(a.home.rooms.map((p) => p.roomId)).toEqual(a.rooms.map((r) => r.id));
    expect(a.rooms.every((r) => r.ledger.length === 0)).toBe(true);
    // The layout is identical; only identity differs.
    expect(a.home.rooms.map((p) => [p.x, p.y])).toEqual(b.home.rooms.map((p) => [p.x, p.y]));
  });
});
