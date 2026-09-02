// src/ui/RoomPanel.tsx
import { useEffect, useState } from 'react';
import { useRoom } from '../store';
import { BTN_PRIMARY, CARD, CLOSE, INPUT, LABEL, LINK } from './styles';

/**
 * The room's own card on the right rail: size, budget, needs and notes.
 *
 * It stands where the inspector stands, and shows whenever nothing is selected, so the two
 * numbers people reach for most — how big the room is and how much they can spend — are on
 * screen instead of behind a top bar button.
 *
 * Every field is a draft until its Apply button is pressed. Typing must never write to the
 * ledger, or a four-digit budget would land as four separate entries to undo.
 */
export default function RoomPanel() {
  const room = useRoom((s) => s.rooms[s.currentId]!);
  const dispatch = useRoom((s) => s.dispatch);
  const openDialog = useRoom((s) => s.openDialog);
  const setRoomPanelOpen = useRoom((s) => s.setRoomPanelOpen);

  const [size, setSize] = useState({ width: room.width, depth: room.depth, height: room.height });
  const [budget, setBudget] = useState(String(room.brief.budget));
  const [needs, setNeeds] = useState(room.brief.needs.join(', '));
  const [notes, setNotes] = useState(room.brief.notes);
  const [sizeError, setSizeError] = useState<string | null>(null);
  const [briefError, setBriefError] = useState<string | null>(null);

  // Re-seed when the room underneath changes: switching rooms, or the agent resizing the
  // shell by voice. The card has to read as the room, not as whatever was typed into it once.
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
    <div className={`w-full p-3 text-sm ${CARD}`}>
      <div className="mb-2 flex items-baseline gap-2">
        <strong>Room</strong>
        <span className="ml-auto min-w-0 truncate text-[11px] text-neutral-500" title={room.name}>{room.name}</span>
        <button
          className={CLOSE}
          aria-label="Close the room panel"
          title="Close. The Room button in the top bar brings it back."
          onClick={() => setRoomPanelOpen(false)}
        >×</button>
      </div>

      <div className={`mb-1 ${LABEL}`}>Size (cm)</div>
      <div className="grid grid-cols-3 gap-1.5">
        {(['width', 'depth', 'height'] as const).map((k) => (
          <label key={k} className="block text-[11px] text-neutral-400">
            <span className="capitalize">{k}</span>
            <input
              className={`mt-0.5 w-full ${INPUT}`}
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
        className={`mt-1.5 w-full ${BTN_PRIMARY}`}
        disabled={!sizeChanged}
        title={sizeChanged ? 'Resize the room' : 'Change a number first'}
        onClick={applySize}
      >Apply size</button>
      {sizeError && <p className="mt-1 text-[11px] text-red-400" role="alert">{sizeError}</p>}
      <p className="mt-1 text-[11px] text-neutral-500">Tip: ask your agent “make the room 400 by 500” to do this by voice.</p>

      <div className="mt-3 border-t border-neutral-800 pt-2">
        <div className={`mb-1 ${LABEL}`}>Brief</div>
        <label className="block text-[11px] text-neutral-400">
          Budget
          <span className="mt-0.5 flex h-8 items-center gap-1 rounded-md border border-neutral-700 bg-neutral-800 px-2">
            <span className="text-xs text-neutral-500">$</span>
            <input
              className="w-full bg-transparent text-xs text-neutral-100 outline-none"
              type="number"
              min={0}
              aria-label="Budget in dollars"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
            />
          </span>
        </label>
        <label className="mt-1.5 block text-[11px] text-neutral-400">
          Needs (comma separated)
          <input
            className={`mt-0.5 w-full ${INPUT}`}
            aria-label="Needs, comma separated"
            value={needs}
            onChange={(e) => setNeeds(e.target.value)}
          />
        </label>
        <label className="mt-1.5 block text-[11px] text-neutral-400">
          Notes
          <textarea
            className="mt-0.5 w-full rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1 text-xs text-neutral-100 outline-none transition-colors hover:border-neutral-600 focus-visible:ring-2 focus-visible:ring-emerald-500"
            rows={2}
            aria-label="Brief notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
        <button className={`mt-1.5 w-full ${BTN_PRIMARY}`} onClick={applyBrief}>Apply brief</button>
        {briefError && <p className="mt-1 text-[11px] text-red-400" role="alert">{briefError}</p>}
      </div>

      <div className="mt-2 flex flex-wrap gap-3 border-t border-neutral-800 pt-2">
        <button className={LINK} onClick={() => openDialog('shell')}>Doors &amp; windows…</button>
        <button className={LINK} onClick={() => openDialog('style')}>Style…</button>
      </div>
    </div>
  );
}
