// src/three/__tests__/models.test.ts
//
// The registry decides which catalog entries are drawn from a photographed model and how far
// each one may be stretched onto a size it was not photographed at. Both are pure arithmetic on
// the catalog's own numbers, so both are checked here rather than in a screenshot: a bad fit
// rule shows up as a squashed bookcase three steps later and a long way from its cause.
import { describe, expect, it } from 'vitest';
import { SEED_CATALOG } from '../../engine/catalog';
import { allModelFiles, fitScale, fitsCatalog, modelFor, orientedSize } from '../models';

const byId = (id: string) => {
  const cat = SEED_CATALOG.find((c) => c.id === id);
  if (!cat) throw new Error(`no catalog item ${id}`);
  return cat;
};
/** The metric box a catalog entry claims, the way the renderer asks for it. */
const want = (id: string) => {
  const c = byId(id);
  return { w: c.width / 100, d: c.depth / 100, h: c.height / 100 };
};

describe('fitScale', () => {
  it('stretches a carcass onto all three of the catalog dimensions', () => {
    const s = fitScale({ w: 2, d: 1, h: 0.8 }, { w: 1, d: 0.5, h: 0.8 }, 'stretch');
    expect(s).toEqual([0.5, 1, 0.5]);
  });

  it('keeps a familiar silhouette undistorted once the aspect drifts too far', () => {
    // A quarter of distortion is allowed; a half is not, and shrinks to fit inside the box.
    expect(fitScale({ w: 1, d: 1, h: 1 }, { w: 1.2, d: 1, h: 1 }, 'box')).toEqual([1.2, 1, 1]);
    expect(fitScale({ w: 1, d: 1, h: 1 }, { w: 1.5, d: 1, h: 1 }, 'box')).toEqual([1, 1, 1]);
  });

  it('lets foliage overhang its pot, but not by more than half', () => {
    const plant = { w: 0.701, d: 0.657, h: 0.841 };
    const [s] = fitScale(plant, want('plant-large'), 'height');
    // 160 cm of catalog height would need a 133 cm spread; the cap holds it to 1.5 × 50 cm.
    expect(plant.w * s).toBeLessThanOrEqual(0.5 * 1.5 + 1e-9);
    expect(plant.h * s).toBeGreaterThan(0.8);
  });
});

describe('fitsCatalog', () => {
  it('refuses a stretch that would stop being a picture of the thing', () => {
    const shelf = { w: 10.974, d: 4.996, h: 21.392 };
    expect(fitsCatalog(shelf, want('shelf-80'), 'stretch')).toBe(true);
    // A shoe rack is 50 cm tall: a quarter of the shelving unit that was photographed.
    expect(fitsCatalog(shelf, want('shoe-rack-80'), 'stretch')).toBe(false);
  });

  it('always accepts the modes that cannot go far wrong', () => {
    const chair = { w: 0.434, d: 0.576, h: 0.973 };
    expect(fitsCatalog(chair, want('chair-kids-30'), 'box')).toBe(true);
    expect(fitsCatalog(chair, { w: 9, d: 0.1, h: 9 }, 'height')).toBe(true);
  });
});

describe('modelFor', () => {
  it('reads the most specific key first', () => {
    // An armchair is a `sofa` by shape; a nightstand and a dresser are plain boxes.
    expect(modelFor(byId('armchair-80'))?.file).toBe('/models/armchair.glb');
    expect(modelFor(byId('nightstand-45'))?.file).toBe('/models/side-table.glb');
    expect(modelFor(byId('sideboard-200'))?.file).toBe('/models/sideboard.glb');
    // A coffee table is a `table` like the dining ones, and only the dining ones lack a model.
    expect(modelFor(byId('table-coffee-90'))?.file).toBe('/models/coffee-table.glb');
    expect(modelFor(byId('chair-dining'))?.file).toBe('/models/chair.glb');
  });

  it('leaves every shape with no clean modern model to the procedural renderer', () => {
    // Poly Haven's beds are Gothic, its sofas Victorian, its desks scratched steel and its
    // mirrors gilt. A plain box is closer to a modern one than any of them.
    for (const id of [
      'bed-queen-160', 'sofa-3', 'desk-120', 'table-dining-160', 'bench-dining-140',
      'mirror-rect-80', 'rug-160x230', 'lamp-floor', 'tv-stand-160', 'counter-180',
      'fridge-60', 'curtain-200', 'picture-60', 'wall-clock-30',
    ]) {
      expect(modelFor(byId(id))).toBeNull();
    }
  });

  it('declines the entries a model cannot honestly stand in for', () => {
    // A bookcase squashed to a shoe rack, a tall cabinet flattened to a pantry — and the stools,
    // which are `chair`s by shape and would otherwise be served a dining chair.
    for (const id of ['shoe-rack-80', 'shelf-low-120', 'pantry-60', 'stool-bar-75', 'stool-step-40']) {
      expect(modelFor(byId(id))).toBeNull();
    }
  });

  it('turns the models whose front does not already face +z', () => {
    const coffee = modelFor(byId('table-coffee-90'))!;
    expect(coffee.yaw).toBe(90);
    // The turn swaps width for depth: the long axis of that table is along z in the file.
    expect(orientedSize(coffee)).toEqual({ w: coffee.size.d, d: coffee.size.w, h: coffee.size.h });
  });

  it('claims at least one seed item for every model that ships', () => {
    const claimed = new Set(SEED_CATALOG.map(modelFor).filter((s) => s !== null).map((s) => s.file));
    expect([...claimed].sort()).toEqual(allModelFiles().sort());
  });

  it('fits every seed item it claims within a quarter of the footprint the plan drew', () => {
    for (const cat of SEED_CATALOG) {
      const spec = modelFor(cat);
      if (!spec) continue;
      const box = orientedSize(spec);
      const [sx, sy, sz] = fitScale(box, { w: cat.width / 100, d: cat.depth / 100, h: cat.height / 100 }, spec.fit);
      // Nothing may spill more than a quarter past its own footprint, or the plan and the 3D
      // view stop agreeing about where a piece is; `height` mode is allowed its 1.5 overhang.
      const slack = spec.fit === 'height' ? 1.5 : 1.25;
      expect(box.w * sx).toBeLessThanOrEqual((cat.width / 100) * slack + 1e-9);
      expect(box.d * sz).toBeLessThanOrEqual((cat.depth / 100) * slack + 1e-9);
      expect(sy).toBeGreaterThan(0);
    }
  });
});
