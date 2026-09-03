// src/engine/furniture.ts
import type { CatalogItem, Category, Room } from './types';
import { catalogFor } from './catalog';
import { rotatedDims } from './geometry';

export interface FurniturePlanItem {
  catalogId: string;
  name: string;
  category: Category;
  price: number;
  /** Why this item and not another, phrased for the agent to repeat to the user. */
  reason: string;
}

export interface FurnitureAlternative { catalogId: string; name: string; price: number }

export interface FurniturePlan {
  items: FurniturePlanItem[];
  total: number;
  remaining: number;
  /** Needs the budget, the catalog or the room could not cover. Unknown phrases land here too. */
  unmet: string[];
  /** Up to three cheaper-or-dearer swaps per chosen item, keyed by its catalog id. */
  alternatives: Record<string, FurnitureAlternative[]>;
}

/**
 * The largest share of the room one piece may cover on each axis.
 *
 * A bed that spans two thirds of the width leaves no walkway whichever wall it goes against, so
 * the planner refuses it before position ever comes up. Either orientation may satisfy the test.
 */
const MAX_FOOTPRINT_SHARE = 0.45;

/**
 * The share of what is left that one piece may spend on the first pass.
 *
 * It stops the first need in the list from eating the budget: a bed picked at 30 percent leaves
 * something for the desk and the sofa behind it. When nothing in a category is that cheap the
 * pass falls back to the cheapest item that fits, so a need is never dropped for want of a bargain.
 */
const FIRST_PASS_SHARE = 0.3;

/** Square centimeters in a square meter, for the room-area rule behind a four-seat dining set. */
const CM2_PER_M2 = 10_000;

/** A room this size or larger seats four at dinner rather than two. */
const FOUR_SEAT_AREA_M2 = 16;

interface Part {
  category: Category;
  /** Words for the reason line, e.g. "low table" where the bare category would read "table". */
  label?: string;
  /** Narrows the category, e.g. cribs and single beds for a child's room. */
  only?: (c: CatalogItem) => boolean;
  /** How many to buy. Defaults to one. */
  count?: (room: Room) => number;
  /**
   * A nice-to-have. Taken only when it fits inside the first-pass share, so a nightstand can
   * never starve the desk behind it, and its absence never makes the need unmet.
   */
  optional?: boolean;
}

interface Bundle {
  key: string;
  /** Lower-case substrings; any hit maps the need to this bundle. */
  keywords: string[];
  parts: Part[];
}

const isLowTable = (c: CatalogItem) => c.height <= 50;
const isCribOrSingle = (c: CatalogItem) => c.id.startsWith('crib') || c.id === 'bed-single-90';
const isMirror = (c: CatalogItem) => c.shape === 'mirror';
const isShoeStorage = (c: CatalogItem) => c.id.startsWith('shoe-');

const diningSeats = (room: Room) => ((room.width * room.depth) / CM2_PER_M2 >= FOUR_SEAT_AREA_M2 ? 4 : 2);

/**
 * Need phrases to shopping lists, in the order they are tested.
 *
 * A need may hit more than one bundle ("sleep and study"), and each bundle is taken once however
 * many of its words appear, so "host two friends" buys one sofa rather than two.
 */
const BUNDLES: Bundle[] = [
  { key: 'sleep', keywords: ['sleep'], parts: [{ category: 'bed' }, { category: 'nightstand', optional: true }] },
  { key: 'work', keywords: ['work', 'desk', 'study', 'office'], parts: [{ category: 'desk' }, { category: 'chair' }] },
  {
    key: 'host',
    keywords: ['host', 'guest', 'friend', 'lounge', 'tv'],
    parts: [{ category: 'sofa' }, { category: 'table', label: 'low table', only: isLowTable, optional: true }],
  },
  { key: 'storage', keywords: ['storage', 'clothes', 'wardrobe'], parts: [{ category: 'wardrobe' }] },
  { key: 'dine', keywords: ['dine', 'eat', 'dinner'], parts: [{ category: 'table' }, { category: 'chair', count: diningSeats }] },
  { key: 'read', keywords: ['read', 'book'], parts: [{ category: 'shelf' }] },
  { key: 'kids', keywords: ['kids', 'kid', 'baby', 'child'], parts: [{ category: 'bed', label: 'crib or single bed', only: isCribOrSingle }] },
  { key: 'kitchen', keywords: ['kitchen', 'cook'], parts: [{ category: 'kitchen', label: 'kitchen counter' }, { category: 'appliance' }] },
  {
    key: 'hall',
    keywords: ['hall', 'entry', 'shoe'],
    parts: [{ category: 'storage', label: 'shoe rack', only: isShoeStorage }, { category: 'wall', label: 'wall mirror', only: isMirror, optional: true }],
  },
];

