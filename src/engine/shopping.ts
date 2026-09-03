// src/engine/shopping.ts
import { findCatalogItem } from './catalog';
import type { Category, PurchaseStatus, Room } from './types';

/**
 * One row of the shopping list: everything of one catalog id, counted and priced together.
 *
 * The grouping is by catalog id rather than by placement because that is what a shop sells.
 * Two identical chairs are one line reading "2", not two lines reading "1"; `itemIds` keeps
 * the placements behind the line so a status change can reach every one of them.
 */
export interface ShoppingLine {
  catalogId: string;
  name: string;
  category: Category;
  qty: number;
  unitPrice: number;
  lineTotal: number;
  status: PurchaseStatus;
  source?: string;
  url?: string;
  itemIds: string[];
}

export interface ShoppingList {
  lines: ShoppingLine[];
  /** Everything in the room, whatever its status. */
  total: number;
  /** The three totals split by status. `toBuy` is the number the budget is actually spent on. */
  toBuy: number;
  owned: number;
  ordered: number;
  budget: number;
  /** Budget less what is still to buy. Negative when the list has outrun the brief. */
  remaining: number;
}

/**
 * How a line reads when its placements disagree.
 *
 * Something still unbought is the fact that matters — a line reading "owned" when one of the
 * two chairs has yet to be found would send someone to the shops with the wrong list — so a
 * mixed line takes the least-finished status of the group.
 */
const RANK: Record<PurchaseStatus, number> = { 'to-buy': 0, ordered: 1, owned: 2 };

/**
 * What the room still costs to build, grouped the way it would be bought.
 *
 * Prices come from the catalog rather than from the placement, so a line is worth what the
 * app believes the piece costs; the agent's job is to replace that belief with a real shop and
 * a real link, which is what `source` and `url` are for.
 */
export function shoppingList(room: Room): ShoppingList {
  const byCatalog = new Map<string, ShoppingLine>();
  for (const item of room.items) {
    const cat = findCatalogItem(room, item.catalogId);
    if (!cat) continue;
    const status = item.purchase?.status ?? 'to-buy';
    const line = byCatalog.get(item.catalogId);
    if (!line) {
      byCatalog.set(item.catalogId, {
        catalogId: cat.id,
        name: cat.name,
        category: cat.category,
        qty: 1,
        unitPrice: cat.price,
        lineTotal: cat.price,
        status,
        ...(item.purchase?.source ? { source: item.purchase.source } : {}),
        ...(item.purchase?.url ? { url: item.purchase.url } : {}),
        itemIds: [item.id],
      });
      continue;
    }
    line.qty += 1;
    line.lineTotal += cat.price;
    line.itemIds.push(item.id);
    if (RANK[status] < RANK[line.status]) line.status = status;
    // The first placement that names a shop names it for the whole line: one row cannot send
    // you to two different stores, and a stated source beats an unstated one.
    if (line.source === undefined && item.purchase?.source) line.source = item.purchase.source;
    if (line.url === undefined && item.purchase?.url) line.url = item.purchase.url;
  }

  const lines = [...byCatalog.values()].sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  const sum = (want: PurchaseStatus) => lines.filter((l) => l.status === want).reduce((n, l) => n + l.lineTotal, 0);
  const toBuy = sum('to-buy');
  const budget = room.brief.budget;
  return {
    lines,
    total: lines.reduce((n, l) => n + l.lineTotal, 0),
    toBuy,
    owned: sum('owned'),
    ordered: sum('ordered'),
    budget,
    remaining: budget - toBuy,
  };
}

/** The list as plain text, for the clipboard and for anything that reads a message rather than JSON. */
export function shoppingListText(room: Room): string {
  const list = shoppingList(room);
  const rows = list.lines.map((l) => {
    const where = l.source ? ` — ${l.source}${l.url ? ` (${l.url})` : ''}` : '';
    const qty = l.qty > 1 ? ` x${l.qty}` : '';
    return `- [${l.status}] ${l.name}${qty} — $${l.lineTotal}${where}`;
  });
  return [
    `${room.name} — shopping list`,
    ...rows,
    '',
    `Still to buy: $${list.toBuy} of a $${list.budget} budget (${list.remaining >= 0 ? `$${list.remaining} left` : `$${-list.remaining} over`}).`,
  ].join('\n');
}

/**
 * The search string an agent takes to a shop for one line.
 *
 * It lives here, beside the list, because the Buy tab shows the user the very query the agent
 * will run — "agent query:" under each row is a promise, and a second copy of this formula in
 * the tool layer would eventually break it. Width and depth come from the catalog rather than
 * the line, so the query is specific enough to reject a chair of the wrong size; the ceiling is
 * the catalog's price with a little headroom, since a real shop is rarely a guess to the dollar.
 */
export function searchQueryFor(room: Room, line: Pick<ShoppingLine, 'catalogId' | 'name' | 'unitPrice'>): string {
  const cat = findCatalogItem(room, line.catalogId);
  return `${line.name.toLowerCase()} ${cat?.width ?? 0}x${cat?.depth ?? 0} cm under $${Math.max(1, Math.round(line.unitPrice * 1.15))}`;
}
