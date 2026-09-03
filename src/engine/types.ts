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
  /**
   * The doorway this opening is one half of, when it joins two rooms of a home.
   *
   * Its presence is what tells a door onto the landing apart from a door into the next room:
   * a doorway owns a matching opening in each room, and the pair is cut and removed together.
   * An opening without it is external, which is what `homeReachability` looks for when it has
   * to guess which room somebody comes in through.
   */
  doorwayId?: string;
}

export type Category =
  | 'bed' | 'sofa' | 'armchair' | 'desk' | 'chair' | 'table' | 'wardrobe'
  | 'shelf' | 'dresser' | 'nightstand' | 'rug' | 'lamp' | 'plant' | 'tv'
  | 'kitchen' | 'appliance' | 'storage' | 'decor' | 'wall' | 'other';
export const CATEGORIES: Category[] = [
  'bed','sofa','armchair','desk','chair','table','wardrobe','shelf','dresser','nightstand',
  'rug','lamp','plant','tv','kitchen','appliance','storage','decor','wall','other',
];

export type Shape =
  | 'box' | 'bed' | 'sofa' | 'desk' | 'chair' | 'table' | 'wardrobe' | 'shelf' | 'rug' | 'lamp' | 'plant' | 'tv'
  | 'counter' | 'appliance' | 'stool' | 'bench' | 'picture' | 'mirror' | 'curtain' | 'hooks' | 'wallshelf' | 'pouf' | 'crib';

/** The kind of room an item belongs in, used to filter the catalog and to key the templates. */
export type RoomKind = 'living' | 'kitchen' | 'bedroom' | 'hall' | 'office' | 'dining' | 'kids' | 'studio';
export const ROOM_KINDS: RoomKind[] = ['living', 'kitchen', 'bedroom', 'hall', 'office', 'dining', 'kids', 'studio'];

export type FloorFinish = 'oak' | 'walnut' | 'ash' | 'grey' | 'tile';
export const FLOOR_FINISHES: FloorFinish[] = ['oak', 'walnut', 'ash', 'grey', 'tile'];

/**
 * Wall paint (hex) and floor material for a room.
 *
 * `wall` is the default every wall takes. `walls` overrides it for named walls only, so a
 * room saved before per-wall colour existed still reads correctly: it simply has no
 * overrides. Always read a wall's colour through `wallColor`, never off `wall` directly.
 */
export interface RoomFinish { wall: string; floor: FloorFinish; walls?: Partial<Record<Wall, string>> }
export const DEFAULT_FINISH: RoomFinish = { wall: '#efe9df', floor: 'oak' };

/**
 * Free space an item needs on each side, in cm, measured outward from its footprint.
 *
 * Sides are named in item-local plan coordinates at rotation 0, where x runs right and
 * y runs down:
 *
 * - `front` is the +y side (below the item in plan view)
 * - `back` is the -y side (above the item)
 * - `left` is the -x side
 * - `right` is the +x side
 *
 * `left` and `right` are named from the point of view of a person walking up to the item
 * head-on, not from the item's own point of view. That person stands on the front (+y)
 * side looking toward -y, and their left hand points toward -x, which is why `left` is
 * the -x side. The item's own left is therefore `right` in this naming. When authoring a
 * catalog entry, ask "which side is on my left as I face this thing", not "which side
 * would the sofa call its left".
 *
 * At a non-zero rotation the zones rotate with the item; these names always describe the
 * rotation-0 frame.
 *
 * `anyLongSide` is not a named side. It requires that at least one of the item's two long
 * sides has that much clearance, so a bed against a wall still passes. See
 * `clearanceGroups`, which emits it as a group with mode 'any'.
 */
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
  /** Room kinds this item suits. Never empty, so every item survives a room filter. */
  rooms: RoomKind[];
  /** Alternative finishes offered in the inspector. The first entry equals `color`. */
  colors?: string[];
  /**
   * Height in cm from the floor to the bottom of the item, for wall-mounted things only.
   *
   * Its presence is what makes an item mounted: it then hangs above the floor, so it is
   * bounds-checked but takes part in no overlap, clearance, reachability, free-floor or
   * daylight calculation. See `isFloorSolid`.
   */
  mountHeight?: number;
}

/** Where one placed piece stands between "still to find" and "already here". */
export type PurchaseStatus = 'to-buy' | 'owned' | 'ordered';

