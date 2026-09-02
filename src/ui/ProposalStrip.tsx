// src/ui/ProposalStrip.tsx
import { useRoom } from '../store';
import { findCatalogItem } from '../engine/catalog';
import { footprint } from '../engine/geometry';
import { metricsDelta } from '../engine/metrics';
import { ghostsFor } from '../plan/ghosts';
import { ACCENT, BAD, INK, INK_SOFT, PAPER } from '../plan/tokens';
import type { Proposal, Room } from '../engine/types';
import { BTN_PRIMARY, BTN_QUIET, CARD, NUM } from './styles';

const LABELS: Record<string, string> = { freeFloorPct: 'Free floor', minWalkwayCm: 'Walkway', budgetUsed: 'Budget', openAreaCm2: 'Open area', violationCount: 'Issues', budgetRemaining: 'Remaining' };
const UNITS: Record<string, (v: number) => string> = {
  freeFloorPct: (v) => `${v}%`,
  minWalkwayCm: (v) => `${v}`,
  budgetUsed: (v) => `$${v}`,
  budgetRemaining: (v) => `$${v}`,
  openAreaCm2: (v) => `${(v / 10000).toFixed(1)}`,
  violationCount: (v) => `${v}`,
};

/** Which direction counts as an improvement for each metric. */
const HIGHER_IS_BETTER: Record<string, boolean> = { freeFloorPct: true, openAreaCm2: true, minWalkwayCm: true, budgetRemaining: true, budgetUsed: false, violationCount: false };

function deltaClass(key: string, before: number, after: number): string {
  const better = HIGHER_IS_BETTER[key];
  if (better === undefined || after === before) return 'text-fg';
  return (after > before) === better ? 'text-ok' : 'text-warn';
}

const THUMB = 72;

/**
 * The proposal in miniature: the room's outline, what is in it now, and where this option
 * would put things. Same drawing language as the plan itself, at a twelfth the size.
 */
function Thumb({ room, proposal }: { room: Room; proposal: Proposal }) {
  const pad = 6;
  const scale = (THUMB - pad * 2) / Math.max(room.width, room.depth);
  const w = room.width * scale, h = room.depth * scale;
  const ghosts = ghostsFor(room, [proposal], proposal.id);
  return (
    <svg width={THUMB} height={THUMB} viewBox={`0 0 ${THUMB} ${THUMB}`} className="shrink-0 rounded" aria-hidden="true" focusable="false">
      <rect x={0} y={0} width={THUMB} height={THUMB} rx={4} fill={PAPER} />
      <g transform={`translate(${(THUMB - w) / 2} ${(THUMB - h) / 2}) scale(${scale})`}>
        <rect x={0} y={0} width={room.width} height={room.depth} fill="none" stroke={INK} strokeWidth={1 / scale} />
        {room.items.map((i) => {
          const cat = findCatalogItem(room, i.catalogId);
          if (!cat) return null;
          const r = footprint(i, cat);
          return <rect key={i.id} x={r.x} y={r.y} width={r.w} height={r.h} fill={INK_SOFT} opacity={0.16} />;
        })}
        {ghosts.map((g) => (
          <rect
            key={`${g.proposalId}:${g.opIndex}`}
            x={g.rect.x} y={g.rect.y} width={g.rect.w} height={g.rect.h}
            fill={g.kind === 'remove' ? 'none' : ACCENT} fillOpacity={0.14}
            stroke={g.kind === 'remove' ? BAD : ACCENT} strokeWidth={1 / scale} strokeDasharray={`${3 / scale} ${2 / scale}`}
          />
        ))}
      </g>
    </svg>
  );
}

/**
 * The agent's options, floating over the top of the plan they describe.
 *
 * Hovering a card lights its ghosts on the drawing underneath and dims the rest, so the
 * comparison happens on the plan rather than between two columns of numbers.
 */
export default function ProposalStrip() {
  const room = useRoom((s) => s.rooms[s.currentId]!);
  const hovered = useRoom((s) => s.ui.hoveredProposalId);
  const { acceptProposal, rejectProposal, hoverProposal } = useRoom((s) => s);
  if (room.proposals.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-9 z-20 flex justify-center px-3">
      <div className="pointer-events-auto flex max-w-full gap-2 overflow-x-auto pb-1">
        {room.proposals.map((p) => {
          const delta = metricsDelta(p.metricsBefore, p.metricsAfter);
          const rows = Object.entries(delta).slice(0, 3);
          return (
            <article
              key={p.id}
              role="group"
              aria-label={p.label}
              className={`flex w-[268px] shrink-0 flex-col overflow-hidden transition-colors ${CARD} ${hovered === p.id ? 'border-accent/60' : ''}`}
              onMouseEnter={() => hoverProposal(p.id)}
              onMouseLeave={() => hoverProposal(null)}
            >
              <div className="flex gap-2.5 p-2.5">
                <Thumb room={room} proposal={p} />
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="truncate text-[12.5px] font-medium leading-tight text-fg">{p.label}</div>
                  <div className="mb-1 text-[10.5px] uppercase tracking-[0.06em] text-muted">{p.ops.length} changes</div>
                  <dl className="space-y-px">
                    {rows.map(([k, v]) => (
                      <div key={k} className="flex items-baseline justify-between gap-2">
                        <dt className="truncate text-[11px] text-muted">{LABELS[k] ?? k}</dt>
                        <dd className={`shrink-0 text-[11px] ${NUM}`}>
                          <span className="text-muted">{(UNITS[k] ?? String)(v.before)}</span>
                          <span className="text-muted/60"> → </span>
                          <span className={deltaClass(k, v.before, v.after)}>{(UNITS[k] ?? String)(v.after)}</span>
                        </dd>
                      </div>
                    ))}
                    {p.violationsAfter.length > 0 && (
                      <div className="pt-0.5 text-[11px] text-bad">{p.violationsAfter.length} issue{p.violationsAfter.length > 1 ? 's' : ''} after</div>
                    )}
                  </dl>
                </div>
              </div>
              <div className="flex gap-1.5 border-t border-line p-2">
                <button className={`flex-1 ${BTN_PRIMARY}`} onClick={() => acceptProposal(p.id, 'human')}>Accept</button>
                <button className={`flex-1 ${BTN_QUIET}`} onClick={() => rejectProposal(p.id)}>Reject</button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
