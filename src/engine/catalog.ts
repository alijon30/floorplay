// src/engine/catalog.ts
import type { CatalogItem, Category, Clearance, Room, RoomKind, Shape } from './types';
import { finish } from './materials';

function seed(
  id: string, name: string, category: Category, width: number, depth: number, height: number,
  price: number, color: string, shape: Shape, clearance: Clearance, blocksLight: boolean,
  rooms: RoomKind[], extra: { colors?: string[]; mountHeight?: number } = {},
): CatalogItem {
  return { id, name, category, width, depth, height, price, color, shape, clearance, blocksLight, source: 'seed', rooms, ...extra };
}

/**
 * Does this item sit on the floor and take up room on it?
 *
 * False for rugs, which everything else is allowed to stand on, and for wall-mounted items,
 * which hang above the floor entirely. Both are still bounds-checked, but they take part in no
 * overlap, clearance, reachability, free-floor or daylight calculation, so a picture may hang
 * over a sofa and a mirror above a desk without either reading as a collision.
 */
export function isFloorSolid(cat: CatalogItem): boolean {
  return cat.category !== 'rug' && cat.mountHeight === undefined;
}

/** Wall-mounted items hang at `mountHeight`; everything else stands on the floor. */
export function isMounted(cat: CatalogItem): boolean {
  return cat.mountHeight !== undefined;
}

/*
 * Every colour below is a named finish from `materials.ts`, never a loose hex.
 *
 * That is what lets the 3D view shade a piece by what it is made of: `materialTypeOf` reads the
 * hex back and returns wood, fabric, metal, surface or leaf, so an oak table gets grain and a
 * linen sofa gets a weave without either carrying a material field through the whole app.
 */
const OAK = finish('oak'), WALNUT = finish('walnut'), ASH = finish('ash'), BLACK_STAIN = finish('black-stain'), WHITE_OAK = finish('white-oak');
const LINEN = finish('linen'), CHARCOAL = finish('charcoal'), NAVY = finish('navy'), SAGE = finish('sage');
const TERRACOTTA = finish('terracotta'), MUSTARD = finish('mustard'), BLUSH = finish('blush'), FOREST = finish('forest'), STONE = finish('stone');
const BLACK_METAL = finish('black-metal'), BRASS = finish('brass'), STEEL = finish('steel');
const WHITE = finish('white'), GRAPHITE = finish('graphite');
const LEAF = finish('leaf'), DEEP_LEAF = finish('deep-leaf');

/** Upholstery: a bed head, a sofa, an armchair, a pouf. Warm and cool tones on the same rail. */
const BED_FABRIC = [LINEN, TERRACOTTA, NAVY, CHARCOAL];
const SOFA_FABRIC = [NAVY, SAGE, TERRACOTTA, LINEN];
const ARM_FABRIC = [TERRACOTTA, NAVY, SAGE, CHARCOAL];
const RUG_TONES = [TERRACOTTA, NAVY, SAGE, LINEN];
/** Carcass finishes: painted white first, then the three woods a showroom actually stocks. */
const CARCASS = [WHITE, WHITE_OAK, WALNUT, CHARCOAL];
const WOOD_SET = [OAK, WHITE_OAK, WALNUT, CHARCOAL];
/** Picture and mirror frames. */
const FRAME_TONES = [BLACK_METAL, OAK, WHITE, BRASS];

