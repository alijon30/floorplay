// src/three/__tests__/models.test.ts
//
// The registry decides which catalog entries are drawn from a photographed model and how far
// each one may be stretched onto a size it was not photographed at. Both are pure arithmetic on
// the catalog's own numbers, so both are checked here rather than in a screenshot: a bad fit
// rule shows up as a squashed sofa three steps later and a long way from its cause.
import { describe, expect, it } from 'vitest';
import { SEED_CATALOG } from '../../engine/catalog';
import { fitScale, fitsCatalog, modelFor, orientedSize } from '../models';

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
    // A quarter of distortion is allowed; a third is not, and shrinks to fit inside the box.
    expect(fitScale({ w: 1, d: 1, h: 1 }, { w: 1.2, d: 1, h: 1 }, 'box')).toEqual([1.2, 1, 1]);
    expect(fitScale({ w: 1, d: 1, h: 1 }, { w: 1.5, d: 1, h: 1 }, 'box')).toEqual([1, 1, 1]);
  });

  it('drives height from the footprint, so a bed keeps its headboard', () => {
    // 45 cm is the top of the mattress, not the top of the bed: matching it would flatten one.
    const bed = { w: 1.493, d: 2.04, h: 1.534 };
    const [sx, sy, sz] = fitScale(bed, want('bed-queen-160'), 'footprint');
    expect(sx).toBeCloseTo(1.07, 2);
    expect(sz).toBeCloseTo(0.98, 2);
    expect(bed.h * sy).toBeGreaterThan(1.4);
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
    const sofa = { w: 1.571, d: 0.658, h: 0.797 };
    expect(fitsCatalog(sofa, want('sofa-3'), 'stretch')).toBe(true);
    // A corner sofa is 180 cm deep: nearly three times the settee that was photographed.
    expect(fitsCatalog(sofa, want('sofa-corner-260'), 'stretch')).toBe(false);
  });

  it('always accepts the modes that cannot go far wrong', () => {
    const chair = { w: 0.43, d: 0.539, h: 0.956 };
    expect(fitsCatalog(chair, want('chair-kids-30'), 'box')).toBe(true);
    expect(fitsCatalog(chair, { w: 9, d: 0.1, h: 9 }, 'height')).toBe(true);
  });
});

describe('modelFor', () => {
  it('reads the most specific key first', () => {
    // An armchair is a `sofa` by shape and would otherwise be drawn as a settee.
    expect(modelFor(byId('armchair-80'))?.file).toBe('/models/armchair.glb');
    expect(modelFor(byId('sofa-2'))?.file).toBe('/models/sofa.glb');
    // A nightstand is a plain box by shape, and a coffee table is a `table` like the dining ones.
    expect(modelFor(byId('nightstand-45'))?.file).toBe('/models/side-table.glb');
    expect(modelFor(byId('table-coffee-90'))?.file).toBe('/models/coffee-table.glb');
    expect(modelFor(byId('table-dining-160'))?.file).toBe('/models/table.glb');
  });

  it('leaves the shapes with no model to the procedural renderer', () => {
    for (const id of ['rug-160x230', 'lamp-floor', 'tv-stand-160', 'counter-180', 'fridge-60', 'curtain-200', 'picture-60']) {
      expect(modelFor(byId(id))).toBeNull();
    }
  });

  it('declines the entries a model cannot honestly stand in for', () => {
    // Too deep for the settee, too tall for the chest, and two beds where the model has one.
    for (const id of ['sofa-corner-260', 'dresser-60', 'bed-bunk-90', 'shoe-rack-80']) {
      expect(modelFor(byId(id))).toBeNull();
    }
  });

  it('turns the models whose front does not already face +z', () => {
    const coffee = modelFor(byId('table-coffee-90'))!;
    expect(coffee.yaw).toBe(90);
    // The turn swaps width for depth: the long axis of that table is along z in the file.
    expect(orientedSize(coffee)).toEqual({ w: coffee.size.d, d: coffee.size.w, h: coffee.size.h });
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
