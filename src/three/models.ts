// src/three/models.ts
/**
 * Which catalog pieces are drawn from a real scanned model, and how each one is fitted.
 *
 * The 3D view has two ways to draw a chair. `Furniture.tsx` can build one out of rounded boxes
 * and turned legs, which is exact — it is the catalog's own dimensions made solid — and always
 * available. Or it can load a photographed one from `public/models`, which is a real object with
 * real wear on it, and is only right for the items whose proportions it actually matches.
 *
 * This file is where that second answer is decided. `npm run models` fills the folder (see
 * `scripts/models.manifest.json` for the Poly Haven asset behind each file); everything here is
 * about placement: which catalog entries a model answers for, which way its front points, and how
 * an object of fixed proportions is fitted to a catalog entry of different ones. When the two
 * disagree by too much — a 260 cm corner sofa against a photographed settee — `modelFor` returns
 * null and the procedural shape draws it instead, because a sofa stretched to two and a half
 * times its own depth is worse than an honest box.
 */
import type { CatalogItem, Category, Shape } from '../engine/types';

/**
 * How a model of fixed proportions is fitted to a catalog entry's width, depth and height.
 *
 * - `box` — match all three, unless that distorts the aspect by more than a quarter, in which
 *   case scale uniformly to fit inside the box and stand it in the middle. For anything whose
 *   silhouette people know by heart: armchairs, dining chairs, side tables.
 * - `stretch` — match all three outright. For rectilinear carcasses — desks, sideboards, shelving
 *   — where a wider or deeper version of the same piece is a real product, not a distortion.
 * - `footprint` — match width and depth; height follows them. For pieces whose catalog height
 *   measures a *surface* rather than the silhouette: a bed is 45 cm to the top of its mattress
 *   and 150 cm to the top of its headboard, and the 45 is the number the planner cares about.
 * - `height` — match height; width and depth follow, capped at one and a half times the
 *   footprint. For foliage, which is allowed to spill over the pot it is filed under.
 */
export type FitMode = 'box' | 'stretch' | 'footprint' | 'height';

/** A width, depth and height in metres. The renderer's unit, not the catalog's centimetres. */
export interface Box { w: number; d: number; h: number }

export interface ModelSpec {
  /** Path under `public/`, served as-is. */
  file: string;
  /**
   * The model's own size in metres, before `yaw`, as measured from the built .glb.
   *
   * Kept here rather than measured on load so that the choice between a model and a procedural
   * shape can be made before a single byte is fetched: no download for a piece that will not use
   * it, and no flicker from a shape that swaps itself out once the file lands. Rebuilding the
   * models can shift these by a fraction of a percent (simplification moves vertices about);
   * nothing depends on them to that precision, because the renderer scales to the box it actually
   * measures and only the accept/reject decision reads these numbers.
   */
  size: Box;
  /** Degrees about y that turn the model's front to +z, which is the front of every item here. */
  yaw?: 0 | 90 | 180 | 270;
  fit: FitMode;
}

/** `size` is written as it was measured: x, y (up), z. */
function spec(file: string, [x, y, z]: [number, number, number], fit: FitMode, yaw: 0 | 90 | 180 | 270 = 0): ModelSpec {
  return { file: `/models/${file}.glb`, size: { w: x, h: y, d: z }, fit, yaw };
}

const BED = spec('bed', [1.493, 1.534, 2.04], 'footprint');
const SOFA = spec('sofa', [1.571, 0.797, 0.658], 'stretch');
const ARMCHAIR = spec('armchair', [0.82, 1.023, 0.986], 'box');
const CHAIR = spec('chair', [0.43, 0.956, 0.539], 'box');
const STOOL = spec('stool', [0.483, 0.751, 0.486], 'stretch');
const DESK = spec('desk', [2.0, 0.787, 0.947], 'stretch');
const TABLE = spec('table', [1.134, 0.8, 0.706], 'stretch');
const COFFEE_TABLE = spec('coffee-table', [0.6, 0.39, 1.2], 'stretch', 90);
const SIDE_TABLE = spec('side-table', [0.55, 0.551, 0.45], 'box');
// Exported from Blender at ten times scale; the fit is a ratio, so only the proportions matter.
const SHELF = spec('shelf', [10.974, 21.392, 4.996], 'stretch');
const CUBE_SHELF = spec('cube-shelf', [0.368, 1.554, 1.076], 'stretch', 90);
const DRESSER = spec('dresser', [0.858, 0.545, 0.457], 'stretch');
const SIDEBOARD = spec('sideboard', [2.44, 0.68, 0.52], 'stretch');
const WARDROBE = spec('wardrobe', [1.141, 1.881, 0.488], 'stretch');
const PLANT = spec('plant', [0.701, 0.841, 0.657], 'height');
const PLANT_SMALL = spec('plant-small', [0.168, 0.267, 0.185], 'height');
const POUF = spec('pouf', [0.885, 0.624, 0.621], 'stretch');
const BENCH = spec('bench', [1.165, 0.889, 0.496], 'footprint');
const MIRROR = spec('mirror', [0.486, 0.744, 0.026], 'stretch');

/**
 * Models chosen for one catalog entry in particular.
 *
 * These win over the category and shape tables. Most are here because one shape covers pieces of
 * genuinely different kinds — `table` is a dining table and a coffee table and a nest of side
 * tables — and no single model can be all three.
 */
