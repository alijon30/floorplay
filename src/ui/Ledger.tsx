// src/ui/Ledger.tsx
import { useEffect, useRef } from 'react';
import { useRoom } from '../store';
import { Icon } from './icons';
import { BTN_SM, FOCUS, NUM } from './styles';

/**
 * Every change to the room, whoever made it, with a way back to any point in the run.
 *
 * Collapsed it is one line: the last thing that happened and how many entries stand behind
 * it, which is all the drawing usually needs to give up. Expanded it is the whole run.
 */
export default function Ledger() {
  const room = useRoom((s) => s.rooms[s.currentId]!);
  const open = useRoom((s) => s.ui.ledgerOpen);
  const setLedgerOpen = useRoom((s) => s.setLedgerOpen);
  const { undo, revertTo } = useRoom((s) => s);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (open) endRef.current?.scrollIntoView({ block: 'nearest' }); }, [room.ledger.length, open]);
  const last = room.ledger[room.ledger.length - 1];

  return (
    <div className={`flex shrink-0 flex-col border-t border-line bg-panel ${open ? 'h-[180px]' : 'h-8'}`}>
      <div className="flex h-8 shrink-0 items-center gap-2 px-2">
        <button
          className={`flex h-6 items-center gap-1.5 rounded px-1.5 text-[11.5px] text-muted transition-colors hover:bg-raised hover:text-fg ${FOCUS}`}
          onClick={() => setLedgerOpen(!open)}
          aria-expanded={open}
          title={open ? 'Collapse the ledger' : 'Expand the ledger'}
        >
          <Icon name={open ? 'chevron' : 'chevronRight'} size={12} />
          <span className="text-[10.5px] font-medium uppercase tracking-[0.08em]">Ledger</span>
          <span className={`text-[11px] text-muted/70 ${NUM}`}>{room.ledger.length}</span>
        </button>
        {!open && (
          <span className="min-w-0 flex-1 truncate text-[11.5px] text-muted">
            {last ? (
              <>
                <Icon name={last.actor === 'agent' ? 'bot' : 'user'} size={12} className="mr-1.5 inline-block align-[-2px] text-muted" />
                {last.summary}
              </>
            ) : 'No actions yet.'}
          </span>
        )}
        <button disabled={!last} className={`ml-auto ${BTN_SM}`} onClick={() => undo()}>Undo last</button>
      </div>
      {open && (
        <div className="min-h-0 flex-1 overflow-auto px-1.5 pb-1.5">
          {room.ledger.length === 0 && <p className="px-1.5 text-[11.5px] text-muted">No actions yet.</p>}
          {room.ledger.map((e, idx) => (
            <div key={e.id} className="group flex items-center gap-2 rounded px-1.5 py-1 transition-colors hover:bg-raised focus-within:bg-raised">
              <Icon name={e.actor === 'agent' ? 'bot' : 'user'} size={13} className={e.actor === 'agent' ? 'text-accent' : 'text-muted'} />
              <span className="min-w-0 flex-1 truncate text-[11.5px] text-fg/90">
                {e.summary}
                {e.tool && <span className={`ml-1.5 text-[10.5px] text-muted ${NUM}`}>{e.tool}</span>}
              </span>
              {idx < room.ledger.length - 1 && (
                // Hidden until the row is hovered, but a keyboard user tabs onto it too, and
                // focus has to be able to show what it has landed on.
                <button
                  className={`shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 ${BTN_SM}`}
                  title="Undo everything after this entry"
                  onClick={() => revertTo(e.id)}
                >Revert to here</button>
              )}
              <span className={`shrink-0 rounded px-1 text-[10.5px] ${NUM} ${e.violationsAfter ? 'bg-bad/15 text-bad' : 'text-muted/70'}`}>{e.violationsAfter} issues</span>
            </div>
          ))}
          <div ref={endRef} />
        </div>
      )}
    </div>
  );
}
