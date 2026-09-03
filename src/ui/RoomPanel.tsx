// src/ui/RoomPanel.tsx
import { useEffect, useState } from 'react';
import { useRoom } from '../store';
import HomeSection from './HomeSection';
import { BTN_PRIMARY, INPUT, LABEL, LINK, NUM } from './styles';

/**
 * The Room tab of the properties column: size, budget, needs and notes.
 *
 * Every field is a draft until its Apply button is pressed. Typing must never write to the
 * ledger, or a four-digit budget would land as four separate entries to undo.
 */
export default function RoomPanel() {
  const room = useRoom((s) => s.rooms[s.currentId]!);
  const dispatch = useRoom((s) => s.dispatch);
  const openDialog = useRoom((s) => s.openDialog);
  const setPropsTab = useRoom((s) => s.setPropsTab);

  const [size, setSize] = useState({ width: room.width, depth: room.depth, height: room.height });
  const [budget, setBudget] = useState(String(room.brief.budget));
  const [needs, setNeeds] = useState(room.brief.needs.join(', '));
  const [notes, setNotes] = useState(room.brief.notes);
  const [sizeError, setSizeError] = useState<string | null>(null);
  const [briefError, setBriefError] = useState<string | null>(null);

  // Re-seed when the room underneath changes: switching rooms, or the agent resizing the
  // shell by voice. The tab has to read as the room, not as whatever was typed into it once.
  useEffect(() => {
    setSize({ width: room.width, depth: room.depth, height: room.height });
    setSizeError(null);
  }, [room.id, room.width, room.depth, room.height]);
  useEffect(() => {
    setBudget(String(room.brief.budget));
    setNeeds(room.brief.needs.join(', '));
    setNotes(room.brief.notes);
    setBriefError(null);
  }, [room.id, room.brief]);

  const num = (v: string) => Math.max(1, Math.round(Number(v) || 1));
  const sizeChanged = size.width !== room.width || size.depth !== room.depth || size.height !== room.height;

  const applySize = () => {
    if (!sizeChanged) return;
    const r = dispatch({ actor: 'human', ops: [{ type: 'setShell', ...size, northWall: room.northWall }] });
    setSizeError(r.ok ? null : r.message);
  };
  const applyBrief = () => {
    const r = dispatch({
      actor: 'human',
      ops: [{
        type: 'setBrief',
        brief: {
          ...room.brief,
          budget: Math.max(0, Math.round(Number(budget) || 0)),
          needs: needs.split(',').map((n) => n.trim()).filter(Boolean),
          notes,
        },
      }],
    });
    setBriefError(r.ok ? null : r.message);
  };

  return (
    <div className="flex flex-col gap-3 p-3">
      <HomeSection />

      <section className="border-t border-line pt-3">
        <div className={`mb-1.5 ${LABEL}`}>Dimensions</div>
        <div className="grid grid-cols-3 gap-1.5">
          {(['width', 'depth', 'height'] as const).map((k) => (
            <label key={k} className="block">
              <span className="mb-1 block text-[11px] capitalize text-muted">{k}</span>
              <input
                className={`${INPUT} ${NUM}`}
                type="number"
                min={1}
                aria-label={`Room ${k} in cm`}
                value={size[k]}
                onChange={(e) => setSize({ ...size, [k]: num(e.target.value) })}
              />
            </label>
          ))}
        </div>
        <button
          className={`mt-2 w-full ${BTN_PRIMARY}`}
          disabled={!sizeChanged}
          title={sizeChanged ? 'Resize the room' : 'Change a number first'}
          onClick={applySize}
        >Apply size</button>
        {sizeError && <p className="mt-1.5 text-[11px] text-bad" role="alert">{sizeError}</p>}
        <p className="mt-1.5 text-[11px] leading-snug text-muted">Or ask your agent: <span className="text-fg">“make the room 400 by 500”</span>.</p>
      </section>

      <section className="border-t border-line pt-3">
        <div className={`mb-1.5 ${LABEL}`}>Brief</div>
        <label className="block">
          <span className="mb-1 block text-[11px] text-muted">Budget</span>
          <span className="flex h-8 items-center gap-1.5 rounded-md border border-line bg-raised px-2 transition-colors focus-within:border-accent/70">
            <span className="text-[11px] text-muted">$</span>
            <input
              className={`w-full bg-transparent text-[12.5px] text-fg outline-none ${NUM}`}
              type="number"
              min={0}
              aria-label="Budget in dollars"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
            />
          </span>
        </label>
        <label className="mt-2 block">
          <span className="mb-1 block text-[11px] text-muted">Needs</span>
          <input
            className={INPUT}
            aria-label="Needs, comma separated"
            placeholder="sleep, work from home"
            value={needs}
            onChange={(e) => setNeeds(e.target.value)}
          />
        </label>
        <label className="mt-2 block">
          <span className="mb-1 block text-[11px] text-muted">Notes</span>
          <textarea
            className="w-full rounded-md border border-line bg-raised px-2 py-1.5 text-[12.5px] leading-snug text-fg outline-none transition-colors hover:border-[var(--line-hi)] focus:border-accent/70 focus-visible:outline-none"
            rows={2}
            aria-label="Brief notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
        <button className={`mt-2 w-full ${BTN_PRIMARY}`} onClick={applyBrief}>Apply brief</button>
        {briefError && <p className="mt-1.5 text-[11px] text-bad" role="alert">{briefError}</p>}
      </section>

      <section className="flex flex-wrap gap-4 border-t border-line pt-3">
        <button className={LINK} onClick={() => openDialog('shell')}>Doors &amp; windows…</button>
        <button className={LINK} onClick={() => setPropsTab('style')}>Style…</button>
      </section>
    </div>
  );
}
