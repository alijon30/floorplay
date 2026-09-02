// src/ui/Ledger.tsx
import { useEffect, useRef } from 'react';
import { useRoom } from '../store';

export default function Ledger({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const room = useRoom((s) => s.rooms[s.currentId]!);
  const { undo, revertTo } = useRoom((s) => s);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (open) endRef.current?.scrollIntoView({ block: 'nearest' }); }, [room.ledger.length, open]);
  const last = room.ledger[room.ledger.length - 1];
  return (
    <div className="flex h-full flex-col text-xs">
      <div className="flex items-center gap-2 border-b border-neutral-800 px-3 py-1">
        <button
          className="flex items-center gap-2 rounded px-1 py-0.5 hover:bg-neutral-800"
          onClick={onToggle}
          aria-expanded={open}
          title={open ? 'Collapse the ledger' : 'Expand the ledger'}
        >
          <span className="text-neutral-500">{open ? '▾' : '▸'}</span>
          <strong>Ledger</strong>
          <span className="text-neutral-500">{room.ledger.length}</span>
        </button>
        <button disabled={!last} className="ml-auto rounded bg-neutral-800 px-2 py-0.5 hover:bg-neutral-700 disabled:opacity-40" onClick={() => undo()}>Undo last</button>
      </div>
      {open && (
        <div className="flex-1 overflow-auto px-2 py-1">
          {room.ledger.length === 0 && <p className="text-neutral-600">No actions yet.</p>}
          {room.ledger.map((e, idx) => (
            <div key={e.id} className="group flex items-center gap-2 rounded px-1 py-0.5 hover:bg-neutral-800">
              <span title={e.actor}>{e.actor === 'agent' ? '🤖' : '🧑'}</span>
              <span className="flex-1 truncate">{e.summary}{e.tool && <span className="text-neutral-500"> · {e.tool}</span>}</span>
              <span className={`rounded px-1 ${e.violationsAfter ? 'bg-red-900 text-red-200' : 'bg-neutral-800 text-neutral-400'}`}>{e.violationsAfter} issues</span>
              {idx < room.ledger.length - 1 && <button className="invisible rounded bg-neutral-700 px-1 group-hover:visible" onClick={() => revertTo(e.id)}>Revert to here</button>}
            </div>
          ))}
          <div ref={endRef} />
        </div>
      )}
    </div>
  );
}
