// src/ui/ProposalTray.tsx
import { useRoom } from '../store';
import { metricsDelta } from '../engine/metrics';

const LABELS: Record<string, string> = { freeFloorPct: 'free floor %', minWalkwayCm: 'walkway cm', budgetUsed: 'budget $', openAreaCm2: 'open area cm²', violationCount: 'issues', budgetRemaining: 'remaining $' };

export default function ProposalTray() {
  const room = useRoom((s) => s.rooms[s.currentId]!);
  const hovered = useRoom((s) => s.ui.hoveredProposalId);
  const { acceptProposal, rejectProposal, hoverProposal } = useRoom((s) => s);
  if (room.proposals.length === 0) {
    return <div className="flex h-full items-center justify-center px-4 text-center text-xs text-neutral-600">No proposals yet. Ask your agent for layout options and they will appear here as cards, with ghosts on the plan.</div>;
  }
  return (
    <div className="flex h-full gap-2 overflow-x-auto p-2">
      {room.proposals.map((p) => {
        const delta = metricsDelta(p.metricsBefore, p.metricsAfter);
        return (
          <div
            key={p.id}
            className={`flex w-56 shrink-0 flex-col rounded-lg border p-2 text-xs ${hovered === p.id ? 'border-emerald-500 bg-neutral-800' : 'border-neutral-700 bg-neutral-900'}`}
            onMouseEnter={() => hoverProposal(p.id)}
            onMouseLeave={() => hoverProposal(null)}
          >
            <div className="mb-1 flex items-center justify-between"><strong className="truncate">{p.label}</strong><span className="text-neutral-500">{p.ops.length} changes</span></div>
            <div className="flex-1 space-y-0.5 overflow-auto">
              {Object.entries(delta).slice(0, 4).map(([k, v]) => (
                <div key={k} className="flex justify-between"><span className="text-neutral-500">{LABELS[k] ?? k}</span><span>{v.before} → <span className={v.after >= v.before ? 'text-emerald-300' : 'text-amber-300'}>{v.after}</span></span></div>
              ))}
              {p.violationsAfter.length > 0 && <div className="text-red-300">{p.violationsAfter.length} issue{p.violationsAfter.length > 1 ? 's' : ''} after</div>}
            </div>
            <div className="mt-2 flex gap-1">
              <button className="flex-1 rounded bg-emerald-700 px-2 py-1 hover:bg-emerald-600" onClick={() => acceptProposal(p.id, 'human')}>Accept</button>
              <button className="flex-1 rounded bg-neutral-800 px-2 py-1 hover:bg-neutral-700" onClick={() => rejectProposal(p.id)}>Reject</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
