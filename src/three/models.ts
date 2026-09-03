// src/three/models.ts
/**
 * Which catalog pieces are drawn from a photographed model, and how each one is fitted.
 *
 * The 3D view has two ways to draw a chair. `Furniture.tsx` can build one out of rounded boxes
 * and turned legs, which is exact — it is the catalog's own dimensions made solid — plain by
 * construction, and always available. Or it can load a photographed one from `public/models`,
 * which is a real object with real light baked into it, and is only right for the items whose
 * proportions *and style* it actually matches.
 *
 * Style is the harder of the two. Poly Haven's furniture is mostly period and salvage: its beds
 * are a Gothic four-poster and a rusted hospital frame, every sofa is a Victorian settee, its
 * desks are scratched steel and its mirrors are gilt. Each is beautifully made and none of them
 * belongs in a plan for a modern rental, where the whole room has to read as one catalog. So the
 * models here are the short list Poly Haven itself files as `condition: clean` with modern or
 * minimalist tags, plus two plants and an ottoman whose forms carry no period at all. Beds, sofas,
 * desks, dining tables, stools, benches and mirrors keep their procedural geometry — not as a
 * shortfall, but because a plain box is closer to a modern bed than a four-poster is.
 *
 * `npm run models` fills the folder from `scripts/models.manifest.json`; everything here is about
 * placement: which catalog entries a model answers for, which way its front points, and how an
 * object of fixed proportions is fitted to a catalog entry of different ones. Where the two
 * disagree by too much, `modelFor` returns null and the procedural shape draws it instead.
 */
import type { CatalogItem, Category, Shape } from '../engine/types';

/**
 * How a model of fixed proportions is fitted to a catalog entry's width, depth and height.
 *
 * - `box` — match all three, unless that distorts the aspect by more than a quarter, in which
 *   case scale uniformly to fit inside the box and stand it in the middle. For anything whose
 *   silhouette people know by heart: armchairs, dining chairs, side tables.
 * - `stretch` — match all three outright. For rectilinear carcasses — sideboards, shelving,
 *   cabinets — where a wider or deeper version of the same piece is a real product rather than a
 *   distortion of one.
 * - `height` — match height; width and depth follow, capped at one and a half times the
 *   footprint. For foliage, which is allowed to spill over the pot it is filed under.
 */
export type FitMode = 'box' | 'stretch' | 'height';

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
   * measures and only the accept-or-reject decision reads these numbers.
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

const ARMCHAIR = spec('armchair', [0.820, 1.023, 0.986], 'box');
const CHAIR = spec('chair', [0.434, 0.973, 0.576], 'box');
const COFFEE_TABLE = spec('coffee-table', [0.600, 0.390, 1.200], 'stretch', 90);
const SIDE_TABLE = spec('side-table', [0.550, 0.551, 0.450], 'box');
// Exported from Blender at ten times scale; the fit is a ratio, so only the proportions matter.
const SHELF = spec('shelf', [10.974, 21.392, 4.996], 'stretch');
const CUBE_SHELF = spec('cube-shelf', [0.368, 1.554, 1.076], 'stretch', 90);
const SIDEBOARD = spec('sideboard', [2.440, 0.680, 0.520], 'stretch');
const WARDROBE = spec('wardrobe', [1.141, 1.881, 0.488], 'stretch');
const PLANT = spec('plant', [0.701, 0.841, 0.657], 'height');
const PLANT_SMALL = spec('plant-small', [0.168, 0.267, 0.185], 'height');
const POUF = spec('pouf', [0.885, 0.624, 0.621], 'stretch');

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
  'pouf-50': POUF,
  'pouf-round-60': POUF,
  'ottoman-60': POUF,
};

/** Armchairs are sofas by shape and nightstands are plain boxes, so both are keyed by category. */
export const MODEL_BY_CATEGORY: Partial<Record<Category, ModelSpec>> = {
  armchair: ARMCHAIR,
  nightstand: SIDE_TABLE,
};

export const MODEL_BY_SHAPE: Partial<Record<Shape, ModelSpec>> = {
  chair: CHAIR,
  shelf: SHELF,
  wardrobe: WARDROBE,
  plant: PLANT,
};

/**
 * Entries that keep their procedural shape whatever the tables above say.
 *
 * The seed catalog files its stools under the `chair` shape, and every proportion check they face
 * would pass, so each would quietly render as a dining chair — a picture that contradicts the
 * item's own name. Poly Haven has stools, but they are pub stools and workshop stools, aged and
 * ornate; the procedural one is a disc on a stem with a brass footring, which is both plainer and
 * actually a stool.
 */
const NEVER = new Set(['stool-35', 'stool-bar-65', 'stool-bar-75', 'stool-step-40']);

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
 * Null is not a failure. It is the answer for every piece with no model at all (beds, sofas,
 * desks, dining tables, rugs, lamps, kitchen units, and everything that hangs on a wall) and
 * for the pieces
 * whose catalog size is too far from the model's for the stretch to stay believable.
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
 * Two is generous on purpose: a sideboard a third longer is a product that exists, and a bookcase
 * two thirds the width of the one that was photographed is another shelf in the same range. Past
 * that — the two-metre shelving unit squashed into a 50 cm shoe rack, the chest of drawers pulled
 * to a metre tall — the picture is simply wrong, and a shape built to the catalog's own numbers is
 * the better answer.
 */
const MAX_SPREAD = 2;

/** Whether a model can honestly stand in for a catalog entry of this size. */
export function fitsCatalog(box: Box, want: Box, mode: FitMode): boolean {
  if (box.w <= 0 || box.d <= 0 || box.h <= 0) return false;
  const sx = want.w / box.w, sy = want.h / box.h, sz = want.d / box.d;
  // `box` shrinks to fit and `height` clamps its own overhang, so neither can go far wrong.
  return mode === 'stretch' ? spread([sx, sy, sz]) <= MAX_SPREAD : true;
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
