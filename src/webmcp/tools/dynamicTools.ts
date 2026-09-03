// src/webmcp/tools/dynamicTools.ts
import type { ToolDef } from '../registry';
import { ok, fail } from '../results';
import { COORDS_NOTE, cm, idProp, numProp, rotationProp } from '../schemas';
import type { ToolContext } from './context';
import { itemsSummary, shortMetrics, shortViolations } from './context';
import { mutate } from './mutateTools';
import type { Analysis, CatalogItem, PlacedItem, Rotation } from '../../engine/types';
import { alternativesFor } from '../../engine/alternatives';

export function buildSelectionTools(ctx: ToolContext, item: PlacedItem, cat: CatalogItem): ToolDef[] {
  const who = `The user has selected: ${cat.name} (id ${item.id}), ${cat.width}x${cat.depth} cm at (${item.x}, ${item.y}) rotation ${item.rotation}${item.locked ? ', LOCKED' : ''}.`;
  return [
    {
      name: 'move_selected',
      description: `${who} Move it to a new center, optionally rotating. ${COORDS_NOTE}`,
      inputSchema: { type: 'object', properties: { x: cm('Center x'), y: cm('Center y'), rotation: rotationProp }, required: ['x', 'y'] },
      execute: (i) => mutate(ctx, { tool: 'move_selected', proposable: true, ops: [{ type: 'move', id: item.id, x: i['x'] as number, y: i['y'] as number, rotation: (i['rotation'] as Rotation | undefined) ?? item.rotation }] }),
    },
    {
      name: 'replace_selected',
      description: `${who} Replace it with another catalog item in the same spot.`,
      inputSchema: { type: 'object', properties: { catalogId: idProp('Replacement catalog id') }, required: ['catalogId'] },
      execute: (i) => mutate(ctx, { tool: 'replace_selected', proposable: true, ops: [{ type: 'swap', id: item.id, catalogId: i['catalogId'] as string }] }),
    },
    {
      name: 'remove_selected',
      description: `${who} Remove it from the room.`,
      inputSchema: { type: 'object', properties: {} },
      execute: () => mutate(ctx, { tool: 'remove_selected', proposable: true, ops: [{ type: 'remove', id: item.id }] }),
    },
    {
      name: 'find_alternatives_for_selected',
      description: `${who} List catalog items of the same category that would fit in its place, cheapest first, optionally under a price.`,
      inputSchema: { type: 'object', properties: { maxPrice: numProp('Maximum price in USD', 0) } },
      annotations: { readOnlyHint: true },
      execute: (i) => ok({ items: alternativesFor(ctx.store.getState().current(), item.id, i['maxPrice'] as number | undefined) }),
    },
  ];
}

const NO_PROPOSALS = () => fail('not_found', 'No open proposals; call get_room');
const UNKNOWN_ID = () => fail('not_found', 'Call get_room for proposal ids');

/** Applied results here mirror `mutate`'s applied shape exactly: status, ledgerId, violations, metrics, items. */
function applied(ctx: ToolContext, entryId: string, analysis: Analysis) {
  return ok({ status: 'applied', ledgerId: entryId, violations: shortViolations(analysis.violations), metrics: shortMetrics(analysis.metrics), items: itemsSummary(ctx.store.getState().current(), analysis) });
}

export function buildProposalTools(ctx: ToolContext): ToolDef[] {
  const proposals = () => ctx.store.getState().current().proposals;
  return [
    {
      name: 'apply_proposal',
      description: 'Apply one open proposal by id, applying its ghosted changes to the room. Only call this when the user has explicitly chosen that option. Open proposals and their ids are listed by get_room.',
      inputSchema: { type: 'object', properties: { proposalId: idProp('Proposal id') }, required: ['proposalId'] },
      execute: async (i) => {
        const id = i['proposalId'] as string;
        const s = ctx.store.getState();
        // A card from a gated tool applies through the tool itself, and answers as that tool would.
        if (s.pending.some((a) => a.id === id)) {
          const r = await s.acceptAction(id);
          return r.ok ? r.result : fail('rejected', r.message);
        }
        if (proposals().length === 0) return NO_PROPOSALS();
        const r = s.acceptProposal(id, 'agent');
        if (!r.ok) return r.error === 'not_found' ? UNKNOWN_ID() : fail(r.error, r.message);
        return applied(ctx, r.entry.id, r.analysis);
      },
    },
    {
      name: 'withdraw_proposal',
      description: 'Withdraw one of your open proposals by id.',
      inputSchema: { type: 'object', properties: { proposalId: idProp('Proposal id') }, required: ['proposalId'] },
      execute: (i) => {
        const id = i['proposalId'] as string;
        if (ctx.store.getState().rejectAction(id)) return ok({ status: 'withdrawn' });
        if (proposals().length === 0) return NO_PROPOSALS();
        return ctx.store.getState().rejectProposal(id) ? ok({ status: 'withdrawn' }) : UNKNOWN_ID();
      },
    },
    {
      name: 'apply_all_proposals',
      description: 'Apply every open proposal atomically, in order, as one ledger entry. Only when the user asked for all of them.',
      inputSchema: { type: 'object', properties: {} },
      execute: () => {
        // Atomic on purpose: one dispatch of every proposal's ops concatenated in order, so a
        // failure part-way leaves the room and the whole proposal set untouched rather than
        // half-applying and then discarding what never ran.
        const open = proposals();
        if (open.length === 0) return NO_PROPOSALS();
        const r = ctx.store.getState().dispatch({
          ops: open.flatMap((p) => p.ops), actor: 'agent', tool: 'apply_all_proposals',
          summary: `Accepted all proposals: ${open.map((p) => p.label).join(', ')}`,
        });
        if (!r.ok) return fail(r.error, r.message);
        const room = ctx.store.getState().current();
        ctx.store.setState({ rooms: { ...ctx.store.getState().rooms, [room.id]: { ...room, proposals: [] } } });
        return applied(ctx, r.entry.id, r.analysis);
      },
    },
  ];
}
