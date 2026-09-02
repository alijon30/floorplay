// src/webmcp/tools/dynamicTools.ts
import type { ToolDef } from '../registry';
import { ok, fail } from '../results';
import { COORDS_NOTE, cm, idProp, numProp, rotationProp } from '../schemas';
import type { ToolContext } from './context';
import { shortMetrics, shortViolations } from './context';
import { mutate } from './mutateTools';
import type { CatalogItem, PlacedItem, Rotation } from '../../engine/types';
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

export function buildProposalTools(ctx: ToolContext): ToolDef[] {
  const list = () => ctx.store.getState().current().proposals.map((p) => `${p.id} "${p.label}"`).join(', ');
  return [
    {
      name: 'apply_proposal',
      description: `Apply one open proposal by id. Only call this when the user has explicitly chosen it. Open proposals: ${list()}.`,
      inputSchema: { type: 'object', properties: { proposalId: idProp('Proposal id') }, required: ['proposalId'] },
      execute: (i) => {
        const r = ctx.store.getState().acceptProposal(i['proposalId'] as string, 'agent');
        if (!r.ok) return fail(r.error, r.message);
        return ok({ status: 'applied', ledgerId: r.entry.id, violations: shortViolations(r.analysis.violations), metrics: shortMetrics(r.analysis.metrics) });
      },
    },
    {
      name: 'withdraw_proposal',
      description: `Withdraw one of your open proposals by id. Open proposals: ${list()}.`,
      inputSchema: { type: 'object', properties: { proposalId: idProp('Proposal id') }, required: ['proposalId'] },
      execute: (i) => (ctx.store.getState().rejectProposal(i['proposalId'] as string) ? ok({ status: 'withdrawn' }) : fail('not_found', 'No such proposal')),
    },
    {
      name: 'apply_all_proposals',
      description: 'Apply every open proposal in order. Only when the user asked for all of them.',
      inputSchema: { type: 'object', properties: {} },
      execute: () => {
        const s = ctx.store.getState();
        const ids = s.current().proposals.map((p) => p.id);
        let last;
        for (const id of ids) {
          const p = ctx.store.getState().current().proposals.find((x) => x.id === id);
          if (!p) continue;
          last = mutate(ctx, { tool: 'apply_all_proposals', proposable: false, ops: p.ops, summary: `Accepted proposal: ${p.label}` });
        }
        const room = ctx.store.getState().current();
        ctx.store.setState({ rooms: { ...ctx.store.getState().rooms, [room.id]: { ...room, proposals: [] } } });
        return last ?? fail('not_found', 'No open proposals');
      },
    },
  ];
}
