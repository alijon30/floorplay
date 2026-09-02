// src/engine/catalog.ts
import type { CatalogItem, Category, Clearance, Room, Shape } from './types';

function seed(
  id: string, name: string, category: Category, width: number, depth: number, height: number,
  price: number, color: string, shape: Shape, clearance: Clearance, blocksLight: boolean,
): CatalogItem {
  return { id, name, category, width, depth, height, price, color, shape, clearance, blocksLight, source: 'seed' };
}

export const SEED_CATALOG: CatalogItem[] = [
  // beds
  seed('bed-single-90', 'Single bed', 'bed', 90, 200, 45, 249, '#b9a48b', 'bed', { anyLongSide: 60 }, false),
  seed('bed-double-140', 'Double bed', 'bed', 140, 200, 45, 399, '#b9a48b', 'bed', { anyLongSide: 60 }, false),
  seed('bed-queen-160', 'Queen bed', 'bed', 160, 200, 45, 499, '#b9a48b', 'bed', { anyLongSide: 60 }, false),
  seed('bed-daybed-90', 'Daybed', 'bed', 200, 90, 80, 329, '#a89f91', 'sofa', { front: 50 }, false),
  // sofas
  seed('sofa-2', 'Two-seat sofa', 'sofa', 160, 85, 80, 449, '#6b7c93', 'sofa', { front: 60 }, false),
  seed('sofa-3', 'Three-seat sofa', 'sofa', 220, 90, 85, 699, '#6b7c93', 'sofa', { front: 60 }, false),
  seed('loveseat-140', 'Loveseat', 'sofa', 140, 80, 80, 349, '#7d8aa0', 'sofa', { front: 60 }, false),
  seed('sofa-bed-190', 'Sofa bed', 'sofa', 190, 95, 85, 599, '#5f6f86', 'sofa', { front: 60 }, false),
  // armchairs
  seed('armchair-80', 'Armchair', 'armchair', 80, 85, 90, 199, '#8c6f5a', 'sofa', { front: 50 }, false),
  seed('armchair-70', 'Compact armchair', 'armchair', 70, 75, 85, 149, '#8c6f5a', 'sofa', { front: 50 }, false),
  // desks
  seed('desk-100', 'Desk 100', 'desk', 100, 50, 75, 89, '#d9c8a9', 'desk', { front: 90 }, false),
  seed('desk-120', 'Desk 120', 'desk', 120, 60, 75, 129, '#d9c8a9', 'desk', { front: 90 }, false),
  seed('desk-140', 'Desk 140', 'desk', 140, 70, 75, 179, '#d9c8a9', 'desk', { front: 90 }, false),
  seed('desk-standing-120', 'Standing desk', 'desk', 120, 60, 120, 349, '#cdbfa5', 'desk', { front: 90 }, false),
  // chairs
  seed('chair-office', 'Office chair', 'chair', 60, 60, 100, 129, '#3e3e46', 'chair', {}, false),
  seed('chair-dining', 'Dining chair', 'chair', 45, 50, 85, 59, '#5a4a3f', 'chair', {}, false),
  seed('stool-35', 'Stool', 'chair', 35, 35, 70, 39, '#5a4a3f', 'chair', {}, false),
  // tables
  seed('table-dining-120', 'Dining table 120', 'table', 120, 75, 75, 199, '#c9b08d', 'table', { front: 60, back: 60 }, false),
  seed('table-dining-80', 'Square table 80', 'table', 80, 80, 75, 129, '#c9b08d', 'table', { front: 60, back: 60 }, false),
  seed('table-round-100', 'Round table 100', 'table', 100, 100, 75, 229, '#c9b08d', 'table', { front: 60, back: 60 }, false),
  seed('table-coffee-90', 'Coffee table', 'table', 90, 50, 45, 79, '#a58b6a', 'table', {}, false),
  seed('table-side-45', 'Side table', 'table', 45, 45, 50, 39, '#a58b6a', 'table', {}, false),
  // wardrobes
  seed('wardrobe-80', 'Wardrobe 80', 'wardrobe', 80, 50, 180, 199, '#e8e2d6', 'wardrobe', { front: 60 }, true),
  seed('wardrobe-100', 'Wardrobe 100', 'wardrobe', 100, 60, 200, 299, '#e8e2d6', 'wardrobe', { front: 60 }, true),
  seed('wardrobe-150', 'Wardrobe 150', 'wardrobe', 150, 60, 200, 449, '#e8e2d6', 'wardrobe', { front: 60 }, true),
  seed('clothes-rail-100', 'Clothes rail', 'wardrobe', 100, 45, 160, 49, '#8a8a8a', 'shelf', { front: 60 }, true),
  // shelves
  seed('shelf-80', 'Bookshelf 80', 'shelf', 80, 30, 180, 99, '#d8cbb3', 'shelf', { front: 40 }, true),
  seed('shelf-60', 'Bookshelf 60', 'shelf', 60, 30, 120, 59, '#d8cbb3', 'shelf', { front: 40 }, true),
  seed('shelf-cube-147', 'Cube shelf 4x4', 'shelf', 147, 39, 147, 179, '#f2ede4', 'shelf', { front: 40 }, true),
  seed('shelf-low-120', 'Low shelf 120', 'shelf', 120, 30, 80, 89, '#d8cbb3', 'shelf', { front: 40 }, false),
  // dressers
  seed('dresser-80', 'Dresser 80', 'dresser', 80, 40, 80, 149, '#cbb9a0', 'box', { front: 60 }, false),
  seed('dresser-100', 'Dresser 100', 'dresser', 100, 45, 90, 199, '#cbb9a0', 'box', { front: 60 }, false),
  seed('dresser-160', 'Sideboard 160', 'dresser', 160, 45, 80, 299, '#cbb9a0', 'box', { front: 60 }, false),
  // nightstands
  seed('nightstand-45', 'Nightstand', 'nightstand', 45, 40, 55, 49, '#cbb9a0', 'box', {}, false),
  seed('nightstand-40', 'Small nightstand', 'nightstand', 40, 35, 50, 39, '#cbb9a0', 'box', {}, false),
  // rugs
  seed('rug-120x180', 'Rug 120x180', 'rug', 120, 180, 1, 59, '#b56b5a', 'rug', {}, false),
  seed('rug-160x230', 'Rug 160x230', 'rug', 160, 230, 1, 89, '#b56b5a', 'rug', {}, false),
  seed('rug-200x300', 'Rug 200x300', 'rug', 200, 300, 1, 149, '#b56b5a', 'rug', {}, false),
  seed('rug-round-200', 'Round rug 200', 'rug', 200, 200, 1, 129, '#b56b5a', 'rug', {}, false),
  // lamps
  seed('lamp-floor', 'Floor lamp', 'lamp', 30, 30, 160, 49, '#f0e6c8', 'lamp', {}, false),
  seed('lamp-arc', 'Arc lamp', 'lamp', 60, 40, 180, 129, '#f0e6c8', 'lamp', {}, false),
  // plants
  seed('plant-large', 'Large plant', 'plant', 50, 50, 160, 89, '#4f7d4a', 'plant', {}, false),
  seed('plant-medium', 'Medium plant', 'plant', 35, 35, 100, 39, '#4f7d4a', 'plant', {}, false),
  // tv
  seed('tv-stand-120', 'TV stand 120', 'tv', 120, 40, 50, 129, '#2f2f33', 'tv', { front: 100 }, false),
  seed('tv-stand-160', 'TV stand 160', 'tv', 160, 40, 50, 179, '#2f2f33', 'tv', { front: 100 }, false),
  // other
  seed('mirror-floor', 'Floor mirror', 'other', 50, 5, 170, 79, '#c7d3dd', 'box', {}, false),
  seed('bench-100', 'Bench', 'other', 100, 35, 45, 89, '#a58b6a', 'box', {}, false),
  seed('ottoman-60', 'Storage ottoman', 'other', 60, 40, 45, 69, '#8c6f5a', 'box', {}, false),
];

export function catalogFor(room: Room): CatalogItem[] {
  return [...SEED_CATALOG, ...room.catalogExtras];
}

export function findCatalogItem(room: Room, id: string): CatalogItem | undefined {
  return room.catalogExtras.find((i) => i.id === id) ?? SEED_CATALOG.find((i) => i.id === id);
}
