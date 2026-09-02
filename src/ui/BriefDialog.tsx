// src/ui/BriefDialog.tsx
import { useState } from 'react';
import Modal from './Modal';
import { useRoom } from '../store';

export default function BriefDialog({ onClose }: { onClose: () => void }) {
  const room = useRoom((s) => s.rooms[s.currentId]!);
  const dispatch = useRoom((s) => s.dispatch);
  const [budget, setBudget] = useState(String(room.brief.budget));
  const [needs, setNeeds] = useState(room.brief.needs.join(', '));
  const [notes, setNotes] = useState(room.brief.notes);
  const save = () => {
    dispatch({ actor: 'human', ops: [{ type: 'setBrief', brief: { budget: Math.max(0, Number(budget) || 0), currency: 'USD', needs: needs.split(',').map((n) => n.trim()).filter(Boolean), notes } }] });
    onClose();
  };
  return (
    <Modal title="Design brief" onClose={onClose}>
      <label className="mb-2 block text-sm">Budget (USD)<input className="mt-1 w-full rounded bg-neutral-800 p-2" type="number" value={budget} onChange={(e) => setBudget(e.target.value)} /></label>
      <label className="mb-2 block text-sm">Needs (comma separated)<input className="mt-1 w-full rounded bg-neutral-800 p-2" value={needs} onChange={(e) => setNeeds(e.target.value)} /></label>
      <label className="mb-3 block text-sm">Notes<textarea className="mt-1 w-full rounded bg-neutral-800 p-2" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
      <div className="flex justify-end gap-2"><button className="rounded px-3 py-1 text-neutral-300" onClick={onClose}>Cancel</button><button className="rounded bg-emerald-600 px-3 py-1 text-white" onClick={save}>Save</button></div>
    </Modal>
  );
}
