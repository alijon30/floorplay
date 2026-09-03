// src/ui/ShellDialog.tsx
import { useState } from 'react';
import Modal from './Modal';
import { useRoom } from '../store';
import { WALLS, type Wall } from '../engine/types';
import type { Opening } from '../engine/types';
import { newId } from '../engine/ids';
import { Icon } from './icons';
import { BTN_PRIMARY, BTN_QUIET, FOCUS, INPUT, LABEL, NUM } from './styles';

export default function ShellDialog({ onClose }: { onClose: () => void }) {
  const room = useRoom((s) => s.rooms[s.currentId]!);
  const dispatch = useRoom((s) => s.dispatch);
  const [dims, setDims] = useState({ width: room.width, depth: room.depth, height: room.height });
  const [draft, setDraft] = useState<{ kind: 'door' | 'window'; wall: Wall; offset: number; width: number }>({ kind: 'window', wall: 'top', offset: 100, width: 100 });
  const [error, setError] = useState<string | null>(null);
  const saveDims = () => {
    const r = dispatch({ actor: 'human', ops: [{ type: 'setShell', ...dims, northWall: room.northWall }] });
    setError(r.ok ? null : r.message);
  };
  const addOpening = () => {
    const opening = draft.kind === 'door'
      ? { id: newId('door'), kind: 'door' as const, wall: draft.wall, offset: draft.offset, width: draft.width, height: 200, swing: 'in' as const, hinge: 'start' as const }
      : { id: newId('window'), kind: 'window' as const, wall: draft.wall, offset: draft.offset, width: draft.width, height: 120, sill: 90 };
    const r = dispatch({ actor: 'human', ops: [{ type: 'addOpening', opening }] });
    setError(r.ok ? null : r.message);
  };
  const num = (v: string) => Math.max(1, Number(v) || 1);
  const moveOpening = (o: Opening, value: string) => {
    const offset = Math.round(Number(value));
    if (!Number.isFinite(offset) || offset === o.offset) return;
    const r = dispatch({ actor: 'human', ops: [{ type: 'moveOpening', id: o.id, wall: o.wall, offset }] });
    setError(r.ok ? null : r.message);
  };
  return (
    <Modal title="Room shell" onClose={onClose}>
      <div className={`mb-2 ${LABEL}`}>Size (cm)</div>
      <div className="mb-2.5 grid grid-cols-3 gap-1.5">
        {(['width', 'depth', 'height'] as const).map((k) => (
          <label key={k} className="block">
            <span className="mb-1 block text-[11px] capitalize text-muted">{k}</span>
            <input className={`${INPUT} ${NUM}`} type="number" aria-label={`Shell ${k} in cm`} value={dims[k]} onChange={(e) => setDims({ ...dims, [k]: num(e.target.value) })} />
          </label>
        ))}
      </div>
      {/* The same op the Room tab calls "Apply size", so it carries the same words. */}
      <button className={`mb-5 ${BTN_PRIMARY}`} onClick={saveDims}>Apply size</button>

      <div className={`mb-2 ${LABEL}`}>Doors and windows</div>
      <ul className="mb-2.5 divide-y divide-line rounded-md border border-line">
        {room.openings.map((o) => (
          <li key={o.id} className="flex items-center gap-2 px-2 py-1.5 text-[11.5px]">
            <Icon name={o.kind === 'door' ? 'room' : 'grid'} size={13} className="text-muted" />
            <span className="capitalize text-fg">{o.kind}</span>
            <span className={`text-muted ${NUM}`}>{o.wall} ·</span>
            <label className="flex items-center gap-1 text-muted">
              offset
              <input
                key={`${o.id}:${o.offset}`}
                className={`${INPUT} ${NUM} w-16 py-0.5`}
                type="number"
                defaultValue={o.offset}
                disabled={!!o.doorwayId}
                title={o.doorwayId ? 'A doorway between rooms moves from the Home plan' : 'Distance along the wall, in cm'}
                aria-label={`Offset of the ${o.kind} on the ${o.wall} wall`}
                onBlur={(e) => moveOpening(o, e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
              />
            </label>
            <span className={`text-muted ${NUM}`}>· width {o.width}</span>
            <button
              className={`ml-auto shrink-0 rounded p-0.5 text-muted transition-colors hover:bg-bad/12 hover:text-bad ${FOCUS}`}
              aria-label={`Remove ${o.kind} on the ${o.wall} wall`}
              onClick={() => dispatch({ actor: 'human', ops: [{ type: 'removeOpening', id: o.id }] })}
            ><Icon name="trash" size={13} /></button>
          </li>
        ))}
        {room.openings.length === 0 && <li className="px-2 py-1.5 text-[11.5px] text-muted">No openings yet.</li>}
      </ul>
      {/* Four bare boxes in a row taught nobody which was which; every field says its own name. */}
      <div className="grid grid-cols-4 gap-1.5">
        <label className="block">
          <span className="mb-1 block text-[11px] text-muted">Kind</span>
          <select className={INPUT} aria-label="Opening kind" value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as 'door' | 'window' })}><option value="window">Window</option><option value="door">Door</option></select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] text-muted">Wall</span>
          <select className={`${INPUT} capitalize`} aria-label="Opening wall" value={draft.wall} onChange={(e) => setDraft({ ...draft, wall: e.target.value as Wall })}>{WALLS.map((w) => <option key={w} value={w}>{w[0]!.toUpperCase() + w.slice(1)}</option>)}</select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] text-muted">Offset (cm)</span>
          <input className={`${INPUT} ${NUM}`} type="number" value={draft.offset} onChange={(e) => setDraft({ ...draft, offset: num(e.target.value) })} aria-label="Opening offset in cm" title="How far along the wall the opening starts, in centimetres" />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] text-muted">Width (cm)</span>
          <input className={`${INPUT} ${NUM}`} type="number" value={draft.width} onChange={(e) => setDraft({ ...draft, width: num(e.target.value) })} aria-label="Opening width in cm" title="How wide the opening is, in centimetres" />
        </label>
      </div>
      {/* One primary per surface: Apply size and Add opening are what this sheet does, and
          Done only shuts it, so it reads as the quiet way out. */}
      <div className="mt-2.5 flex justify-between">
        <button className={BTN_PRIMARY} onClick={addOpening}><Icon name="plus" size={13} />Add opening</button>
        <button className={BTN_QUIET} onClick={onClose} title="Close this dialog (Esc). Changes are already applied.">Done</button>
      </div>
      {error && <p className="mt-2 text-[11.5px] text-bad" role="alert">{error}</p>}
    </Modal>
  );
}
