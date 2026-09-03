// src/ui/HomesMenu.tsx
import { useCallback, useRef, useState } from 'react';
import { useRoom } from '../store';
import type { Room } from '../engine/types';
import { homeContaining } from '../engine/home';
import { HOME_TEMPLATES, type HomeTemplateKey } from '../engine/homeTemplates';
import { useDismiss } from './useDismiss';
import { Icon } from './icons';
import { BTN_PRIMARY, BTN_QUIET, BTN_SM, CARD, FOCUS, NUM } from './styles';

const ROOM_ROW = `flex min-w-0 flex-1 items-baseline gap-2 rounded text-left text-[12px] ${FOCUS}`;

/** One room in the list: on its own, or indented under the home it stands in. */
function RoomRow({ room, nested, current, confirming, onOpen, onAskDelete, onDelete, onCancel }: {
  room: Room; nested: boolean; current: boolean; confirming: boolean;
  onOpen: () => void; onAskDelete: () => void; onDelete: () => void; onCancel: () => void;
}) {
  return (
    <div className={`flex items-center gap-1 rounded-md py-1 pr-1.5 transition-colors ${nested ? 'pl-4' : 'pl-1.5'} ${current ? 'bg-raised' : 'hover:bg-raised'}`}>
      {confirming ? (
        <>
          <span className="min-w-0 flex-1 truncate text-[11.5px] text-bad">Delete “{room.name}”?</span>
          <button
            className={`inline-flex h-6 shrink-0 items-center justify-center rounded border border-bad/40 bg-bad/12 px-1.5 text-[11px] text-bad transition-colors hover:bg-bad/20 ${FOCUS}`}
            onClick={onDelete}
          >Yes, delete</button>
          <button className={`shrink-0 ${BTN_SM}`} onClick={onCancel}>No</button>
        </>
      ) : (
        <>
          <button className={ROOM_ROW} onClick={onOpen}>
            <span className="min-w-0 truncate text-fg">{room.name}</span>
            <span className={`shrink-0 text-[10.5px] text-muted ${NUM}`}>{room.items.length} items</span>
          </button>
          <button
            className={`shrink-0 rounded p-0.5 text-muted transition-colors hover:bg-bad/12 hover:text-bad ${FOCUS}`}
            aria-label={`Delete ${room.name}`}
            title="Delete this room. It cannot be undone."
            onClick={onAskDelete}
          ><Icon name="trash" size={13} /></button>
        </>
      )}
    </div>
  );
}

/**
 * Everything you have made, arranged the way it stands: homes with their rooms under them,
 * then the rooms that belong to no plan.
 *
 * This is the only list in the app that shows the whole document, so it is the one place a
 * home can be deleted from — behind the same two-press confirm a room takes, because neither
 * is something undo can reach.
 */
