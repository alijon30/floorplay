// src/webmcp/tools/shoppingTools.ts
import type { ToolDef } from '../registry';
import { ok, fail } from '../results';
import { idProp, strProp } from '../schemas';
import type { ToolContext } from './context';
import { mutate } from './mutateTools';
import { searchQueryFor, shoppingList } from '../../engine/shopping';
import { findCatalogItem } from '../../engine/catalog';
import { PURCHASE_STATUSES, type Op, type Purchase, type PurchaseStatus } from '../../engine/types';

/**
 * The two tools that turn a drawing into a buyout.
 *
 * The division of labour is the point: the app knows what is in the room, how many of each and
 * what the catalog thinks it costs, and it can say all of that without a network. What it
 * cannot know is which shop near this particular person has the thing this week, and for how
 * much. So `get_shopping_list` hands the agent a list with a ready-made search string per line,
 * the agent goes and looks, and `set_purchase_status` writes the answer back onto the room.
 */

const STATUS_NOTE = `status is one of ${PURCHASE_STATUSES.join(', ')}. Absent means to-buy: everything in a freshly drawn room is still to buy.`;

export function buildShoppingTools(ctx: ToolContext): ToolDef[] {
  const room = () => ctx.store.getState().current();

  return [
    {
      name: 'get_shopping_list',
      description:
        'Everything placed in the room, grouped by catalog id into the list you would take shopping: quantity, unit price, line total, whether it is still to buy, and where it is coming from when someone has said. ' +
        'Sourcing is your job, not the user\'s: for every line without a source, search for the piece — online or near where the user lives, asking for their city if you need it — and record the shop and the listing with set_purchase_status, passing the catalogId. ' +
        `unsourced counts the lines still waiting for that. Every line carries a searchQuery you can hand straight to a shop or a search, and the room brief is included so you can respect the budget and the notes. ${STATUS_NOTE}`,
      inputSchema: { type: 'object', properties: {} },
      annotations: { readOnlyHint: true },
      execute: () => {
        const r = room();
        const list = shoppingList(r);
        return ok({
          lines: list.lines.map((l) => {
            const cat = findCatalogItem(r, l.catalogId);
            return {
              ...l,
              searchQuery: searchQueryFor(r, l),
              ...(cat ? { width: cat.width, depth: cat.depth, height: cat.height } : {}),
            };
          }),
          total: list.total,
          toBuy: list.toBuy,
          owned: list.owned,
          ordered: list.ordered,
          budget: list.budget,
          remaining: list.remaining,
          // How much sourcing is left. A line the user marked owned needs no shop, so it is not
          // counted: the number is the size of the errand, not the size of the room.
          unsourced: list.lines.filter((l) => !l.source && l.status !== 'owned').length,
          brief: r.brief,
          note: 'Prices are the catalog\'s guess, not a real quote. Replace them with what you actually find, by naming the shop and the link in set_purchase_status.',
        });
      },
    },
    {
      name: 'set_purchase_status',
      description:
        'Record where a piece is coming from and whether it still needs buying. Pass catalogId to mark every copy of that piece at once — the usual case, since two identical chairs are bought together — or id to mark one placement. ' +
        `source is the shop, url the listing; both are optional and both are kept when you only change the status. ${STATUS_NOTE}`,
      inputSchema: {
        type: 'object',
        properties: {
          catalogId: idProp('Catalog id, from get_shopping_list. Marks every placement of that piece'),
          id: idProp('A single placed item id, when only one of several copies is meant'),
          status: { type: 'string', description: 'Where this piece stands', enum: [...PURCHASE_STATUSES] },
          source: strProp('The shop it is coming from, as a person would say it: "IKEA Kungens Kurva"'),
          url: strProp('A link to the listing'),
        },
        required: ['status'],
      },
      execute: (input) => {
        const r = room();
        const status = input['status'] as PurchaseStatus;
        if (!PURCHASE_STATUSES.includes(status)) return fail('invalid_input', `Unknown status ${String(status)}; one of ${PURCHASE_STATUSES.join(', ')}`);
        const id = input['id'] as string | undefined;
        const catalogId = input['catalogId'] as string | undefined;
        if (id === undefined && catalogId === undefined) return fail('invalid_input', 'Pass catalogId to mark every copy of a piece, or id to mark one placement');

        const targets = id !== undefined ? r.items.filter((i) => i.id === id) : r.items.filter((i) => i.catalogId === catalogId);
        if (targets.length === 0) {
          return fail('not_found', id !== undefined ? `No placed item ${id}; call get_room for current ids` : `Nothing of ${catalogId} is placed; call get_shopping_list for what is`);
        }

        const source = input['source'] as string | undefined;
        const url = input['url'] as string | undefined;
        const name = findCatalogItem(r, targets[0]!.catalogId)?.name ?? targets[0]!.catalogId;
        // An unstated source does not erase one already recorded: an agent that only reports a
        // status change should not quietly lose the shop somebody typed in.
        const ops: Op[] = targets.map((item) => {
          const purchase: Purchase = {
            status,
            ...(source ?? item.purchase?.source ? { source: source ?? item.purchase!.source! } : {}),
            ...(url ?? item.purchase?.url ? { url: url ?? item.purchase!.url! } : {}),
          };
          return { type: 'setPurchase', id: item.id, purchase };
        });

        const where = source ? ` from ${source}` : '';
        // Not proposable: this changes no geometry and nothing on the plan moves, so making
        // someone accept a proposal to record where a chair came from would be theatre.
        return mutate(ctx, {
          tool: 'set_purchase_status',
          proposable: false,
          ops,
          summary: `Marked ${targets.length > 1 ? `${targets.length} × ` : ''}${name} ${status}${where}`,
        });
      },
    },
  ];
}
