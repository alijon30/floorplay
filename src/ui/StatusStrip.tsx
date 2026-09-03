// src/ui/StatusStrip.tsx
import { useRoom } from '../store';
import { findCatalogItem } from '../engine/catalog';
import { homeReachability, homeTotals } from '../engine/home';
import { Icon } from './icons';

type Tone = 'ok' | 'warn' | 'bad';

const TONE: Record<Tone, string> = { ok: 'text-fg', warn: 'text-warn', bad: 'text-bad' };

/** One reading: what it is, then the number, in mono so a row of them never jitters. */
function Stat({ label, value, tone = 'ok', hint }: { label: string; value: string; tone?: Tone; hint: string }) {
  return (
    <div title={hint} className="flex shrink-0 items-baseline gap-1.5">
      <span className="text-[10.5px] uppercase tracking-[0.07em] text-muted">{label}</span>
      <span className={`font-mono text-[11.5px] tabular-nums ${TONE[tone]}`}>{value}</span>
    </div>
  );
}

/**
 * The bottom rule: six numbers about the room as it stands — or about the whole home, while
 * the plan is showing one — the hour the sun is at, and who gets the last word on an agent's
 * change.
 *
 * Everything here is a reading rather than a control, apart from the two on the right — which
 * is why they are the only things separated off.
 */
export default function StatusStrip() {
  const room = useRoom((s) => s.rooms[s.currentId]!);
  const rooms = useRoom((s) => s.rooms);
  const m = useRoom((s) => s.analysis.metrics);
  const ui = useRoom((s) => s.ui);
  const selected = ui.selectedItemId;
  const home = useRoom((s) => s.currentHome());
  const setDaylightHour = useRoom((s) => s.setDaylightHour);
  const setProposeFirst = useRoom((s) => s.setProposeFirst);

  const lightTarget = (selected && room.items.find((i) => i.id === selected)) ?? room.items.find((i) => findCatalogItem(room, i.catalogId)?.category === 'desk');
  const lightName = lightTarget ? findCatalogItem(room, lightTarget.catalogId)?.name ?? 'item' : 'desk';
  const light = lightTarget ? Math.round((m.lightByItem[lightTarget.id] ?? 0) * 100) : null;
  const budgetPct = room.brief.budget > 0 ? m.budgetUsed / room.brief.budget : 0;
  const hour = `${String(room.daylightHour).padStart(2, '0')}:00`;

  // Stepping out to the whole home changes what the numbers are about: six readings of one
  // room become six of the flat, in the same places on the same rule.
  const homeStats = ui.planView === 'home' && home ? { totals: homeTotals(home, rooms), reach: homeReachability(home, rooms) } : null;

  return (
    <footer className="flex h-7 shrink-0 items-center gap-4 border-t border-line bg-panel px-3">
      {homeStats ? (
        <>
          <Stat label="Home" value={home!.name} hint="The floor plan the rooms below stand on." />
          <Stat label="Rooms" value={String(homeStats.totals.rooms)} hint="How many rooms are on this plan." />
          <Stat label="Area" value={`${homeStats.totals.areaM2} m²`} hint="Floor area of every room on the plan, added up." />
          <Stat label="Items" value={String(homeStats.totals.items)} hint="Everything placed in every room of the home." />
          <Stat
            label="Budget"
            value={`$${homeStats.totals.budgetUsed} / $${homeStats.totals.budget}`}
            tone={homeStats.totals.budget > 0 && homeStats.totals.budgetUsed > homeStats.totals.budget ? 'bad' : 'ok'}
            hint="What the whole home costs so far, against the budgets of its rooms added together."
          />
          <Stat
            label="Reachable"
            value={homeStats.reach.unreachable.length === 0 ? 'all rooms' : `${homeStats.reach.unreachable.length} room${homeStats.reach.unreachable.length === 1 ? '' : 's'} unreachable`}
            tone={homeStats.reach.unreachable.length === 0 ? 'ok' : 'warn'}
            hint="Rooms you can walk to from the front door through the doorways cut so far."
          />
        </>
      ) : (
        <>
          <Stat label="Free floor" value={`${m.freeFloorPct}%`} tone={m.freeFloorPct < 30 ? 'warn' : 'ok'} hint="Share of the floor no furniture stands on. Under 30% the room starts to feel packed." />
          <Stat label="Walkway" value={`${m.minWalkwayCm} cm`} tone={m.minWalkwayCm < 60 ? 'bad' : 'ok'} hint="Widest walkway that still reaches every item from the door. Under 60 cm is a squeeze." />
          <Stat label="Open area" value={`${(m.openAreaCm2 / 10000).toFixed(1)} m²`} hint="Largest single stretch of clear floor, in square metres." />
          <Stat label="Budget" value={`$${m.budgetUsed} / $${room.brief.budget}`} tone={budgetPct > 1 ? 'bad' : budgetPct > 0.9 ? 'warn' : 'ok'} hint="Total price of everything placed, against the budget in your brief." />
          <Stat label={`Light at ${lightName}`} value={light === null ? '—' : `${light}%`} tone={light !== null && light < 30 ? 'warn' : 'ok'} hint="Daylight reaching the named piece at the hour on this bar, where 100% is full sun. Select something to read it there instead." />
          <Stat label="Issues" value={String(m.violationCount)} tone={m.violationCount > 0 ? 'warn' : 'ok'} hint="Rules the layout breaks right now: overlaps, blocked doors, clearances too tight." />
        </>
      )}

      <div className="ml-auto flex shrink-0 items-center gap-3">
        <label className="flex items-center gap-1.5" title="The hour the sun is at, which is what the daylight overlay and the 3D light are drawn from">
          <Icon name="sun" size={13} className="text-muted" />
          <span className="w-9 font-mono text-[11.5px] tabular-nums text-muted">{hour}</span>
          <input
            type="range"
            className="w-24 shrink-0"
            min={6}
            max={20}
            value={room.daylightHour}
            onChange={(e) => setDaylightHour(Number(e.target.value))}
            aria-label="Daylight hour"
          />
        </label>
        <span aria-hidden="true" className="h-4 w-px bg-line" />
        <button
          role="switch"
          aria-checked={ui.proposeFirst}
          title="When on, every agent change becomes a proposal you accept on screen"
          onClick={() => setProposeFirst(!ui.proposeFirst)}
          className="flex items-center gap-1.5 rounded text-[11.5px] text-muted transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
        >
          <span className={`relative h-3.5 w-6 shrink-0 rounded-full transition-colors ${ui.proposeFirst ? 'bg-accent' : 'bg-line'}`}>
            <span className={`absolute top-0.5 h-2.5 w-2.5 rounded-full transition-all ${ui.proposeFirst ? 'left-3 bg-[var(--accent-ink)]' : 'left-0.5 bg-muted'}`} />
          </span>
          Propose first
        </button>
      </div>
    </footer>
  );
}
