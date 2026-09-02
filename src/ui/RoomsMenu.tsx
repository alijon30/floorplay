// src/ui/RoomsMenu.tsx
import { useState } from 'react';
import { useRoom } from '../store';
import RoomWizard from './RoomWizard';

export default function RoomsMenu() {
  const rooms = useRoom((s) => s.rooms);
  const currentId = useRoom((s) => s.currentId);
  const switchRoom = useRoom((s) => s.switchRoom);
  const deleteRoom = useRoom((s) => s.deleteRoom);
  const loadDemo = useRoom((s) => s.loadDemo);
  const [open, setOpen] = useState(false);
  const [wizard, setWizard] = useState(false);
  return (
    <div className="relative">
      <button className="rounded border border-neutral-700 px-2 py-1 text-xs hover:border-emerald-500" onClick={() => setOpen((o) => !o)}>My rooms ▾</button>
      {open && (
        <div className="absolute right-0 z-30 mt-1 w-64 rounded border border-neutral-700 bg-neutral-900 p-2 text-sm shadow-xl">
          {Object.values(rooms).map((r) => (
            <div key={r.id} className={`flex items-center justify-between rounded px-2 py-1 ${r.id === currentId ? 'bg-neutral-800' : 'hover:bg-neutral-800'}`}>
              <button className="flex-1 text-left" onClick={() => { switchRoom(r.id); setOpen(false); }}>{r.name} <span className="text-neutral-500">{r.items.length} items</span></button>
              <button className="text-neutral-500 hover:text-red-400" title="Delete" onClick={() => deleteRoom(r.id)}>✕</button>
            </div>
          ))}
          <div className="mt-2 flex gap-2 border-t border-neutral-800 pt-2">
            <button className="flex-1 rounded bg-neutral-800 px-2 py-1 hover:bg-neutral-700" onClick={() => { setWizard(true); setOpen(false); }}>New room</button>
            <button className="flex-1 rounded bg-emerald-700 px-2 py-1 hover:bg-emerald-600" onClick={() => { loadDemo(); setOpen(false); }}>Load demo studio</button>
          </div>
        </div>
      )}
      {wizard && <RoomWizard onClose={() => setWizard(false)} />}
    </div>
  );
}