export const PURCHASE_STATUSES: PurchaseStatus[] = ['to-buy', 'owned', 'ordered'];

/** A buying decision: what state it is in, and where it is coming from when that is known. */
export interface Purchase { status: PurchaseStatus; source?: string; url?: string }

export interface PlacedItem {
  id: string;
  catalogId: string;
  x: number;
  y: number;
  rotation: Rotation;
  locked: boolean;
  /** Overrides the catalog item's `color` for this placement only. */
  color?: string;
  /**
   * Overrides the catalog item's `mountHeight` for this placement only, in cm from the floor.
   *
   * Only meaningful on a wall-mounted item; hanging the same print higher over a sofa than over
   * a desk is a placement decision, not a different product.
   */
  mountHeight?: number;
  /**
   * What is known about buying this piece. Absent means nobody has said, which reads as
   * "to buy": a room drawn on screen is a room whose furniture has not been bought yet.
   *
   * It lives on the placement rather than the catalog because two of the same chair can be
   * in different states — one already in the flat, one still to order.
   */
  purchase?: Purchase;
}

export interface Brief { budget: number; currency: 'USD'; needs: string[]; notes: string }

export interface RoomShell { width: number; depth: number; height: number; northWall: Wall }

export type Op =
  | { type: 'setShell'; width: number; depth: number; height: number; northWall: Wall }
  /** `at` is an insert index; the opening is appended when absent. */
  | { type: 'addOpening'; opening: Opening; at?: number }
  | { type: 'removeOpening'; id: string }
  | { type: 'setBrief'; brief: Brief }
  /** `at` is an insert index; the item is appended when absent. */
  | { type: 'place'; item: PlacedItem; at?: number }
  | { type: 'move'; id: string; x: number; y: number; rotation: Rotation }
  | { type: 'remove'; id: string }
  | { type: 'swap'; id: string; catalogId: string }
  | { type: 'setLocked'; id: string; locked: boolean }
  /** `at` is an insert index; the catalog item is appended when absent. */
  | { type: 'addCatalogItem'; item: CatalogItem; at?: number }
  | { type: 'removeCatalogItem'; id: string }
  /** `null` drops the override so the item goes back to its catalog color. */
  | { type: 'recolor'; id: string; color: string | null }
  | { type: 'setFinish'; finish: RoomFinish }
  /** `null` drops the record so the item goes back to the unstated default, "to buy". */
  | { type: 'setPurchase'; id: string; purchase: Purchase | null };

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
  finish: RoomFinish;
  daylightHour: number;
  catalogExtras: CatalogItem[];
  proposals: Proposal[];
  ledger: LedgerEntry[];
}

/** Where one room's top-left corner sits on the shared floor plan of a home, in cm. */
export interface HomeRoomPlacement { roomId: string; x: number; y: number }

/**
 * One end of a doorway: the room it opens into and where on that room's wall it sits.
 *
 * `offset` is in the room's own coordinates, measured the way every opening is — from the left
 * end of a top or bottom wall, from the top end of a left or right wall — so the two sides of
 * one doorway usually carry different numbers even though they name the same hole.
 */
export interface DoorwaySide { roomId: string; wall: Wall; offset: number }

/**
 * A hole joining two rooms of a home, owning a matching `Opening` in each of them.
 *
 * A door swings into room `a` and out of room `b`, so `a` is the room you arrive from; a
 * passage swings out of both, which is to say it has no leaf at all.
 */
export interface Doorway { id: string; a: DoorwaySide; b: DoorwaySide; width: number; kind: 'door' | 'passage' }

/**
 * A set of rooms laid out edge to edge on one floor plan, joined by doorways.
 *
 * The rooms themselves stay standalone objects in the store; a home only references them by id
 * and says where each one stands. A room belongs to at most one home, and a room in no home
 * keeps working exactly as it did before homes existed.
 */
export interface Home { id: string; name: string; rooms: HomeRoomPlacement[]; doorways: Doorway[]; entranceRoomId?: string }

export interface CameraPose { mode: 'orbit' | 'walk'; x: number; y: number; z: number; yaw: number; pitch: number }

export interface ClearanceGroup { label: string; mode: 'all' | 'any'; cm: number; rects: Rect[] }

export const CELL = 10;
export const WALKWAY_CM = 60;
export const DOOR_APPROACH_CM = 60;
export const WINDOW_TOUCH_CM = 10;