export default function HomesMenu() {
  const rooms = useRoom((s) => s.rooms);
  const homes = useRoom((s) => s.homes);
  const currentId = useRoom((s) => s.currentId);
  const switchRoom = useRoom((s) => s.switchRoom);
  const deleteRoom = useRoom((s) => s.deleteRoom);
  const deleteHome = useRoom((s) => s.deleteHome);
  const createHomeFromTemplate = useRoom((s) => s.createHomeFromTemplate);
  const createHome = useRoom((s) => s.createHome);
  const setPlanView = useRoom((s) => s.setPlanView);
  const setWizardOpen = useRoom((s) => s.setWizardOpen);
  const loadDemo = useRoom((s) => s.loadDemo);

  const [open, setOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  /** The room or home whose trash has been pressed once. Deleting is what undo cannot take back. */
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const anchor = useRef<HTMLDivElement>(null);
  const close = useCallback(() => { setOpen(false); setNewOpen(false); setConfirmId(null); }, []);
  useDismiss(open, anchor, close);

  const standalone = Object.values(rooms).filter((r) => !homeContaining(homes, r.id));
  const list = Object.values(homes);

  const go = (id: string, home: boolean) => { switchRoom(id); if (home) setPlanView('home'); close(); };
  const newHome = (key: HomeTemplateKey | null) => {
    if (key) createHomeFromTemplate(key);
    else { createHome({ name: 'My home' }); setPlanView('home'); }
    close();
  };

  return (
    <div className="relative" ref={anchor}>
      <button
        className={`inline-flex h-7 items-center gap-1 rounded-md px-2 text-[12px] text-muted transition-colors hover:bg-raised hover:text-fg ${FOCUS} ${open ? 'bg-raised text-fg' : ''}`}
        aria-expanded={open}
        onClick={() => { setOpen((o) => !o); setNewOpen(false); setConfirmId(null); }}
      >My homes<Icon name="chevron" size={12} /></button>

      {open && (
        <div className={`absolute right-0 z-30 mt-1.5 max-h-[70vh] w-80 overflow-y-auto p-1.5 ${CARD}`}>
          {list.map((h) => (
            <div key={h.id} className="mb-1">
              <div className="flex items-center gap-1 rounded-md px-1.5 py-1 transition-colors hover:bg-raised">
                {confirmId === h.id ? (
                  <>
                    <span className="min-w-0 flex-1 truncate text-[11.5px] text-bad">Delete “{h.name}”? Its rooms stay.</span>
                    <button
                      className={`inline-flex h-6 shrink-0 items-center justify-center rounded border border-bad/40 bg-bad/12 px-1.5 text-[11px] text-bad transition-colors hover:bg-bad/20 ${FOCUS}`}
                      onClick={() => { deleteHome(h.id); setConfirmId(null); }}
                    >Yes, delete</button>
                    <button className={`shrink-0 ${BTN_SM}`} onClick={() => setConfirmId(null)}>No</button>
                  </>
                ) : (
                  <>
                    <Icon name="home" size={13} className="shrink-0 text-muted" />
                    <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-fg">{h.name}</span>
                    <span className={`shrink-0 text-[10.5px] text-muted ${NUM}`}>{h.rooms.length} rooms · {h.doorways.length} doorways</span>
                    <button
                      className={`shrink-0 rounded p-0.5 text-muted transition-colors hover:bg-bad/12 hover:text-bad ${FOCUS}`}
                      aria-label={`Delete ${h.name}`}
                      title="Delete this floor plan. The rooms on it survive on their own."
                      onClick={() => setConfirmId(h.id)}
                    ><Icon name="trash" size={13} /></button>
                  </>
                )}
              </div>
              {h.rooms.map((p) => {
                const r = rooms[p.roomId];
                return r ? (
                  <RoomRow
                    key={p.roomId} room={r} nested current={p.roomId === currentId} confirming={confirmId === p.roomId}
                    onOpen={() => go(p.roomId, true)} onAskDelete={() => setConfirmId(p.roomId)}
                    onDelete={() => { deleteRoom(p.roomId); setConfirmId(null); }} onCancel={() => setConfirmId(null)}
                  />
                ) : null;
              })}
            </div>
          ))}

          {standalone.length > 0 && (
            <>
              <div className={`px-1.5 pb-1 pt-1.5 text-[10.5px] font-medium uppercase tracking-[0.08em] text-muted ${list.length ? 'border-t border-line' : ''}`}>Standalone rooms</div>
              {standalone.map((r) => (
                <RoomRow
                  key={r.id} room={r} nested={false} current={r.id === currentId} confirming={confirmId === r.id}
                  onOpen={() => go(r.id, false)} onAskDelete={() => setConfirmId(r.id)}
                  onDelete={() => { deleteRoom(r.id); setConfirmId(null); }} onCancel={() => setConfirmId(null)}
                />
              ))}
            </>
          )}

          <div className="mt-1.5 border-t border-line pt-1.5">
            {newOpen ? (
              <div className="space-y-0.5">
                <button className={`flex w-full items-baseline gap-2 rounded-md px-2 py-1 text-left text-[12px] text-fg transition-colors hover:bg-raised ${FOCUS}`} onClick={() => newHome(null)}>
                  Empty plan
                  <span className="text-[10.5px] text-muted">start from nothing</span>
                </button>
                {HOME_TEMPLATES.map((t) => (
                  <button
                    key={t.key}
                    title={t.blurb}
                    className={`flex w-full items-baseline gap-2 rounded-md px-2 py-1 text-left text-[12px] text-fg transition-colors hover:bg-raised ${FOCUS}`}
                    onClick={() => newHome(t.key)}
                  >
                    <span className="min-w-0 flex-1 truncate">{t.name}</span>
                    <span className={`shrink-0 text-[10.5px] text-muted ${NUM}`}>{t.rooms.length} rooms</span>
                  </button>
                ))}
                <button className={`w-full ${BTN_SM}`} onClick={() => setNewOpen(false)}>Back</button>
              </div>
            ) : (
              <div className="flex gap-1.5">
                <button className={`flex-1 ${BTN_QUIET}`} onClick={() => setNewOpen(true)}><Icon name="home" size={13} />New home</button>
                <button className={`flex-1 ${BTN_QUIET}`} onClick={() => { setWizardOpen(true); close(); }}><Icon name="plus" size={13} />New room</button>
              </div>
            )}
            {!newOpen && (
              <button className={`mt-1.5 w-full ${BTN_PRIMARY}`} onClick={() => { loadDemo(); close(); }}>Load demo studio</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
