// src/plan/PlanViewToggle.tsx
import { useCallback, useRef, useState } from 'react';
import { useRoom } from '../store';
import { homeContaining } from '../engine/home';
import { useDismiss } from '../ui/useDismiss';
import { useJoinHome } from '../ui/homeActions';
import { Icon } from '../ui/icons';
import { PLAN_MENU, PLAN_MENU_ITEM, PLAN_MENU_LABEL } from './Tool';

const CELL = 'inline-flex h-[22px] shrink-0 items-center gap-1 rounded-[4px] px-2 text-[11px] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent';
const OFF = `${CELL} text-[var(--plan-dim)] hover:text-[var(--plan-ink)]`;
const ON = `${CELL} bg-[var(--accent-fill)] font-medium text-accent`;

/**
 * Which of the two things the left viewport draws: this room, or the home it stands in.
 *
 * The Home half is not disabled when the room is in no home — it opens the short list of
 * homes to put it on instead. A control that greys out is a dead end; this one answers the
 * question the press was really asking.
 */
export default function PlanViewToggle() {
  const homes = useRoom((s) => s.homes);
  const currentId = useRoom((s) => s.currentId);
  const planView = useRoom((s) => s.ui.planView);
  const setPlanView = useRoom((s) => s.setPlanView);
  const { homes: others, join, start } = useJoinHome();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const anchor = useRef<HTMLDivElement>(null);
  const close = useCallback(() => { setOpen(false); setError(null); }, []);
  useDismiss(open, anchor, close);

  const home = homeContaining(homes, currentId);

  const run = (r: { ok: true } | { ok: false; error: string }) => (r.ok ? close() : setError(r.error));

  return (
    <div className="relative" ref={anchor}>
      <div role="group" aria-label="Plan view" className="inline-flex h-7 shrink-0 items-center gap-px rounded-md border border-black/8 bg-white/70 p-px">
        <button
          type="button"
          aria-pressed={planView === 'room'}
          title="Draw this room on its own"
          className={planView === 'room' ? ON : OFF}
          onClick={() => { close(); setPlanView('room'); }}
        >Plan</button>
        <button
          type="button"
          aria-pressed={planView === 'home'}
          aria-expanded={home ? undefined : open}
          title={home ? `Draw the whole of ${home.name}` : 'Put this room on a floor plan with others'}
          className={planView === 'home' ? ON : OFF}
          onClick={() => (home ? setPlanView('home') : setOpen((o) => !o))}
        ><Icon name="home" size={12} />Home</button>
      </div>

      {open && !home && (
        <div className={`${PLAN_MENU} w-60`}>
          <div className={PLAN_MENU_LABEL}>Add this room to a home…</div>
          {others.map((h) => (
            <button key={h.id} className={PLAN_MENU_ITEM} onClick={() => run(join(h.id))}>
              <span className="min-w-0 flex-1 truncate">{h.name}</span>
              <span className="shrink-0 font-mono text-[10.5px] tabular-nums text-[var(--plan-dim)]">{h.rooms.length} rooms</span>
            </button>
          ))}
          {others.length > 0 && <div className="my-1 h-px bg-black/8" />}
          <button className={PLAN_MENU_ITEM} onClick={() => run(start())}>
            <Icon name="plus" size={12} />New home
          </button>
          {error && <p className="px-2 pb-1 pt-1.5 text-[11px] leading-snug text-bad" role="alert">{error}</p>}
        </div>
      )}
    </div>
  );
}