export const MODEL_BY_ID: Record<string, ModelSpec> = {
  'table-coffee-90': COFFEE_TABLE,
  'table-side-45': SIDE_TABLE,
  'table-nest-50': SIDE_TABLE,
  'candle-table-40': SIDE_TABLE,
  'shelf-cube-147': CUBE_SHELF,
  'dresser-160': SIDEBOARD,
  'sideboard-200': SIDEBOARD,
  'plant-small': PLANT_SMALL,
  // The seed catalog files its stools under the `chair` shape, so they are named one by one.
  'stool-35': STOOL,
  'stool-bar-65': STOOL,
  'stool-bar-75': STOOL,
  'stool-step-40': STOOL,
  'pouf-50': POUF,
  'pouf-round-60': POUF,
  'ottoman-60': POUF,
  'bench-100': BENCH,
  'mirror-rect-80': MIRROR,
};

/** Armchairs are sofas by shape and nightstands are plain boxes, so both are keyed by category. */
export const MODEL_BY_CATEGORY: Partial<Record<Category, ModelSpec>> = {
  armchair: ARMCHAIR,
  nightstand: SIDE_TABLE,
  dresser: DRESSER,
};

export const MODEL_BY_SHAPE: Partial<Record<Shape, ModelSpec>> = {
  bed: BED,
  sofa: SOFA,
  chair: CHAIR,
  stool: STOOL,
  desk: DESK,
  table: TABLE,
  shelf: SHELF,
  wardrobe: WARDROBE,
  plant: PLANT,
  bench: BENCH,
};

/**
 * Entries that keep their procedural shape whatever the tables above say.
 *
 * A bunk bed is two beds and a ladder. Every proportion check it faces would pass, because its
 * footprint is a single bed's, and it would quietly render as one — a picture that contradicts
 * the item's own name. The procedural shape at least draws what the catalog says is there.
 */
const NEVER = new Set(['bed-bunk-90']);

/** The metric box a catalog entry claims, in the renderer's units. */
function wanted(cat: CatalogItem): Box {
  return { w: cat.width / 100, d: cat.depth / 100, h: cat.height / 100 };
}

/** The model's box after `yaw` has turned it to face +z. */
export function orientedSize(s: ModelSpec): Box {
  const turned = s.yaw === 90 || s.yaw === 270;
  return turned ? { w: s.size.d, d: s.size.w, h: s.size.h } : s.size;
}

/**
 * The model for a catalog entry — most specific key first — or null to keep the procedural shape.
 *
 * Null is not a failure. It is the answer for every piece with no model at all (rugs, lamps,
 * kitchen units, anything wall-mounted but a mirror) and for the pieces whose catalog size is too
 * far from the model's for the stretch to stay believable.
 */
export function modelFor(cat: CatalogItem): ModelSpec | null {
  if (NEVER.has(cat.id)) return null;
  const s = MODEL_BY_ID[cat.id] ?? MODEL_BY_CATEGORY[cat.category] ?? MODEL_BY_SHAPE[cat.shape] ?? null;
  return s && fitsCatalog(orientedSize(s), wanted(cat), s.fit) ? s : null;
}

/** Every distinct file the registry can ask for: what the room preloads before it needs them. */
export function allModelFiles(): string[] {
  const seen = new Set<string>();
  for (const table of [MODEL_BY_ID, MODEL_BY_CATEGORY, MODEL_BY_SHAPE]) {
    for (const s of Object.values(table)) if (s) seen.add(s.file);
  }
  return [...seen];
}

const spread = (v: number[]) => Math.max(...v) / Math.min(...v);
/**
 * How far the axis scales may diverge before the model stops being a photograph of anything.
 *
 * Two is generous on purpose: a desk half as wide as the one that was photographed is still a
 * desk, and a sideboard a third longer is a product that exists. Past that — the corner sofa
 * three times deeper than the settee, the bookcase squashed to a shoe rack — the picture is
 * simply wrong, and a shape built to the catalog's own numbers is the better answer.
 */
const MAX_SPREAD = 2;

/** Whether a model can honestly stand in for a catalog entry of this size. */
export function fitsCatalog(box: Box, want: Box, mode: FitMode): boolean {
  if (box.w <= 0 || box.d <= 0 || box.h <= 0) return false;
  const sx = want.w / box.w, sy = want.h / box.h, sz = want.d / box.d;
  switch (mode) {
    case 'stretch': return spread([sx, sy, sz]) <= MAX_SPREAD;
    case 'footprint': return spread([sx, sz]) <= MAX_SPREAD;
    // `box` shrinks to fit and `height` clamps its own overhang, so neither can go far wrong.
    default: return true;
  }
}

/**
 * The scale to draw a model at, in the item's own frame.
 *
 * `box` is the model's real size once loaded and turned to face +z, `want` what the catalog says
 * the item measures. Both in metres. Callers are expected to have asked `fitsCatalog` first; this
 * always answers, so a model that has already been fetched is always drawn.
 */
export function fitScale(box: Box, want: Box, mode: FitMode): [number, number, number] {
  const sx = want.w / box.w, sy = want.h / box.h, sz = want.d / box.d;
  switch (mode) {
    case 'stretch':
      return [sx, sy, sz];
    case 'footprint': {
      const s = Math.sqrt(sx * sz);
      return [sx, s, sz];
    }
    case 'height': {
      // Foliage may overhang its pot, but only so far: past 1.5× the footprint a plant stops
      // reading as a thing standing in that spot and starts reading as a mistake.
      const s = Math.min(sy, 1.5 * Math.min(sx, sz));
      return [s, s, s];
    }
    default: {
      if (spread([sx, sy, sz]) <= 1.25) return [sx, sy, sz];
      const s = Math.min(sx, sy, sz);
      return [s, s, s];
    }
  }
}
