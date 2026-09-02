// src/ui/ShellDialog.tsx
import { useState } from 'react';
import Modal from './Modal';
import { useRoom } from '../store';
import { WALLS, type Wall } from '../engine/types';
import { newId } from '../engine/ids';

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
  return (
    <Modal title="Room shell" onClose={onClose}>
      <div className="mb-2 grid grid-cols-3 gap-2 text-sm">
        {(['width', 'depth', 'height'] as const).map((k) => (
          <label key={k} className="block"><span className="capitalize">{k}</span> (cm)<input className="mt-1 w-full rounded bg-neutral-800 p-2" type="number" value={dims[k]} onChange={(e) => setDims({ ...dims, [k]: num(e.target.value) })} /></label>
        ))}
      </div>
      <button className="mb-4 rounded bg-emerald-700 px-3 py-1 text-sm hover:bg-emerald-600" onClick={saveDims}>Apply dimensions</button>
      <h3 className="mb-1 text-sm font-semibold">Doors and windows</h3>
      <ul className="mb-2 text-xs">
        {room.openings.map((o) => (
          <li key={o.id} className="flex items-center justify-between py-0.5">
            <span>{o.kind} · {o.wall} wall · offset {o.offset} · width {o.width}</span>
            <button className="text-neutral-400 hover:text-red-400" onClick={() => dispatch({ actor: 'human', ops: [{ type: 'removeOpening', id: o.id }] })}>remove</button>
          </li>
        ))}
        {room.openings.length === 0 && <li className="text-neutral-500">No openings yet.</li>}
      </ul>
      <div className="grid grid-cols-4 gap-2 text-xs">
        <select className="rounded bg-neutral-800 p-1" value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as 'door' | 'window' })}><option value="window">window</option><option value="door">door</option></select>
        <select className="rounded bg-neutral-800 p-1" value={draft.wall} onChange={(e) => setDraft({ ...draft, wall: e.target.value as Wall })}>{WALLS.map((w) => <option key={w} value={w}>{w}</option>)}</select>
        <input className="rounded bg-neutral-800 p-1" type="number" value={draft.offset} onChange={(e) => setDraft({ ...draft, offset: num(e.target.value) })} title="offset (cm)" />
        <input className="rounded bg-neutral-800 p-1" type="number" value={draft.width} onChange={(e) => setDraft({ ...draft, width: num(e.target.value) })} title="width (cm)" />
      </div>
      <div className="mt-2 flex justify-between">
        <button className="rounded bg-neutral-800 px-3 py-1 text-sm hover:bg-neutral-700" onClick={addOpening}>Add opening</button>
        <button className="rounded px-3 py-1 text-sm text-neutral-300" onClick={onClose}>Done</button>
      </div>
      {error && <p className="mt-2 text-xs text-red-400" role="alert">{error}</p>}
    </Modal>
  );
}
