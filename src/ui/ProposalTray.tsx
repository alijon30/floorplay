// src/ui/ProposalTray.tsx
import { useRoom } from '../store';
import { metricsDelta } from '../engine/metrics';
import { BTN_PRIMARY, BTN_QUIET } from './styles';

const LABELS: Record<string, string> = { freeFloorPct: 'free floor %', minWalkwayCm: 'walkway cm', budgetUsed: 'budget $', openAreaCm2: 'open area cm²', violationCount: 'issues', budgetRemaining: 'remaining $' };

/** Which direction counts as an improvement for each metric. */
const HIGHER_IS_BETTER: Record<string, boolean> = { freeFloorPct: true, openAreaCm2: true, minWalkwayCm: true, budgetRemaining: true, budgetUsed: false, violationCount: false };

function deltaClass(key: string, before: number, after: number): string {
  const better = HIGHER_IS_BETTER[key];
  if (better === undefined || after === before) return 'text-neutral-200';
  return (after > before) === better ? 'text-emerald-300' : 'text-amber-300';
}

export default function ProposalTray() {
  const room = useRoom((s) => s.rooms[s.currentId]!);
  const hovered = useRoom((s) => s.ui.hoveredProposalId);
  const { acceptProposal, rejectProposal, hoverProposal } = useRoom((s) => s);
  // Empty, the tray is one muted line that `App` draws across the whole bar; there is nothing
  // to show here and no reason to hold half the width for it.
  if (room.proposals.length === 0) return null;
  return (
    <div className="flex h-full gap-2 overflow-x-auto p-2">
      {room.proposals.map((p) => {
        const delta = metricsDelta(p.metricsBefore, p.metricsAfter);
        return (
          <div
            key={p.id}
            className={`flex w-56 shrink-0 flex-col rounded-lg border p-2 text-xs transition-colors ${hovered === p.id ? 'border-emerald-500 bg-neutral-800' : 'border-neutral-800 bg-neutral-900/95'}`}
            onMouseEnter={() => hoverProposal(p.id)}
            onMouseLeave={() => hoverProposal(null)}
          >
            <div className="mb-1 flex items-center justify-between"><strong className="truncate">{p.label}</strong><span className="text-neutral-500">{p.ops.length} changes</span></div>
            <div className="flex-1 space-y-0.5 overflow-auto">
              {Object.entries(delta).slice(0, 4).map(([k, v]) => (
                <div key={k} className="flex justify-between"><span className="text-neutral-500">{LABELS[k] ?? k}</span><span>{v.before} → <span className={deltaClass(k, v.before, v.after)}>{v.after}</span></span></div>
              ))}
              {p.violationsAfter.length > 0 && <div className="text-red-300">{p.violationsAfter.length} issue{p.violationsAfter.length > 1 ? 's' : ''} after</div>}
            </div>
            <div className="mt-2 flex gap-1">
              <button className={`flex-1 ${BTN_PRIMARY}`} onClick={() => acceptProposal(p.id, 'human')}>Accept</button>
              <button className={`flex-1 ${BTN_QUIET}`} onClick={() => rejectProposal(p.id)}>Reject</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
