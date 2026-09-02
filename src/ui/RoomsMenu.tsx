// src/ui/RoomsMenu.tsx
import { useState } from 'react';
import { useRoom } from '../store';
import { BTN, BTN_PRIMARY, BTN_QUIET, CARD } from './styles';

export default function RoomsMenu() {
  const rooms = useRoom((s) => s.rooms);
  const currentId = useRoom((s) => s.currentId);
  const switchRoom = useRoom((s) => s.switchRoom);
  const deleteRoom = useRoom((s) => s.deleteRoom);
  const loadDemo = useRoom((s) => s.loadDemo);
  const setWizardOpen = useRoom((s) => s.setWizardOpen);
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button className={BTN} aria-expanded={open} onClick={() => setOpen((o) => !o)}>My rooms ▾</button>
      {open && (
        <div className={`absolute right-0 z-30 mt-1 w-64 p-2 text-sm shadow-2xl ${CARD}`}>
          {Object.values(rooms).map((r) => (
            <div key={r.id} className={`flex items-center justify-between rounded px-2 py-1 ${r.id === currentId ? 'bg-neutral-800' : 'hover:bg-neutral-800'}`}>
              <button className="min-w-0 flex-1 truncate rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500" onClick={() => { switchRoom(r.id); setOpen(false); }}>{r.name} <span className="text-neutral-500">{r.items.length} items</span></button>
              <button className="rounded px-1 text-neutral-500 transition-colors hover:text-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500" aria-label={`Delete ${r.name}`} title="Delete" onClick={() => deleteRoom(r.id)}>✕</button>
            </div>
          ))}
          <div className="mt-2 flex gap-2 border-t border-neutral-800 pt-2">
            <button className={`flex-1 ${BTN_QUIET}`} onClick={() => { setWizardOpen(true); setOpen(false); }}>New room</button>
            <button className={`flex-1 ${BTN_PRIMARY}`} onClick={() => { loadDemo(); setOpen(false); }}>Load demo studio</button>
          </div>
        </div>
      )}
    </div>
  );
}