export const SEED_CATALOG: CatalogItem[] = [
  // beds — the headboard is upholstered, so a bed is named by its fabric
  seed('bed-single-90', 'Single bed', 'bed', 90, 200, 45, 249, LINEN, 'bed', { anyLongSide: 60 }, false, ['bedroom', 'kids', 'studio'], { colors: BED_FABRIC }),
  seed('bed-double-140', 'Double bed', 'bed', 140, 200, 45, 399, LINEN, 'bed', { anyLongSide: 60 }, false, ['bedroom', 'studio'], { colors: BED_FABRIC }),
  seed('bed-queen-160', 'Queen bed', 'bed', 160, 200, 45, 499, LINEN, 'bed', { anyLongSide: 60 }, false, ['bedroom', 'studio'], { colors: BED_FABRIC }),
  seed('bed-daybed-90', 'Daybed', 'bed', 200, 90, 80, 329, SAGE, 'sofa', { front: 50 }, false, ['bedroom', 'living', 'studio'], { colors: [SAGE, LINEN, TERRACOTTA, CHARCOAL] }),
  seed('bed-king-180', 'King bed', 'bed', 180, 210, 45, 649, LINEN, 'bed', { anyLongSide: 60 }, false, ['bedroom'], { colors: BED_FABRIC }),
  seed('bed-bunk-90', 'Bunk bed', 'bed', 90, 200, 165, 549, WHITE, 'bed', { anyLongSide: 60 }, true, ['kids'], { colors: [WHITE, OAK, SAGE, CHARCOAL] }),
  seed('crib-70', 'Crib', 'bed', 70, 130, 95, 449, WHITE, 'crib', { anyLongSide: 60 }, false, ['kids', 'bedroom'], { colors: [WHITE, ASH, OAK] }),
  seed('crib-convertible-80', 'Convertible crib', 'bed', 80, 145, 95, 529, OAK, 'crib', { anyLongSide: 60 }, false, ['kids'], { colors: [OAK, WHITE, SAGE] }),
  // sofas
  seed('sofa-2', 'Two-seat sofa', 'sofa', 160, 85, 80, 449, NAVY, 'sofa', { front: 60 }, false, ['living', 'studio'], { colors: SOFA_FABRIC }),
  seed('sofa-3', 'Three-seat sofa', 'sofa', 220, 90, 85, 699, NAVY, 'sofa', { front: 60 }, false, ['living'], { colors: SOFA_FABRIC }),
  seed('loveseat-140', 'Loveseat', 'sofa', 140, 80, 80, 349, SAGE, 'sofa', { front: 60 }, false, ['living', 'studio'], { colors: [SAGE, NAVY, TERRACOTTA, LINEN] }),
  seed('sofa-bed-190', 'Sofa bed', 'sofa', 190, 95, 85, 599, CHARCOAL, 'sofa', { front: 60 }, false, ['living', 'studio'], { colors: [CHARCOAL, NAVY, SAGE, LINEN] }),
  seed('sofa-corner-260', 'Corner sofa', 'sofa', 260, 180, 85, 999, NAVY, 'sofa', { front: 60 }, false, ['living'], { colors: SOFA_FABRIC }),
  // armchairs
  seed('armchair-80', 'Armchair', 'armchair', 80, 85, 90, 199, TERRACOTTA, 'sofa', { front: 50 }, false, ['living', 'bedroom', 'studio'], { colors: ARM_FABRIC }),
  seed('armchair-70', 'Compact armchair', 'armchair', 70, 75, 85, 149, TERRACOTTA, 'sofa', { front: 50 }, false, ['living', 'office', 'studio'], { colors: ARM_FABRIC }),
  seed('armchair-lounge-90', 'Lounge chair', 'armchair', 90, 90, 95, 299, FOREST, 'sofa', { front: 50 }, false, ['living', 'office'], { colors: [FOREST, TERRACOTTA, NAVY, LINEN] }),
  // desks
  seed('desk-100', 'Desk 100', 'desk', 100, 50, 75, 89, OAK, 'desk', { front: 90 }, false, ['office', 'bedroom', 'kids', 'studio']),
  seed('desk-120', 'Desk 120', 'desk', 120, 60, 75, 129, OAK, 'desk', { front: 90 }, false, ['office', 'studio']),
  seed('desk-140', 'Desk 140', 'desk', 140, 70, 75, 179, WALNUT, 'desk', { front: 90 }, false, ['office']),
  seed('desk-standing-120', 'Standing desk', 'desk', 120, 60, 120, 349, WHITE, 'desk', { front: 90 }, false, ['office']),
  // chairs
  seed('chair-office', 'Office chair', 'chair', 60, 60, 100, 129, CHARCOAL, 'chair', {}, false, ['office', 'studio', 'kids'], { colors: [CHARCOAL, NAVY, STONE] }),
  seed('chair-dining', 'Dining chair', 'chair', 45, 50, 85, 59, WALNUT, 'chair', {}, false, ['dining', 'kitchen', 'studio'], { colors: [WALNUT, OAK, WHITE, CHARCOAL] }),
  seed('stool-35', 'Stool', 'chair', 35, 35, 70, 39, OAK, 'chair', {}, false, ['kitchen', 'studio', 'hall'], { colors: [OAK, WHITE, BLACK_METAL] }),
  seed('chair-armless-45', 'Armless chair', 'chair', 45, 52, 80, 69, SAGE, 'chair', {}, false, ['dining', 'kitchen', 'office'], { colors: [SAGE, LINEN, CHARCOAL, OAK] }),
  seed('chair-kids-30', 'Kids chair', 'chair', 30, 32, 55, 29, MUSTARD, 'chair', {}, false, ['kids'], { colors: [MUSTARD, SAGE, NAVY] }),
  seed('stool-bar-65', 'Bar stool 65', 'chair', 35, 35, 65, 49, BLACK_METAL, 'stool', {}, false, ['kitchen', 'dining', 'studio'], { colors: [BLACK_METAL, OAK, WHITE] }),
  seed('stool-bar-75', 'Bar stool 75', 'chair', 38, 38, 75, 59, OAK, 'stool', {}, false, ['kitchen', 'dining'], { colors: [OAK, BLACK_METAL, WHITE] }),
  seed('stool-step-40', 'Step stool', 'chair', 40, 35, 45, 25, WHITE, 'stool', {}, false, ['kitchen', 'kids', 'hall'], { colors: [WHITE, OAK, BLACK_METAL] }),
  // tables
  seed('table-dining-120', 'Dining table 120', 'table', 120, 75, 75, 199, OAK, 'table', { front: 60, back: 60 }, false, ['dining', 'kitchen', 'studio']),
  seed('table-dining-80', 'Square table 80', 'table', 80, 80, 75, 129, OAK, 'table', { front: 60, back: 60 }, false, ['kitchen', 'dining', 'studio']),
  seed('table-round-100', 'Round table 100', 'table', 100, 100, 75, 229, WHITE_OAK, 'table', { front: 60, back: 60 }, false, ['dining', 'kitchen']),
  seed('table-coffee-90', 'Coffee table', 'table', 90, 50, 45, 79, WALNUT, 'table', {}, false, ['living', 'studio']),
  seed('table-side-45', 'Side table', 'table', 45, 45, 50, 39, WALNUT, 'table', {}, false, ['living', 'bedroom', 'studio']),
  seed('table-dining-160', 'Dining table 160', 'table', 160, 90, 75, 299, OAK, 'table', { front: 60, back: 60 }, false, ['dining']),
  seed('table-dining-200', 'Dining table 200', 'table', 200, 100, 75, 399, WALNUT, 'table', { front: 60, back: 60 }, false, ['dining']),
  seed('table-console-100', 'Console table', 'table', 100, 35, 80, 129, ASH, 'table', {}, false, ['hall', 'living']),
  seed('table-nest-50', 'Nesting tables', 'table', 50, 50, 45, 69, WHITE, 'table', {}, false, ['living', 'studio']),
  // wardrobes
  seed('wardrobe-80', 'Wardrobe 80', 'wardrobe', 80, 50, 180, 199, WHITE, 'wardrobe', { front: 60 }, true, ['bedroom', 'hall', 'studio'], { colors: CARCASS }),
  seed('wardrobe-100', 'Wardrobe 100', 'wardrobe', 100, 60, 200, 299, WHITE, 'wardrobe', { front: 60 }, true, ['bedroom', 'studio'], { colors: CARCASS }),
  seed('wardrobe-150', 'Wardrobe 150', 'wardrobe', 150, 60, 200, 449, WHITE, 'wardrobe', { front: 60 }, true, ['bedroom'], { colors: CARCASS }),
  seed('clothes-rail-100', 'Clothes rail', 'wardrobe', 100, 45, 160, 49, BLACK_METAL, 'shelf', { front: 60 }, true, ['bedroom', 'hall', 'studio'], { colors: [BLACK_METAL, WHITE, OAK] }),
  seed('wardrobe-200', 'Wardrobe 200', 'wardrobe', 200, 60, 200, 599, WHITE, 'wardrobe', { front: 60 }, true, ['bedroom'], { colors: CARCASS }),
  seed('wardrobe-corner-100', 'Corner wardrobe', 'wardrobe', 100, 100, 200, 499, WHITE, 'wardrobe', { front: 60 }, true, ['bedroom', 'kids'], { colors: CARCASS }),
  // shelves
  seed('shelf-80', 'Bookshelf 80', 'shelf', 80, 30, 180, 99, ASH, 'shelf', { front: 40 }, true, ['living', 'office', 'studio']),
  seed('shelf-60', 'Bookshelf 60', 'shelf', 60, 30, 120, 59, ASH, 'shelf', { front: 40 }, true, ['living', 'office', 'kids', 'studio']),
  seed('shelf-cube-147', 'Cube shelf 4x4', 'shelf', 147, 39, 147, 179, WHITE, 'shelf', { front: 40 }, true, ['living', 'kids', 'office']),
  seed('shelf-low-120', 'Low shelf 120', 'shelf', 120, 30, 80, 89, ASH, 'shelf', { front: 40 }, false, ['living', 'hall', 'kids', 'studio']),
  seed('shelf-tall-200', 'Tall bookshelf', 'shelf', 90, 35, 200, 179, WHITE_OAK, 'shelf', { front: 40 }, true, ['office', 'living']),
  seed('shelf-ladder-60', 'Ladder shelf', 'shelf', 60, 40, 180, 119, OAK, 'shelf', { front: 40 }, true, ['living', 'office', 'studio']),
  // dressers
  seed('dresser-80', 'Dresser 80', 'dresser', 80, 40, 80, 149, OAK, 'box', { front: 60 }, false, ['bedroom', 'kids', 'studio'], { colors: WOOD_SET }),
  seed('dresser-100', 'Dresser 100', 'dresser', 100, 45, 90, 199, OAK, 'box', { front: 60 }, false, ['bedroom', 'studio'], { colors: WOOD_SET }),
  seed('dresser-160', 'Sideboard 160', 'dresser', 160, 45, 80, 299, OAK, 'box', { front: 60 }, false, ['living', 'dining'], { colors: WOOD_SET }),
  seed('dresser-60', 'Narrow dresser', 'dresser', 60, 40, 100, 129, OAK, 'box', { front: 60 }, false, ['bedroom', 'hall', 'kids'], { colors: WOOD_SET }),
  seed('sideboard-200', 'Sideboard 200', 'dresser', 200, 45, 80, 399, WALNUT, 'box', { front: 60 }, false, ['dining', 'living'], { colors: [WALNUT, OAK, WHITE_OAK, CHARCOAL] }),
  // nightstands
  seed('nightstand-45', 'Nightstand', 'nightstand', 45, 40, 55, 49, OAK, 'box', {}, false, ['bedroom', 'studio']),
  seed('nightstand-40', 'Small nightstand', 'nightstand', 40, 35, 50, 39, OAK, 'box', {}, false, ['bedroom', 'kids', 'studio']),
  seed('nightstand-open-45', 'Open nightstand', 'nightstand', 45, 40, 60, 59, WALNUT, 'box', {}, false, ['bedroom']),
  // rugs
  seed('rug-120x180', 'Rug 120x180', 'rug', 120, 180, 1, 59, TERRACOTTA, 'rug', {}, false, ['living', 'bedroom', 'studio'], { colors: RUG_TONES }),
  seed('rug-160x230', 'Rug 160x230', 'rug', 160, 230, 1, 89, TERRACOTTA, 'rug', {}, false, ['living', 'bedroom', 'studio'], { colors: RUG_TONES }),
  seed('rug-200x300', 'Rug 200x300', 'rug', 200, 300, 1, 149, TERRACOTTA, 'rug', {}, false, ['living', 'dining'], { colors: RUG_TONES }),
  seed('rug-round-200', 'Round rug 200', 'rug', 200, 200, 1, 129, TERRACOTTA, 'rug', {}, false, ['living', 'kids', 'studio'], { colors: RUG_TONES }),
  seed('rug-80x150', 'Runner 80x150', 'rug', 80, 150, 1, 45, TERRACOTTA, 'rug', {}, false, ['hall', 'kitchen'], { colors: RUG_TONES }),
  seed('rug-round-140', 'Round rug 140', 'rug', 140, 140, 1, 79, SAGE, 'rug', {}, false, ['kids', 'bedroom', 'studio'], { colors: [SAGE, TERRACOTTA, NAVY, LINEN] }),
  seed('rug-240x340', 'Rug 240x340', 'rug', 240, 340, 1, 199, NAVY, 'rug', {}, false, ['living', 'dining'], { colors: [NAVY, TERRACOTTA, SAGE, LINEN] }),
  // lamps — the colour names the stem and base; every shade is warm linen, lit from inside
  seed('lamp-floor', 'Floor lamp', 'lamp', 30, 30, 160, 49, BLACK_METAL, 'lamp', {}, false, ['living', 'bedroom', 'office', 'studio']),
  seed('lamp-arc', 'Arc lamp', 'lamp', 60, 40, 180, 129, BRASS, 'lamp', {}, false, ['living', 'studio']),
  seed('lamp-table-40', 'Table lamp', 'lamp', 25, 25, 45, 35, BRASS, 'lamp', {}, false, ['bedroom', 'living', 'office', 'studio']),
  seed('lamp-tripod-50', 'Tripod lamp', 'lamp', 50, 50, 150, 89, BLACK_METAL, 'lamp', {}, false, ['living', 'office']),
  seed('pendant-40', 'Pendant lamp', 'lamp', 40, 40, 35, 69, BRASS, 'lamp', {}, false, ['dining', 'kitchen', 'living'], { mountHeight: 190 }),
  // plants
  seed('plant-large', 'Large plant', 'plant', 50, 50, 160, 89, LEAF, 'plant', {}, false, ['living', 'office', 'hall', 'studio']),
  seed('plant-medium', 'Medium plant', 'plant', 35, 35, 100, 39, LEAF, 'plant', {}, false, ['living', 'bedroom', 'office', 'studio']),
  seed('plant-small', 'Small plant', 'plant', 25, 25, 50, 19, LEAF, 'plant', {}, false, ['kitchen', 'office', 'bedroom', 'studio']),
  seed('plant-tall-180', 'Tall palm', 'plant', 60, 60, 180, 129, DEEP_LEAF, 'plant', {}, false, ['living', 'hall']),
  // tv
  seed('tv-stand-120', 'TV stand 120', 'tv', 120, 40, 50, 129, GRAPHITE, 'tv', { front: 100 }, false, ['living', 'bedroom', 'studio']),
  seed('tv-stand-160', 'TV stand 160', 'tv', 160, 40, 50, 179, GRAPHITE, 'tv', { front: 100 }, false, ['living', 'studio']),
  seed('tv-stand-180', 'TV stand 180', 'tv', 180, 45, 50, 249, GRAPHITE, 'tv', { front: 100 }, false, ['living']),
  seed('media-unit-200', 'Media unit', 'tv', 200, 45, 120, 399, GRAPHITE, 'tv', { front: 100 }, true, ['living']),
  // kitchen
  seed('counter-120', 'Kitchen counter 120', 'kitchen', 120, 60, 90, 249, WHITE, 'counter', { front: 90 }, false, ['kitchen', 'studio']),
  seed('counter-180', 'Kitchen counter 180', 'kitchen', 180, 60, 90, 349, WHITE, 'counter', { front: 90 }, false, ['kitchen']),
  seed('counter-corner-90', 'Corner counter', 'kitchen', 90, 90, 90, 219, WHITE, 'counter', { front: 90 }, false, ['kitchen']),
  seed('sink-unit-80', 'Sink unit 80', 'kitchen', 80, 60, 90, 279, WHITE, 'counter', { front: 90 }, false, ['kitchen', 'studio']),
  seed('island-120', 'Kitchen island 120', 'kitchen', 120, 80, 90, 449, GRAPHITE, 'counter', { front: 90, back: 90 }, false, ['kitchen']),
  seed('island-160', 'Kitchen island 160', 'kitchen', 160, 90, 90, 599, SAGE, 'counter', { front: 90, back: 90 }, false, ['kitchen']),
  seed('breakfast-bar-140', 'Breakfast bar', 'kitchen', 140, 45, 105, 299, OAK, 'counter', { front: 90 }, false, ['kitchen', 'dining', 'studio']),
  seed('pantry-60', 'Pantry cabinet 60', 'kitchen', 60, 60, 200, 349, WHITE, 'wardrobe', { front: 60 }, true, ['kitchen']),
  seed('pantry-90', 'Pantry cabinet 90', 'kitchen', 90, 60, 200, 449, WHITE, 'wardrobe', { front: 60 }, true, ['kitchen']),
  seed('kitchen-wall-cab-80', 'Wall cabinet 80', 'kitchen', 80, 35, 70, 199, WHITE, 'wallshelf', {}, false, ['kitchen'], { mountHeight: 140 }),
  // appliances
  seed('fridge-60', 'Fridge 60', 'appliance', 60, 65, 180, 599, STEEL, 'appliance', { front: 60 }, true, ['kitchen', 'studio']),
  seed('fridge-tall-70', 'Fridge freezer 70', 'appliance', 70, 70, 200, 799, STEEL, 'appliance', { front: 60 }, true, ['kitchen']),
  seed('freezer-chest-90', 'Chest freezer', 'appliance', 90, 60, 85, 449, WHITE, 'appliance', { front: 60 }, false, ['kitchen']),
  seed('oven-60', 'Oven 60', 'appliance', 60, 60, 90, 449, GRAPHITE, 'appliance', { front: 60 }, false, ['kitchen', 'studio']),
  seed('range-cooker-90', 'Range cooker 90', 'appliance', 90, 60, 90, 699, GRAPHITE, 'appliance', { front: 60 }, false, ['kitchen']),
  seed('dishwasher-60', 'Dishwasher', 'appliance', 60, 60, 85, 399, STEEL, 'appliance', { front: 60 }, false, ['kitchen']),
  seed('washer-60', 'Washing machine', 'appliance', 60, 60, 85, 349, WHITE, 'appliance', { front: 60 }, false, ['kitchen', 'hall']),
  seed('dryer-60', 'Tumble dryer', 'appliance', 60, 60, 85, 329, WHITE, 'appliance', { front: 60 }, false, ['kitchen', 'hall']),
  seed('microwave-50', 'Microwave', 'appliance', 50, 38, 30, 129, GRAPHITE, 'appliance', {}, false, ['kitchen'], { mountHeight: 150 }),
  seed('extractor-60', 'Extractor hood', 'appliance', 60, 50, 55, 249, STEEL, 'appliance', {}, false, ['kitchen'], { mountHeight: 150 }),
  // storage
  seed('shoe-rack-80', 'Shoe rack', 'storage', 80, 30, 50, 49, OAK, 'shelf', { front: 60 }, false, ['hall']),
  seed('shoe-cabinet-100', 'Shoe cabinet', 'storage', 100, 30, 100, 129, WHITE, 'box', { front: 60 }, false, ['hall']),
  seed('coat-rack-60', 'Coat rack', 'storage', 60, 40, 180, 59, BLACK_METAL, 'shelf', { front: 60 }, false, ['hall', 'office']),
  seed('bar-cart-70', 'Bar cart', 'storage', 70, 45, 85, 149, BRASS, 'box', { front: 60 }, false, ['living', 'dining']),
  seed('chest-100', 'Storage chest', 'storage', 100, 45, 50, 149, OAK, 'box', { front: 60 }, false, ['bedroom', 'living', 'hall']),
  seed('cabinet-90', 'Storage cabinet 90', 'storage', 90, 45, 180, 299, WHITE, 'wardrobe', { front: 60 }, true, ['office', 'hall', 'living']),
  seed('cabinet-120', 'Storage cabinet 120', 'storage', 120, 45, 120, 249, WHITE, 'box', { front: 60 }, false, ['office', 'living', 'hall']),
  seed('laundry-basket-40', 'Laundry basket', 'storage', 40, 40, 60, 29, LINEN, 'box', { front: 60 }, false, ['bedroom', 'hall', 'kitchen']),
  seed('toy-box-80', 'Toy box', 'storage', 80, 45, 50, 89, SAGE, 'box', { front: 60 }, false, ['kids']),
  seed('filing-cabinet-45', 'Filing cabinet', 'storage', 45, 60, 110, 179, GRAPHITE, 'box', { front: 60 }, false, ['office']),
  seed('bench-hall-90', 'Hall bench', 'storage', 90, 38, 45, 99, OAK, 'bench', { front: 60 }, false, ['hall']),
  seed('bench-storage-120', 'Storage bench', 'storage', 120, 40, 50, 169, WHITE, 'bench', { front: 60 }, false, ['hall', 'bedroom']),
  // decor
  seed('ottoman-60', 'Storage ottoman', 'decor', 60, 40, 45, 69, TERRACOTTA, 'box', {}, false, ['living', 'bedroom', 'studio'], { colors: ARM_FABRIC }),
  seed('pouf-50', 'Pouf', 'decor', 50, 50, 40, 59, MUSTARD, 'pouf', {}, false, ['living', 'kids', 'studio'], { colors: [MUSTARD, TERRACOTTA, NAVY, CHARCOAL] }),
  seed('pouf-round-60', 'Round pouf', 'decor', 60, 60, 45, 79, SAGE, 'pouf', {}, false, ['living', 'bedroom'], { colors: [SAGE, TERRACOTTA, NAVY, CHARCOAL] }),
  seed('bean-bag-90', 'Bean bag', 'decor', 90, 90, 70, 99, NAVY, 'pouf', {}, false, ['kids', 'living'], { colors: [NAVY, SAGE, MUSTARD, CHARCOAL] }),
  seed('floor-basket-45', 'Floor basket', 'decor', 45, 45, 40, 35, LINEN, 'pouf', {}, false, ['living', 'bedroom', 'kids'], { colors: [LINEN, OAK, SAGE] }),
  seed('pet-bed-70', 'Pet bed', 'decor', 70, 50, 20, 59, SAGE, 'pouf', {}, false, ['living', 'bedroom', 'hall'], { colors: [SAGE, BLUSH, NAVY] }),
  seed('vase-stand-35', 'Vase stand', 'decor', 35, 35, 70, 49, WHITE, 'box', {}, false, ['living', 'hall'], { colors: [WHITE, BLACK_STAIN, OAK] }),
  seed('candle-table-40', 'Candle table', 'decor', 40, 40, 45, 39, WALNUT, 'table', {}, false, ['living', 'bedroom', 'studio'], { colors: [WALNUT, BLACK_METAL, WHITE] }),
  seed('sculpture-stand-30', 'Sculpture stand', 'decor', 30, 30, 100, 69, BLACK_STAIN, 'box', {}, false, ['living', 'hall', 'office'], { colors: [BLACK_STAIN, WHITE, OAK] }),
  seed('magazine-rack-40', 'Magazine rack', 'decor', 40, 25, 45, 29, OAK, 'box', {}, false, ['living', 'office', 'studio'], { colors: [OAK, BLACK_METAL, SAGE] }),
  seed('screen-divider-150', 'Screen divider', 'decor', 150, 30, 170, 199, LINEN, 'box', {}, true, ['studio', 'living', 'bedroom'], { colors: [LINEN, OAK, CHARCOAL] }),
  // wall-mounted
  seed('picture-40', 'Framed print 40', 'wall', 40, 4, 50, 29, BLACK_METAL, 'picture', {}, false, ['living', 'bedroom', 'hall', 'office', 'studio'], { colors: FRAME_TONES, mountHeight: 120 }),
  seed('picture-60', 'Framed print 60', 'wall', 60, 4, 80, 49, BLACK_METAL, 'picture', {}, false, ['living', 'bedroom', 'office', 'studio'], { colors: FRAME_TONES, mountHeight: 110 }),
  seed('picture-90', 'Large print 90', 'wall', 90, 5, 120, 89, BLACK_METAL, 'picture', {}, false, ['living', 'dining'], { colors: FRAME_TONES, mountHeight: 100 }),
  seed('gallery-set-120', 'Gallery wall set', 'wall', 120, 4, 90, 129, OAK, 'picture', {}, false, ['living', 'hall', 'studio'], { colors: [OAK, BLACK_METAL, WHITE, BRASS], mountHeight: 100 }),
  seed('pinboard-80', 'Pinboard 80', 'wall', 80, 4, 60, 45, ASH, 'picture', {}, false, ['office', 'kids'], { colors: [ASH, BLACK_METAL, SAGE], mountHeight: 110 }),
  seed('wall-clock-30', 'Wall clock', 'wall', 30, 5, 30, 39, BLACK_METAL, 'picture', {}, false, ['kitchen', 'living', 'hall', 'office'], { colors: [BLACK_METAL, WHITE, BRASS], mountHeight: 180 }),
  seed('mirror-round-60', 'Round wall mirror', 'wall', 60, 5, 60, 79, STEEL, 'mirror', {}, false, ['hall', 'bedroom', 'living'], { colors: [STEEL, BLACK_METAL, BRASS], mountHeight: 110 }),
  seed('mirror-rect-80', 'Wall mirror 80', 'wall', 80, 5, 120, 129, STEEL, 'mirror', {}, false, ['bedroom', 'hall'], { colors: [STEEL, BLACK_METAL, OAK], mountHeight: 90 }),
  seed('wall-shelf-60', 'Wall shelf 60', 'wall', 60, 20, 20, 39, ASH, 'wallshelf', {}, false, ['living', 'kitchen', 'office', 'studio'], { mountHeight: 140 }),
  seed('wall-shelf-100', 'Wall shelf 100', 'wall', 100, 22, 20, 59, ASH, 'wallshelf', {}, false, ['living', 'office', 'kids'], { mountHeight: 140 }),
  seed('curtain-140', 'Curtain pair 140', 'wall', 140, 10, 215, 89, LINEN, 'curtain', {}, false, ['living', 'bedroom', 'studio'], { colors: [LINEN, SAGE, NAVY, TERRACOTTA], mountHeight: 5 }),
  seed('curtain-200', 'Curtain pair 200', 'wall', 200, 10, 215, 129, LINEN, 'curtain', {}, false, ['living', 'bedroom'], { colors: [LINEN, SAGE, NAVY, TERRACOTTA], mountHeight: 5 }),
  seed('coat-hooks-60', 'Coat hooks', 'wall', 60, 10, 15, 25, BLACK_METAL, 'hooks', {}, false, ['hall', 'kids'], { mountHeight: 160 }),
  seed('hook-rail-90', 'Hook rail 90', 'wall', 90, 10, 15, 35, OAK, 'hooks', {}, false, ['hall', 'kitchen'], { mountHeight: 160 }),
  seed('wall-tv-90', 'Wall TV 90', 'wall', 90, 8, 55, 449, GRAPHITE, 'tv', {}, false, ['living', 'bedroom', 'studio'], { mountHeight: 105 }),
  seed('wall-tv-120', 'Wall TV 120', 'wall', 120, 8, 70, 699, GRAPHITE, 'tv', {}, false, ['living'], { mountHeight: 100 }),
  // other
  seed('mirror-floor', 'Floor mirror', 'other', 50, 5, 170, 79, STEEL, 'box', {}, false, ['bedroom', 'hall', 'studio']),
  seed('bench-100', 'Bench', 'other', 100, 35, 45, 89, WALNUT, 'box', {}, false, ['hall', 'dining', 'studio']),
  seed('bench-dining-140', 'Dining bench', 'other', 140, 38, 45, 129, OAK, 'bench', {}, false, ['dining', 'kitchen']),
];

export function catalogFor(room: Room): CatalogItem[] {
  return [...SEED_CATALOG, ...room.catalogExtras];
}

export function findCatalogItem(room: Room, id: string): CatalogItem | undefined {
  return room.catalogExtras.find((i) => i.id === id) ?? SEED_CATALOG.find((i) => i.id === id);
}

/** The color an item is drawn in: its own override when it has one, otherwise the catalog color. */
export function itemColor(cat: CatalogItem, override?: string): string {
  return override ?? cat.color;
}
