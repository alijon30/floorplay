// src/ui/AgentChip.tsx
import { webmcp, useRegistryVersion } from '../webmcp';

/**
 * Whether an agent is listening, and how much of this page it can reach.
 *
 * The last tool called moves to the tooltip: it changes on every call, and a chip that
 * re-flows the toolbar each time the agent does anything is worse than one that stays put.
 */
export default function AgentChip() {
  useRegistryVersion();
  const count = webmcp.registry.listTools().length;
  const last = webmcp.registry.lastCall;
  const connected = webmcp.isNative;
  const state = connected
    ? 'WebMCP detected'
    : 'No WebMCP agent connected. Open this page in ChatGPT or Chrome with WebMCP enabled.';
  const title = last ? `${state}\nLast call: ${last.name}${last.ok ? '' : ' (failed)'}` : state;
  return (
    <div
      className="flex h-8 shrink-0 items-center gap-2 rounded-full border border-neutral-800 bg-neutral-900 px-3 text-xs text-neutral-300"
      title={title}
    >
      <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${connected ? 'bg-emerald-400' : 'bg-neutral-500'}`} />
      <span className="whitespace-nowrap">{connected ? 'Agent connected' : 'No agent'}</span>
      <span className="whitespace-nowrap text-neutral-500">· {count} tools</span>
    </div>
  );
}