/** Every bundle a need phrase asks for, in bundle order, each at most once. */
function bundlesFor(need: string): Bundle[] {
  const phrase = need.toLowerCase();
  return BUNDLES.filter((b) => b.keywords.some((k) => phrase.includes(k)));
}

/** Does the piece fit the room in either orientation, at `MAX_FOOTPRINT_SHARE` per axis? */
function fitsRoom(room: Room, c: CatalogItem): boolean {
  const maxW = room.width * MAX_FOOTPRINT_SHARE;
  const maxD = room.depth * MAX_FOOTPRINT_SHARE;
  return [0, 90].some((r) => {
    const { w, h } = rotatedDims(c, r as 0 | 90);
    return w <= maxW && h <= maxD;
  });
}

/** The part's candidates, cheapest first. Ties break on id so the same room always plans the same. */
function candidatesFor(room: Room, part: Part): CatalogItem[] {
  return catalogFor(room)
    .filter((c) => c.category === part.category && (!part.only || part.only(c)) && fitsRoom(room, c))
    .sort((a, b) => a.price - b.price || a.id.localeCompare(b.id));
}

/**
 * The one piece to buy for this part, or null when the catalog has nothing that fits.
 *
 * Required parts prefer the cheapest inside the first-pass share and otherwise settle for the
 * cheapest that fits at all. Optional parts only ever take the first of those, so an extra
 * cannot spend the budget a later need is waiting on.
 */
function pick(candidates: CatalogItem[], remaining: number, optional: boolean): CatalogItem | null {
  const cap = remaining * FIRST_PASS_SHARE;
  const affordable = candidates.find((c) => c.price <= cap);
  if (affordable) return affordable;
  return optional ? null : candidates[0] ?? null;
}

const partLabel = (part: Part, chosen: CatalogItem) => part.label ?? chosen.name.toLowerCase();

/**
 * A shopping list for a room's brief, within its budget.
 *
 * Needs are read in the order the brief gives them, so the thing named first is furnished first
 * and whatever the budget cannot reach is named in `unmet` rather than quietly dropped. Nothing
 * here places anything: the plan is a list of catalog ids to hand to `suggest_positions` and
 * `apply_layout`. Deterministic — the same room and options always yield the same plan.
 */
export function suggestFurniture(room: Room, opts: { budget?: number; needs?: string[] } = {}): FurniturePlan {
  const needs = opts.needs ?? room.brief.needs;
  const budget = opts.budget ?? room.brief.budget;

  const items: FurniturePlanItem[] = [];
  const unmet: string[] = [];
  const alternatives: Record<string, FurnitureAlternative[]> = {};
  let remaining = budget;

  const record = (part: Part, chosen: CatalogItem, need: string) => {
    items.push({
      catalogId: chosen.id, name: chosen.name, category: chosen.category, price: chosen.price,
      reason: `cheapest ${partLabel(part, chosen)} that fits, covers '${need}'`,
    });
    remaining -= chosen.price;
  };

  const noteAlternatives = (candidates: CatalogItem[], chosen: CatalogItem) => {
    if (alternatives[chosen.id]) return;
    alternatives[chosen.id] = candidates
      .filter((c) => c.id !== chosen.id)
      .slice(0, 3)
      .map((c) => ({ catalogId: c.id, name: c.name, price: c.price }));
  };

  for (const need of needs) {
    const bundles = bundlesFor(need);
    if (bundles.length === 0) {
      unmet.push(need);
      continue;
    }
    let short = false;
    for (const part of bundles.flatMap((b) => b.parts)) {
      if (short) break;
      const candidates = candidatesFor(room, part);
      const wanted = part.count ? part.count(room) : 1;
      for (let n = 0; n < wanted; n++) {
        const chosen = pick(candidates, remaining, part.optional === true);
        if (!chosen) {
          // An optional extra simply goes unbought; a required one leaves the need short and
          // stops the rest of its list, so the budget is not spent on the trimmings.
          if (!part.optional) short = true;
          break;
        }
        if (chosen.price > remaining) {
          if (!part.optional) short = true;
          break;
        }
        record(part, chosen, need);
        noteAlternatives(candidates, chosen);
      }
    }
    if (short) unmet.push(need);
  }

  const total = items.reduce((sum, i) => sum + i.price, 0);
  return { items, total, remaining: budget - total, unmet, alternatives };
}
