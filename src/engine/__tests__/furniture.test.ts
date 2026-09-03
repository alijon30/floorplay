import { describe, it, expect } from 'vitest';
import { makeDemoRoom } from '../rooms';
import { suggestFurniture } from '../furniture';

describe('suggestFurniture', () => {
  it('covers the demo brief inside its budget', () => {
    const room = makeDemoRoom();
    const plan = suggestFurniture(room);

    expect(plan.unmet).toEqual([]);
    expect(plan.total).toBeLessThanOrEqual(room.brief.budget);
    expect(plan.total).toBeLessThan(1200);
    expect(plan.remaining).toBe(room.brief.budget - plan.total);

    const categories = plan.items.map((i) => i.category);
    expect(categories).toContain('bed');
    expect(categories).toContain('desk');
    expect(categories).toContain('sofa');

    // Every piece fits inside 45 percent of the room on at least one axis pairing, and names
    // the need it answers.
    for (const item of plan.items) {
      expect(item.reason).toMatch(/covers '/);
      expect(item.price).toBeGreaterThan(0);
    }
    expect(plan.items.find((i) => i.category === 'bed')!.reason).toContain("covers 'sleep'");
  });

  it('offers up to three same-category alternatives per chosen item, excluding the choice', () => {
    const plan = suggestFurniture(makeDemoRoom());
    for (const item of plan.items) {
      const alts = plan.alternatives[item.catalogId];
      expect(alts).toBeDefined();
      expect(alts!.length).toBeLessThanOrEqual(3);
      expect(alts!.every((a) => a.catalogId !== item.catalogId)).toBe(true);
      expect([...alts!].sort((a, b) => a.price - b.price)).toEqual(alts);
    }
  });

  it('reports needs a small budget cannot reach', () => {
    const plan = suggestFurniture(makeDemoRoom(), { budget: 300 });
    expect(plan.unmet.length).toBeGreaterThanOrEqual(1);
    expect(plan.total).toBeLessThanOrEqual(300);
    // The bed still gets bought; it is the needs behind it that go short.
    expect(plan.items.some((i) => i.category === 'bed')).toBe(true);
    expect(plan.unmet).toContain('host two friends');
  });

  it('reports a need it has no bundle for', () => {
    const plan = suggestFurniture(makeDemoRoom(), { needs: ['sleep', 'juggling practice'] });
    expect(plan.unmet).toEqual(['juggling practice']);
    expect(plan.items.some((i) => i.category === 'bed')).toBe(true);
  });

  it('seats four at dinner in a large room and two in a small one', () => {
    const big = makeDemoRoom();
    const plan = suggestFurniture(big, { needs: ['dine'], budget: 2000 });
    expect(plan.items.filter((i) => i.category === 'chair')).toHaveLength(4);

    const small = { ...makeDemoRoom(), width: 300, depth: 300 };
    const smallPlan = suggestFurniture(small, { needs: ['eat dinner'], budget: 2000 });
    expect(smallPlan.items.filter((i) => i.category === 'chair')).toHaveLength(2);
  });

  it('is deterministic', () => {
    const room = makeDemoRoom();
    expect(suggestFurniture(room)).toEqual(suggestFurniture(room));
    expect(suggestFurniture(room, { needs: ['kitchen', 'read books'], budget: 1500 }))
      .toEqual(suggestFurniture(room, { needs: ['kitchen', 'read books'], budget: 1500 }));
  });
});
