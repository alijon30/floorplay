// src/ui/RoomsMenu.tsx
import { useState } from 'react';
import { useRoom } from '../store';
import { Icon } from './icons';
import { BTN_PRIMARY, BTN_QUIET, CARD, FOCUS, NUM } from './styles';

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
      <button
        className={`inline-flex h-7 items-center gap-1 rounded-md px-2 text-[12px] text-muted transition-colors hover:bg-raised hover:text-fg ${FOCUS} ${open ? 'bg-raised text-fg' : ''}`}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >My rooms<Icon name="chevron" size={12} /></button>
      {open && (
        <div className={`absolute right-0 z-30 mt-1.5 w-72 p-1.5 ${CARD}`}>
          {Object.values(rooms).map((r) => (
            <div key={r.id} className={`flex items-center gap-1 rounded-md px-1.5 py-1 transition-colors ${r.id === currentId ? 'bg-raised' : 'hover:bg-raised'}`}>
              <button
                className={`flex min-w-0 flex-1 items-baseline gap-2 rounded text-left text-[12px] ${FOCUS}`}
                onClick={() => { switchRoom(r.id); setOpen(false); }}
              >
                <span className="min-w-0 truncate text-fg">{r.name}</span>
                <span className={`shrink-0 text-[10.5px] text-muted ${NUM}`}>{r.items.length} items</span>
              </button>
              <button
                className={`shrink-0 rounded p-0.5 text-muted transition-colors hover:bg-bad/12 hover:text-bad ${FOCUS}`}
                aria-label={`Delete ${r.name}`}
                title="Delete"
                onClick={() => deleteRoom(r.id)}
              ><Icon name="trash" size={13} /></button>
            </div>
          ))}
          <div className="mt-1.5 flex gap-1.5 border-t border-line pt-1.5">
            <button className={`flex-1 ${BTN_QUIET}`} onClick={() => { setWizardOpen(true); setOpen(false); }}><Icon name="plus" size={13} />New room</button>
            <button className={`flex-1 ${BTN_PRIMARY}`} onClick={() => { loadDemo(); setOpen(false); }}>Load demo studio</button>
          </div>
        </div>
      )}
    </div>
  );
}
