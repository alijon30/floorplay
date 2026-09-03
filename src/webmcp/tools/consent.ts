// src/webmcp/tools/consent.ts
import type { ToolDef } from '../registry';
import { ok } from '../results';
import type { ToolContext } from './context';

/**
 * The tools that change the design without going through `mutate`, and so get their own gate.
 *
 * `mutate` already turns furniture and opening changes into ghost proposals while Propose first
 * is on. These change the room in ways a ghost cannot draw — paint, size, a whole template, a
 * home and its doorways — so they wait as cards beside the ghosts instead. Looking, selecting,
 * undoing and switching rooms are not changes to the design and never wait.
 */
export const GATED_TOOLS: ReadonlySet<string> = new Set([
  'set_room_shell', 'load_template', 'delete_room', 'set_finish', 'apply_palette', 'set_wall_color',
  'create_home', 'add_room_to_home', 'move_room', 'remove_room_from_home', 'cut_doorway', 'remove_doorway',
]);

export const PROPOSE_NOTE =
  'Propose-first mode is on. The user must accept this proposal on screen, or explicitly ask you to apply it (apply_proposal with this proposalId).';

const humanize = (tool: string): string => tool.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
const show = (v: unknown): string =>
  Array.isArray(v) ? v.map(show).join(', ') : typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v);

/** `Set wall color · wall right · color #2a3a5a`: the call, in the words the user reads on its card. */
export function describeCall(tool: string, input: Record<string, unknown>): string {
  const parts = Object.entries(input)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${k} ${show(v)}`);
  return [humanize(tool), ...parts].join(' · ');
}

/** The same tool, waiting for the user while Propose first is on and unchanged otherwise. */
export function withConsent(ctx: ToolContext, tool: ToolDef): ToolDef {
  if (!GATED_TOOLS.has(tool.name)) return tool;
  return {
    ...tool,
    execute: (input) => {
      const s = ctx.store.getState();
      if (!s.ui.proposeFirst) return tool.execute(input);
      const label = describeCall(tool.name, input);
      // The card runs the tool itself, not this wrapper, so accepting never queues it again.
      const action = s.queueAction({ tool: tool.name, label, run: () => tool.execute(input) });
      return ok({ status: 'proposed', proposalId: action.id, label, note: PROPOSE_NOTE });
    },
  };
}
