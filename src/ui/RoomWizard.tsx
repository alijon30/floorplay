// src/ui/RoomWizard.tsx
import { useState } from 'react';
import Modal from './Modal';
import { useRoom } from '../store';
import { PRESETS } from '../engine/rooms';

export default function RoomWizard({ onClose }: { onClose: () => void }) {
  const createRoom = useRoom((s) => s.createRoom);
  const [name, setName] = useState('My room');
  const [dims, setDims] = useState({ width: 360, depth: 520, height: 260 });
  const submit = () => { createRoom({ name, ...dims }); onClose(); };
  return (
    <Modal title="New room" onClose={onClose}>
      <label className="mb-2 block text-sm">Name<input className="mt-1 w-full rounded bg-neutral-800 p-2" value={name} onChange={(e) => setName(e.target.value)} /></label>
      <div className="mb-2 flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button key={p.key} className="rounded border border-neutral-700 px-2 py-1 text-xs hover:border-emerald-500" onClick={() => { setName(p.name); setDims({ width: p.width, depth: p.depth, height: p.height }); }}>
            {p.name} {p.width}×{p.depth}
          </button>
        ))}
      </div>
      <div className="mb-3 grid grid-cols-3 gap-2 text-sm">
        {(['width', 'depth', 'height'] as const).map((k) => (
          <label key={k} className="block capitalize">{k} (cm)<input className="mt-1 w-full rounded bg-neutral-800 p-2" type="number" value={dims[k]} onChange={(e) => setDims({ ...dims, [k]: Math.max(100, Number(e.target.value) || 100) })} /></label>
        ))}
      </div>
      <div className="flex justify-end gap-2"><button className="rounded px-3 py-1 text-neutral-300" onClick={onClose}>Cancel</button><button className="rounded bg-emerald-600 px-3 py-1 text-white" onClick={submit}>Create</button></div>
    </Modal>
  );
}
