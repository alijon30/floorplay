// src/ui/AgentChip.tsx
import { webmcp, useRegistryVersion } from '../webmcp';

/**
 * Whether an agent is listening, and how much of this page it can reach.
 *
 * A dot and two words. The last tool called moves to the tooltip: it changes on every call,
 * and a chip that re-flows the top bar each time the agent does anything is worse than one
 * that stays put.
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
    <div className="flex h-7 shrink-0 items-center gap-2 px-1 text-[11.5px]" title={title}>
      <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${connected ? 'bg-ok' : 'bg-muted'}`} />
      <span className="whitespace-nowrap text-muted">{connected ? 'Agent connected' : 'No agent'}</span>
      <span className="whitespace-nowrap font-mono tabular-nums text-[11px] text-muted/70">{count} tools</span>
    </div>
  );
}
