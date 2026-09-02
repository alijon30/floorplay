// src/engine/catalog.ts
import type { CatalogItem, Category, Clearance, Room, RoomKind, Shape } from './types';

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

const BED_WOOD = ['#b9a48b', '#8b6f52', '#e8e2d6', '#4a4f57'];
const FABRIC_BLUE = ['#6b7c93', '#8c9a7a', '#b58a6a', '#4a4f57'];
const FABRIC_BROWN = ['#8c6f5a', '#6b7c93', '#8c9a7a', '#3f4650'];
const RUG_TONES = ['#b56b5a', '#7d8aa0', '#8c9a7a', '#d8cbb3'];
const CARCASS_WHITE = ['#e8e2d6', '#b9a48b', '#8b6f52', '#4a4f57'];
const WOOD_WARM = ['#cbb9a0', '#e8e2d6', '#8b6f52', '#3e3e46'];
const FRAME_TONES = ['#3e3e46', '#b9a48b', '#e8e2d6', '#c9a227'];

export const SEED_CATALOG: CatalogItem[] = [
  // beds
  seed('bed-single-90', 'Single bed', 'bed', 90, 200, 45, 249, '#b9a48b', 'bed', { anyLongSide: 60 }, false, ['bedroom', 'kids', 'studio'], { colors: BED_WOOD }),
  seed('bed-double-140', 'Double bed', 'bed', 140, 200, 45, 399, '#b9a48b', 'bed', { anyLongSide: 60 }, false, ['bedroom', 'studio'], { colors: BED_WOOD }),
  seed('bed-queen-160', 'Queen bed', 'bed', 160, 200, 45, 499, '#b9a48b', 'bed', { anyLongSide: 60 }, false, ['bedroom', 'studio'], { colors: BED_WOOD }),
  seed('bed-daybed-90', 'Daybed', 'bed', 200, 90, 80, 329, '#a89f91', 'sofa', { front: 50 }, false, ['bedroom', 'living', 'studio'], { colors: ['#a89f91', '#6b7c93', '#b58a6a', '#4a4f57'] }),
  seed('bed-king-180', 'King bed', 'bed', 180, 210, 45, 649, '#b9a48b', 'bed', { anyLongSide: 60 }, false, ['bedroom'], { colors: BED_WOOD }),
  seed('bed-bunk-90', 'Bunk bed', 'bed', 90, 200, 165, 549, '#e8e2d6', 'bed', { anyLongSide: 60 }, true, ['kids'], { colors: ['#e8e2d6', '#b9a48b', '#8c9a7a', '#4a4f57'] }),
  seed('crib-70', 'Crib', 'bed', 70, 130, 95, 449, '#e8e2d6', 'crib', { anyLongSide: 60 }, false, ['kids', 'bedroom'], { colors: ['#e8e2d6', '#b9a48b', '#8b6f52'] }),
  seed('crib-convertible-80', 'Convertible crib', 'bed', 80, 145, 95, 529, '#b9a48b', 'crib', { anyLongSide: 60 }, false, ['kids'], { colors: ['#b9a48b', '#e8e2d6', '#8c9a7a'] }),
  // sofas
  seed('sofa-2', 'Two-seat sofa', 'sofa', 160, 85, 80, 449, '#6b7c93', 'sofa', { front: 60 }, false, ['living', 'studio'], { colors: FABRIC_BLUE }),
  seed('sofa-3', 'Three-seat sofa', 'sofa', 220, 90, 85, 699, '#6b7c93', 'sofa', { front: 60 }, false, ['living'], { colors: FABRIC_BLUE }),
  seed('loveseat-140', 'Loveseat', 'sofa', 140, 80, 80, 349, '#7d8aa0', 'sofa', { front: 60 }, false, ['living', 'studio'], { colors: ['#7d8aa0', '#8c9a7a', '#b58a6a', '#4a4f57'] }),
  seed('sofa-bed-190', 'Sofa bed', 'sofa', 190, 95, 85, 599, '#5f6f86', 'sofa', { front: 60 }, false, ['living', 'studio'], { colors: ['#5f6f86', '#8c9a7a', '#b58a6a', '#4a4f57'] }),
  seed('sofa-corner-260', 'Corner sofa', 'sofa', 260, 180, 85, 999, '#6b7c93', 'sofa', { front: 60 }, false, ['living'], { colors: FABRIC_BLUE }),
  // armchairs
  seed('armchair-80', 'Armchair', 'armchair', 80, 85, 90, 199, '#8c6f5a', 'sofa', { front: 50 }, false, ['living', 'bedroom', 'studio'], { colors: FABRIC_BROWN }),
  seed('armchair-70', 'Compact armchair', 'armchair', 70, 75, 85, 149, '#8c6f5a', 'sofa', { front: 50 }, false, ['living', 'office', 'studio'], { colors: FABRIC_BROWN }),
  seed('armchair-lounge-90', 'Lounge chair', 'armchair', 90, 90, 95, 299, '#8c9a7a', 'sofa', { front: 50 }, false, ['living', 'office'], { colors: ['#8c9a7a', '#8c6f5a', '#6b7c93', '#3f4650'] }),
  // desks
  seed('desk-100', 'Desk 100', 'desk', 100, 50, 75, 89, '#d9c8a9', 'desk', { front: 90 }, false, ['office', 'bedroom', 'kids', 'studio']),
  seed('desk-120', 'Desk 120', 'desk', 120, 60, 75, 129, '#d9c8a9', 'desk', { front: 90 }, false, ['office', 'studio']),
  seed('desk-140', 'Desk 140', 'desk', 140, 70, 75, 179, '#d9c8a9', 'desk', { front: 90 }, false, ['office']),
  seed('desk-standing-120', 'Standing desk', 'desk', 120, 60, 120, 349, '#cdbfa5', 'desk', { front: 90 }, false, ['office']),
  // chairs
  seed('chair-office', 'Office chair', 'chair', 60, 60, 100, 129, '#3e3e46', 'chair', {}, false, ['office', 'studio', 'kids'], { colors: ['#3e3e46', '#6b7c93', '#d9c8a9'] }),
  seed('chair-dining', 'Dining chair', 'chair', 45, 50, 85, 59, '#5a4a3f', 'chair', {}, false, ['dining', 'kitchen', 'studio'], { colors: ['#5a4a3f', '#e8e2d6', '#3e3e46', '#8c9a7a'] }),
  seed('stool-35', 'Stool', 'chair', 35, 35, 70, 39, '#5a4a3f', 'chair', {}, false, ['kitchen', 'studio', 'hall'], { colors: ['#5a4a3f', '#e8e2d6', '#3e3e46'] }),
  seed('chair-armless-45', 'Armless chair', 'chair', 45, 52, 80, 69, '#8c9a7a', 'chair', {}, false, ['dining', 'kitchen', 'office'], { colors: ['#8c9a7a', '#5a4a3f', '#e8e2d6', '#3e3e46'] }),
  seed('chair-kids-30', 'Kids chair', 'chair', 30, 32, 55, 29, '#b58a6a', 'chair', {}, false, ['kids'], { colors: ['#b58a6a', '#8c9a7a', '#6b7c93'] }),
  seed('stool-bar-65', 'Bar stool 65', 'chair', 35, 35, 65, 49, '#3e3e46', 'stool', {}, false, ['kitchen', 'dining', 'studio'], { colors: ['#3e3e46', '#b9a48b', '#e8e2d6'] }),
  seed('stool-bar-75', 'Bar stool 75', 'chair', 38, 38, 75, 59, '#b9a48b', 'stool', {}, false, ['kitchen', 'dining'], { colors: ['#b9a48b', '#3e3e46', '#e8e2d6'] }),
  seed('stool-step-40', 'Step stool', 'chair', 40, 35, 45, 25, '#e8e2d6', 'stool', {}, false, ['kitchen', 'kids', 'hall'], { colors: ['#e8e2d6', '#b9a48b', '#3e3e46'] }),
  // tables
  seed('table-dining-120', 'Dining table 120', 'table', 120, 75, 75, 199, '#c9b08d', 'table', { front: 60, back: 60 }, false, ['dining', 'kitchen', 'studio']),
  seed('table-dining-80', 'Square table 80', 'table', 80, 80, 75, 129, '#c9b08d', 'table', { front: 60, back: 60 }, false, ['kitchen', 'dining', 'studio']),
  seed('table-round-100', 'Round table 100', 'table', 100, 100, 75, 229, '#c9b08d', 'table', { front: 60, back: 60 }, false, ['dining', 'kitchen']),
  seed('table-coffee-90', 'Coffee table', 'table', 90, 50, 45, 79, '#a58b6a', 'table', {}, false, ['living', 'studio']),
  seed('table-side-45', 'Side table', 'table', 45, 45, 50, 39, '#a58b6a', 'table', {}, false, ['living', 'bedroom', 'studio']),
  seed('table-dining-160', 'Dining table 160', 'table', 160, 90, 75, 299, '#c9b08d', 'table', { front: 60, back: 60 }, false, ['dining']),
  seed('table-dining-200', 'Dining table 200', 'table', 200, 100, 75, 399, '#c9b08d', 'table', { front: 60, back: 60 }, false, ['dining']),
  seed('table-console-100', 'Console table', 'table', 100, 35, 80, 129, '#a58b6a', 'table', {}, false, ['hall', 'living']),
  seed('table-nest-50', 'Nesting tables', 'table', 50, 50, 45, 69, '#a58b6a', 'table', {}, false, ['living', 'studio']),
  // wardrobes
  seed('wardrobe-80', 'Wardrobe 80', 'wardrobe', 80, 50, 180, 199, '#e8e2d6', 'wardrobe', { front: 60 }, true, ['bedroom', 'hall', 'studio'], { colors: CARCASS_WHITE }),
  seed('wardrobe-100', 'Wardrobe 100', 'wardrobe', 100, 60, 200, 299, '#e8e2d6', 'wardrobe', { front: 60 }, true, ['bedroom', 'studio'], { colors: CARCASS_WHITE }),
  seed('wardrobe-150', 'Wardrobe 150', 'wardrobe', 150, 60, 200, 449, '#e8e2d6', 'wardrobe', { front: 60 }, true, ['bedroom'], { colors: CARCASS_WHITE }),
  seed('clothes-rail-100', 'Clothes rail', 'wardrobe', 100, 45, 160, 49, '#8a8a8a', 'shelf', { front: 60 }, true, ['bedroom', 'hall', 'studio'], { colors: ['#8a8a8a', '#e8e2d6', '#3e3e46'] }),
  seed('wardrobe-200', 'Wardrobe 200', 'wardrobe', 200, 60, 200, 599, '#e8e2d6', 'wardrobe', { front: 60 }, true, ['bedroom'], { colors: CARCASS_WHITE }),
  seed('wardrobe-corner-100', 'Corner wardrobe', 'wardrobe', 100, 100, 200, 499, '#e8e2d6', 'wardrobe', { front: 60 }, true, ['bedroom', 'kids'], { colors: CARCASS_WHITE }),
  // shelves
  seed('shelf-80', 'Bookshelf 80', 'shelf', 80, 30, 180, 99, '#d8cbb3', 'shelf', { front: 40 }, true, ['living', 'office', 'studio']),
  seed('shelf-60', 'Bookshelf 60', 'shelf', 60, 30, 120, 59, '#d8cbb3', 'shelf', { front: 40 }, true, ['living', 'office', 'kids', 'studio']),
  seed('shelf-cube-147', 'Cube shelf 4x4', 'shelf', 147, 39, 147, 179, '#f2ede4', 'shelf', { front: 40 }, true, ['living', 'kids', 'office']),
  seed('shelf-low-120', 'Low shelf 120', 'shelf', 120, 30, 80, 89, '#d8cbb3', 'shelf', { front: 40 }, false, ['living', 'hall', 'kids', 'studio']),
  seed('shelf-tall-200', 'Tall bookshelf', 'shelf', 90, 35, 200, 179, '#d8cbb3', 'shelf', { front: 40 }, true, ['office', 'living']),
  seed('shelf-ladder-60', 'Ladder shelf', 'shelf', 60, 40, 180, 119, '#b9a48b', 'shelf', { front: 40 }, true, ['living', 'office', 'studio']),
  // dressers
  seed('dresser-80', 'Dresser 80', 'dresser', 80, 40, 80, 149, '#cbb9a0', 'box', { front: 60 }, false, ['bedroom', 'kids', 'studio'], { colors: WOOD_WARM }),
  seed('dresser-100', 'Dresser 100', 'dresser', 100, 45, 90, 199, '#cbb9a0', 'box', { front: 60 }, false, ['bedroom', 'studio'], { colors: WOOD_WARM }),
  seed('dresser-160', 'Sideboard 160', 'dresser', 160, 45, 80, 299, '#cbb9a0', 'box', { front: 60 }, false, ['living', 'dining'], { colors: WOOD_WARM }),
  seed('dresser-60', 'Narrow dresser', 'dresser', 60, 40, 100, 129, '#cbb9a0', 'box', { front: 60 }, false, ['bedroom', 'hall', 'kids'], { colors: WOOD_WARM }),
  seed('sideboard-200', 'Sideboard 200', 'dresser', 200, 45, 80, 399, '#cbb9a0', 'box', { front: 60 }, false, ['dining', 'living'], { colors: WOOD_WARM }),
  // nightstands
  seed('nightstand-45', 'Nightstand', 'nightstand', 45, 40, 55, 49, '#cbb9a0', 'box', {}, false, ['bedroom', 'studio']),
  seed('nightstand-40', 'Small nightstand', 'nightstand', 40, 35, 50, 39, '#cbb9a0', 'box', {}, false, ['bedroom', 'kids', 'studio']),
  seed('nightstand-open-45', 'Open nightstand', 'nightstand', 45, 40, 60, 59, '#b9a48b', 'box', {}, false, ['bedroom']),
  // rugs
  seed('rug-120x180', 'Rug 120x180', 'rug', 120, 180, 1, 59, '#b56b5a', 'rug', {}, false, ['living', 'bedroom', 'studio'], { colors: RUG_TONES }),
  seed('rug-160x230', 'Rug 160x230', 'rug', 160, 230, 1, 89, '#b56b5a', 'rug', {}, false, ['living', 'bedroom', 'studio'], { colors: RUG_TONES }),
  seed('rug-200x300', 'Rug 200x300', 'rug', 200, 300, 1, 149, '#b56b5a', 'rug', {}, false, ['living', 'dining'], { colors: RUG_TONES }),
  seed('rug-round-200', 'Round rug 200', 'rug', 200, 200, 1, 129, '#b56b5a', 'rug', {}, false, ['living', 'kids', 'studio'], { colors: RUG_TONES }),
  seed('rug-80x150', 'Runner 80x150', 'rug', 80, 150, 1, 45, '#b56b5a', 'rug', {}, false, ['hall', 'kitchen'], { colors: RUG_TONES }),
  seed('rug-round-140', 'Round rug 140', 'rug', 140, 140, 1, 79, '#8c9a7a', 'rug', {}, false, ['kids', 'bedroom', 'studio'], { colors: ['#8c9a7a', '#b56b5a', '#7d8aa0', '#d8cbb3'] }),
  seed('rug-240x340', 'Rug 240x340', 'rug', 240, 340, 1, 199, '#7d8aa0', 'rug', {}, false, ['living', 'dining'], { colors: ['#7d8aa0', '#b56b5a', '#8c9a7a', '#d8cbb3'] }),
  // lamps
  seed('lamp-floor', 'Floor lamp', 'lamp', 30, 30, 160, 49, '#f0e6c8', 'lamp', {}, false, ['living', 'bedroom', 'office', 'studio']),
  seed('lamp-arc', 'Arc lamp', 'lamp', 60, 40, 180, 129, '#f0e6c8', 'lamp', {}, false, ['living', 'studio']),
  seed('lamp-table-40', 'Table lamp', 'lamp', 25, 25, 45, 35, '#f0e6c8', 'lamp', {}, false, ['bedroom', 'living', 'office', 'studio']),
  seed('lamp-tripod-50', 'Tripod lamp', 'lamp', 50, 50, 150, 89, '#f0e6c8', 'lamp', {}, false, ['living', 'office']),
  seed('pendant-40', 'Pendant lamp', 'lamp', 40, 40, 35, 69, '#f0e6c8', 'lamp', {}, false, ['dining', 'kitchen', 'living'], { mountHeight: 190 }),
  // plants
  seed('plant-large', 'Large plant', 'plant', 50, 50, 160, 89, '#4f7d4a', 'plant', {}, false, ['living', 'office', 'hall', 'studio']),
  seed('plant-medium', 'Medium plant', 'plant', 35, 35, 100, 39, '#4f7d4a', 'plant', {}, false, ['living', 'bedroom', 'office', 'studio']),
  seed('plant-small', 'Small plant', 'plant', 25, 25, 50, 19, '#4f7d4a', 'plant', {}, false, ['kitchen', 'office', 'bedroom', 'studio']),
  seed('plant-tall-180', 'Tall palm', 'plant', 60, 60, 180, 129, '#4f7d4a', 'plant', {}, false, ['living', 'hall']),
  // tv
  seed('tv-stand-120', 'TV stand 120', 'tv', 120, 40, 50, 129, '#2f2f33', 'tv', { front: 100 }, false, ['living', 'bedroom', 'studio']),
  seed('tv-stand-160', 'TV stand 160', 'tv', 160, 40, 50, 179, '#2f2f33', 'tv', { front: 100 }, false, ['living', 'studio']),
  seed('tv-stand-180', 'TV stand 180', 'tv', 180, 45, 50, 249, '#2f2f33', 'tv', { front: 100 }, false, ['living']),
  seed('media-unit-200', 'Media unit', 'tv', 200, 45, 120, 399, '#2f2f33', 'tv', { front: 100 }, true, ['living']),
  // kitchen
  seed('counter-120', 'Kitchen counter 120', 'kitchen', 120, 60, 90, 249, '#e6e1d8', 'counter', { front: 90 }, false, ['kitchen', 'studio']),
  seed('counter-180', 'Kitchen counter 180', 'kitchen', 180, 60, 90, 349, '#e6e1d8', 'counter', { front: 90 }, false, ['kitchen']),
  seed('counter-corner-90', 'Corner counter', 'kitchen', 90, 90, 90, 219, '#e6e1d8', 'counter', { front: 90 }, false, ['kitchen']),
  seed('sink-unit-80', 'Sink unit 80', 'kitchen', 80, 60, 90, 279, '#dcd8cf', 'counter', { front: 90 }, false, ['kitchen', 'studio']),
  seed('island-120', 'Kitchen island 120', 'kitchen', 120, 80, 90, 449, '#e6e1d8', 'counter', { front: 90, back: 90 }, false, ['kitchen']),
  seed('island-160', 'Kitchen island 160', 'kitchen', 160, 90, 90, 599, '#e6e1d8', 'counter', { front: 90, back: 90 }, false, ['kitchen']),
  seed('breakfast-bar-140', 'Breakfast bar', 'kitchen', 140, 45, 105, 299, '#c9b08d', 'counter', { front: 90 }, false, ['kitchen', 'dining', 'studio']),
  seed('pantry-60', 'Pantry cabinet 60', 'kitchen', 60, 60, 200, 349, '#e8e2d6', 'wardrobe', { front: 60 }, true, ['kitchen']),
  seed('pantry-90', 'Pantry cabinet 90', 'kitchen', 90, 60, 200, 449, '#e8e2d6', 'wardrobe', { front: 60 }, true, ['kitchen']),
  seed('kitchen-wall-cab-80', 'Wall cabinet 80', 'kitchen', 80, 35, 70, 199, '#e8e2d6', 'wallshelf', {}, false, ['kitchen'], { mountHeight: 140 }),
  // appliances
  seed('fridge-60', 'Fridge 60', 'appliance', 60, 65, 180, 599, '#b8bcc2', 'appliance', { front: 60 }, true, ['kitchen', 'studio']),
  seed('fridge-tall-70', 'Fridge freezer 70', 'appliance', 70, 70, 200, 799, '#b8bcc2', 'appliance', { front: 60 }, true, ['kitchen']),
  seed('freezer-chest-90', 'Chest freezer', 'appliance', 90, 60, 85, 449, '#b8bcc2', 'appliance', { front: 60 }, false, ['kitchen']),
  seed('oven-60', 'Oven 60', 'appliance', 60, 60, 90, 449, '#4a4f57', 'appliance', { front: 60 }, false, ['kitchen', 'studio']),
  seed('range-cooker-90', 'Range cooker 90', 'appliance', 90, 60, 90, 699, '#4a4f57', 'appliance', { front: 60 }, false, ['kitchen']),
  seed('dishwasher-60', 'Dishwasher', 'appliance', 60, 60, 85, 399, '#b8bcc2', 'appliance', { front: 60 }, false, ['kitchen']),
  seed('washer-60', 'Washing machine', 'appliance', 60, 60, 85, 349, '#b8bcc2', 'appliance', { front: 60 }, false, ['kitchen', 'hall']),
  seed('dryer-60', 'Tumble dryer', 'appliance', 60, 60, 85, 329, '#b8bcc2', 'appliance', { front: 60 }, false, ['kitchen', 'hall']),
  seed('microwave-50', 'Microwave', 'appliance', 50, 38, 30, 129, '#4a4f57', 'appliance', {}, false, ['kitchen'], { mountHeight: 150 }),
  seed('extractor-60', 'Extractor hood', 'appliance', 60, 50, 55, 249, '#b8bcc2', 'appliance', {}, false, ['kitchen'], { mountHeight: 150 }),
  // storage
  seed('shoe-rack-80', 'Shoe rack', 'storage', 80, 30, 50, 49, '#b9a48b', 'shelf', { front: 60 }, false, ['hall']),
  seed('shoe-cabinet-100', 'Shoe cabinet', 'storage', 100, 30, 100, 129, '#e8e2d6', 'box', { front: 60 }, false, ['hall']),
  seed('coat-rack-60', 'Coat rack', 'storage', 60, 40, 180, 59, '#3e3e46', 'shelf', { front: 60 }, false, ['hall', 'office']),
  seed('bar-cart-70', 'Bar cart', 'storage', 70, 45, 85, 149, '#c9a227', 'box', { front: 60 }, false, ['living', 'dining']),
  seed('chest-100', 'Storage chest', 'storage', 100, 45, 50, 149, '#b9a48b', 'box', { front: 60 }, false, ['bedroom', 'living', 'hall']),
  seed('cabinet-90', 'Storage cabinet 90', 'storage', 90, 45, 180, 299, '#e8e2d6', 'wardrobe', { front: 60 }, true, ['office', 'hall', 'living']),
  seed('cabinet-120', 'Storage cabinet 120', 'storage', 120, 45, 120, 249, '#e8e2d6', 'box', { front: 60 }, false, ['office', 'living', 'hall']),
  seed('laundry-basket-40', 'Laundry basket', 'storage', 40, 40, 60, 29, '#d8cbb3', 'box', { front: 60 }, false, ['bedroom', 'hall', 'kitchen']),
  seed('toy-box-80', 'Toy box', 'storage', 80, 45, 50, 89, '#8c9a7a', 'box', { front: 60 }, false, ['kids']),
  seed('filing-cabinet-45', 'Filing cabinet', 'storage', 45, 60, 110, 179, '#4a4f57', 'box', { front: 60 }, false, ['office']),
  seed('bench-hall-90', 'Hall bench', 'storage', 90, 38, 45, 99, '#b9a48b', 'bench', { front: 60 }, false, ['hall']),
  seed('bench-storage-120', 'Storage bench', 'storage', 120, 40, 50, 169, '#e8e2d6', 'bench', { front: 60 }, false, ['hall', 'bedroom']),
  // decor
  seed('ottoman-60', 'Storage ottoman', 'decor', 60, 40, 45, 69, '#8c6f5a', 'box', {}, false, ['living', 'bedroom', 'studio'], { colors: FABRIC_BROWN }),
  seed('pouf-50', 'Pouf', 'decor', 50, 50, 40, 59, '#b58a6a', 'pouf', {}, false, ['living', 'kids', 'studio'], { colors: ['#b58a6a', '#8c9a7a', '#6b7c93', '#4a4f57'] }),
  seed('pouf-round-60', 'Round pouf', 'decor', 60, 60, 45, 79, '#8c9a7a', 'pouf', {}, false, ['living', 'bedroom'], { colors: ['#8c9a7a', '#b58a6a', '#7d8aa0', '#4a4f57'] }),
  seed('bean-bag-90', 'Bean bag', 'decor', 90, 90, 70, 99, '#6b7c93', 'pouf', {}, false, ['kids', 'living'], { colors: ['#6b7c93', '#8c9a7a', '#b58a6a', '#4a4f57'] }),
  seed('floor-basket-45', 'Floor basket', 'decor', 45, 45, 40, 35, '#d8cbb3', 'pouf', {}, false, ['living', 'bedroom', 'kids'], { colors: ['#d8cbb3', '#b9a48b', '#8c9a7a'] }),
  seed('pet-bed-70', 'Pet bed', 'decor', 70, 50, 20, 59, '#8c9a7a', 'pouf', {}, false, ['living', 'bedroom', 'hall'], { colors: ['#8c9a7a', '#b58a6a', '#7d8aa0'] }),
  seed('vase-stand-35', 'Vase stand', 'decor', 35, 35, 70, 49, '#e8e2d6', 'box', {}, false, ['living', 'hall'], { colors: ['#e8e2d6', '#3e3e46', '#b9a48b'] }),
  seed('candle-table-40', 'Candle table', 'decor', 40, 40, 45, 39, '#a58b6a', 'table', {}, false, ['living', 'bedroom', 'studio'], { colors: ['#a58b6a', '#3e3e46', '#e8e2d6'] }),
  seed('sculpture-stand-30', 'Sculpture stand', 'decor', 30, 30, 100, 69, '#3e3e46', 'box', {}, false, ['living', 'hall', 'office'], { colors: ['#3e3e46', '#e8e2d6', '#b9a48b'] }),
  seed('magazine-rack-40', 'Magazine rack', 'decor', 40, 25, 45, 29, '#b9a48b', 'box', {}, false, ['living', 'office', 'studio'], { colors: ['#b9a48b', '#3e3e46', '#8c9a7a'] }),
  seed('screen-divider-150', 'Screen divider', 'decor', 150, 30, 170, 199, '#d8cbb3', 'box', {}, true, ['studio', 'living', 'bedroom'], { colors: ['#d8cbb3', '#b9a48b', '#3e3e46'] }),
  // wall-mounted
  seed('picture-40', 'Framed print 40', 'wall', 40, 4, 50, 29, '#3e3e46', 'picture', {}, false, ['living', 'bedroom', 'hall', 'office', 'studio'], { colors: FRAME_TONES, mountHeight: 120 }),
  seed('picture-60', 'Framed print 60', 'wall', 60, 4, 80, 49, '#3e3e46', 'picture', {}, false, ['living', 'bedroom', 'office', 'studio'], { colors: FRAME_TONES, mountHeight: 110 }),
  seed('picture-90', 'Large print 90', 'wall', 90, 5, 120, 89, '#3e3e46', 'picture', {}, false, ['living', 'dining'], { colors: FRAME_TONES, mountHeight: 100 }),
  seed('gallery-set-120', 'Gallery wall set', 'wall', 120, 4, 90, 129, '#b9a48b', 'picture', {}, false, ['living', 'hall', 'studio'], { colors: ['#b9a48b', '#3e3e46', '#e8e2d6', '#c9a227'], mountHeight: 100 }),
  seed('pinboard-80', 'Pinboard 80', 'wall', 80, 4, 60, 45, '#c9b08d', 'picture', {}, false, ['office', 'kids'], { colors: ['#c9b08d', '#3e3e46', '#8c9a7a'], mountHeight: 110 }),
  seed('wall-clock-30', 'Wall clock', 'wall', 30, 5, 30, 39, '#3e3e46', 'picture', {}, false, ['kitchen', 'living', 'hall', 'office'], { colors: ['#3e3e46', '#e8e2d6', '#c9a227'], mountHeight: 180 }),
  seed('mirror-round-60', 'Round wall mirror', 'wall', 60, 5, 60, 79, '#c7d3dd', 'mirror', {}, false, ['hall', 'bedroom', 'living'], { colors: ['#c7d3dd', '#3e3e46', '#c9a227'], mountHeight: 110 }),
  seed('mirror-rect-80', 'Wall mirror 80', 'wall', 80, 5, 120, 129, '#c7d3dd', 'mirror', {}, false, ['bedroom', 'hall'], { colors: ['#c7d3dd', '#3e3e46', '#b9a48b'], mountHeight: 90 }),
  seed('wall-shelf-60', 'Wall shelf 60', 'wall', 60, 20, 20, 39, '#d8cbb3', 'wallshelf', {}, false, ['living', 'kitchen', 'office', 'studio'], { mountHeight: 140 }),
  seed('wall-shelf-100', 'Wall shelf 100', 'wall', 100, 22, 20, 59, '#d8cbb3', 'wallshelf', {}, false, ['living', 'office', 'kids'], { mountHeight: 140 }),
  seed('curtain-140', 'Curtain pair 140', 'wall', 140, 10, 215, 89, '#e8e2d6', 'curtain', {}, false, ['living', 'bedroom', 'studio'], { colors: ['#e8e2d6', '#8c9a7a', '#7d8aa0', '#b58a6a'], mountHeight: 5 }),
  seed('curtain-200', 'Curtain pair 200', 'wall', 200, 10, 215, 129, '#e8e2d6', 'curtain', {}, false, ['living', 'bedroom'], { colors: ['#e8e2d6', '#8c9a7a', '#7d8aa0', '#b58a6a'], mountHeight: 5 }),
  seed('coat-hooks-60', 'Coat hooks', 'wall', 60, 10, 15, 25, '#3e3e46', 'hooks', {}, false, ['hall', 'kids'], { mountHeight: 160 }),
  seed('hook-rail-90', 'Hook rail 90', 'wall', 90, 10, 15, 35, '#b9a48b', 'hooks', {}, false, ['hall', 'kitchen'], { mountHeight: 160 }),
  seed('wall-tv-90', 'Wall TV 90', 'wall', 90, 8, 55, 449, '#2f2f33', 'tv', {}, false, ['living', 'bedroom', 'studio'], { mountHeight: 105 }),
  seed('wall-tv-120', 'Wall TV 120', 'wall', 120, 8, 70, 699, '#2f2f33', 'tv', {}, false, ['living'], { mountHeight: 100 }),
  // other
  seed('mirror-floor', 'Floor mirror', 'other', 50, 5, 170, 79, '#c7d3dd', 'box', {}, false, ['bedroom', 'hall', 'studio']),
  seed('bench-100', 'Bench', 'other', 100, 35, 45, 89, '#a58b6a', 'box', {}, false, ['hall', 'dining', 'studio']),
  seed('bench-dining-140', 'Dining bench', 'other', 140, 38, 45, 129, '#c9b08d', 'bench', {}, false, ['dining', 'kitchen']),
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
