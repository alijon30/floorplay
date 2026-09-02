import { describe, it, expect } from 'vitest';
import { TEMPLATES, buildTemplateRoom, templateFor } from '../templates';
import { analyze } from '../analyze';
import { findCatalogItem } from '../catalog';
import { budgetUsed } from '../validate';
import { BLOCKING_KINDS } from '../nearest';
import { ROOM_KINDS } from '../types';

describe('room templates', () => {
  it('covers every room kind exactly once', () => {
    expect(TEMPLATES.map((t) => t.key)).toEqual(ROOM_KINDS);
    for (const t of TEMPLATES) expect(templateFor(t.key)).toBe(t);
  });

  it('every template has a door, a window, a brief and 4 to 12 real catalog items', () => {
    for (const t of TEMPLATES) {
      expect(t.name.length, t.key).toBeGreaterThan(0);
      expect(t.blurb.length, t.key).toBeGreaterThan(10);
      expect(t.openings.some((o) => o.kind === 'door'), t.key).toBe(true);
      expect(t.openings.some((o) => o.kind === 'window'), t.key).toBe(true);
      expect(t.brief.budget, t.key).toBeGreaterThan(0);
      expect(t.brief.needs.length, t.key).toBeGreaterThan(0);
      expect(t.items.length, t.key).toBeGreaterThanOrEqual(4);
      expect(t.items.length, t.key).toBeLessThanOrEqual(12);
      const room = buildTemplateRoom(t.key);
      for (const i of room.items) expect(findCatalogItem(room, i.catalogId), `${t.key}: ${i.catalogId}`).toBeDefined();
    }
  });

  it('every template lays out cleanly: no blocking violations, nothing unreachable, within budget', () => {
    for (const t of TEMPLATES) {
      const room = buildTemplateRoom(t.key);
      const { violations } = analyze(room);
      const blocking = violations.filter((v) => BLOCKING_KINDS.has(v.kind));
      expect(blocking.map((v) => v.message), t.key).toEqual([]);
      expect(violations.filter((v) => v.kind === 'unreachable').map((v) => v.message), t.key).toEqual([]);
      expect(budgetUsed(room), t.key).toBeLessThanOrEqual(room.brief.budget);
      expect(room.items.length, t.key).toBeGreaterThanOrEqual(4);
    }
  });

  it('buildTemplateRoom mints fresh ids and an empty ledger every time', () => {
    const a = buildTemplateRoom('bedroom');
    const b = buildTemplateRoom('bedroom');
    expect(a.id).not.toBe(b.id);
    expect(a.items.map((i) => i.id)).not.toEqual(b.items.map((i) => i.id));
    expect(a.items.every((i) => b.items.every((j) => j.id !== i.id))).toBe(true);
    expect(a.openings.map((o) => o.id)).not.toEqual(b.openings.map((o) => o.id));
    expect(a.ledger).toEqual([]);
    expect(a.proposals).toEqual([]);
    expect(a.catalogExtras).toEqual([]);
    // The layout itself is identical; only identity differs.
    expect(a.items.map((i) => [i.catalogId, i.x, i.y, i.rotation])).toEqual(b.items.map((i) => [i.catalogId, i.x, i.y, i.rotation]));
  });

  it('honours an explicit name and carries the template finish and brief across', () => {
    const room = buildTemplateRoom('kitchen', 'Flat 3 kitchen');
    expect(room.name).toBe('Flat 3 kitchen');
    expect(room.finish).toEqual(templateFor('kitchen').finish);
    expect(room.brief).toEqual(templateFor('kitchen').brief);
    expect(room.brief).not.toBe(templateFor('kitchen').brief);
    expect(buildTemplateRoom('kitchen').name).toBe('Kitchen');
  });
});
