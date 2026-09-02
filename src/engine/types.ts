// src/engine/types.ts
export type Wall = 'top' | 'right' | 'bottom' | 'left';
export type Rotation = 0 | 90 | 180 | 270;
export const ROTATIONS: Rotation[] = [0, 90, 180, 270];
export const WALLS: Wall[] = ['top', 'right', 'bottom', 'left'];

export interface Rect { x: number; y: number; w: number; h: number }

export interface Opening {
  id: string;
  kind: 'door' | 'window';
  wall: Wall;
  offset: number;
  width: number;
  height: number;
  sill?: number;
  swing?: 'in' | 'out';
  hinge?: 'start' | 'end';
}

export type Category =
  | 'bed' | 'sofa' | 'armchair' | 'desk' | 'chair' | 'table' | 'wardrobe'
  | 'shelf' | 'dresser' | 'nightstand' | 'rug' | 'lamp' | 'plant' | 'tv' | 'other';
export const CATEGORIES: Category[] = ['bed','sofa','armchair','desk','chair','table','wardrobe','shelf','dresser','nightstand','rug','lamp','plant','tv','other'];

export type Shape = 'box' | 'bed' | 'sofa' | 'desk' | 'chair' | 'table' | 'wardrobe' | 'shelf' | 'rug' | 'lamp' | 'plant' | 'tv';

export interface Clearance { front?: number; back?: number; left?: number; right?: number; anyLongSide?: number }

export interface CatalogItem {
  id: string;
  name: string;
  category: Category;
  width: number;
  depth: number;
  height: number;
  price: number;
  color: string;
  shape: Shape;
  clearance: Clearance;
  blocksLight: boolean;
  source: 'seed' | 'agent';
  url?: string;
}

export interface PlacedItem {
  id: string;
  catalogId: string;
  x: number;
  y: number;
  rotation: Rotation;
  locked: boolean;
}

export interface Brief { budget: number; currency: 'USD'; needs: string[]; notes: string }

export interface RoomShell { width: number; depth: number; height: number; northWall: Wall }

export type Op =
  | { type: 'setShell'; width: number; depth: number; height: number; northWall: Wall }
  | { type: 'addOpening'; opening: Opening }
  | { type: 'removeOpening'; id: string }
  | { type: 'setBrief'; brief: Brief }
  | { type: 'place'; item: PlacedItem }
  | { type: 'move'; id: string; x: number; y: number; rotation: Rotation }
  | { type: 'remove'; id: string }
  | { type: 'swap'; id: string; catalogId: string }
  | { type: 'setLocked'; id: string; locked: boolean }
  | { type: 'addCatalogItem'; item: CatalogItem }
  | { type: 'removeCatalogItem'; id: string };

export type ViolationKind = 'out_of_bounds' | 'overlap' | 'blocks_door' | 'blocks_window' | 'clearance' | 'unreachable' | 'over_budget';

export interface Violation { kind: ViolationKind; itemIds: string[]; message: string; zone?: Rect }

export interface Metrics {
  freeFloorPct: number;
  openAreaCm2: number;
  minWalkwayCm: number;
  budgetUsed: number;
  budgetRemaining: number;
  lightByItem: Record<string, number>;
  violationCount: number;
}

export interface Daylight {
  cellCm: 10;
  cols: number;
  rows: number;
  grid: Float32Array;
  lightByItem: Record<string, number>;
}

export interface Analysis { violations: Violation[]; metrics: Metrics; daylight: Daylight }

export interface Proposal {
  id: string;
  label: string;
  ops: Op[];
  metricsBefore: Metrics;
  metricsAfter: Metrics;
  violationsAfter: Violation[];
  createdAt: number;
}

export interface LedgerEntry {
  id: string;
  at: number;
  actor: 'human' | 'agent';
  tool?: string;
  summary: string;
  ops: Op[];
  inverse: Op[];
  violationsAfter: number;
}

export interface Room extends RoomShell {
  id: string;
  name: string;
  openings: Opening[];
  items: PlacedItem[];
  brief: Brief;
  daylightHour: number;
  catalogExtras: CatalogItem[];
  proposals: Proposal[];
  ledger: LedgerEntry[];
}

export interface CameraPose { mode: 'orbit' | 'walk'; x: number; y: number; z: number; yaw: number; pitch: number }

export interface ClearanceGroup { label: string; mode: 'all' | 'any'; cm: number; rects: Rect[] }

export const CELL = 10;
export const WALKWAY_CM = 60;
export const DOOR_APPROACH_CM = 60;
export const WINDOW_TOUCH_CM = 10;
