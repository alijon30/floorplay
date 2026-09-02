// src/ui/AgentChip.tsx
import { webmcp, useRegistryVersion } from '../webmcp';

export default function AgentChip() {
  useRegistryVersion();
  const count = webmcp.registry.listTools().length;
  const last = webmcp.registry.lastCall;
  const dot = webmcp.isNative ? 'bg-emerald-400' : 'bg-neutral-500';
  return (
    <div className="flex items-center gap-2 rounded-full border border-neutral-700 px-3 py-1 text-xs text-neutral-300" title={webmcp.isNative ? 'WebMCP detected' : 'No WebMCP agent connected. Open this page in ChatGPT or Chrome with WebMCP enabled.'}>
      <span className={`inline-block h-2 w-2 rounded-full ${dot}`} />
      <span>{webmcp.isNative ? 'Agent connected' : 'No agent'}</span>
      <span className="text-neutral-500">{count} tools</span>
      {last && <span className="text-neutral-500">last: {last.name}{last.ok ? '' : ' (failed)'}</span>}
    </div>
  );
}
