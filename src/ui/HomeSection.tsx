// src/ui/HomeSection.tsx
import { useCallback, useRef, useState } from 'react';
import { useRoom } from '../store';
import { homeContaining, homeReachability } from '../engine/home';
import { TEMPLATES } from '../engine/templates';
import { useAddRoom, useJoinHome } from './homeActions';
import { useDismiss } from './useDismiss';
import { Icon } from './icons';
import { BTN, BTN_ON, BTN_SM, CARD, FOCUS, INPUT, LABEL, NUM } from './styles';

const MENU_ITEM = `flex w-full items-baseline gap-2 rounded-md px-2 py-1 text-left text-[12px] text-fg transition-colors hover:bg-raised ${FOCUS}`;
const MENU_LABEL = `px-2 pb-1 pt-1.5 ${LABEL}`;

/**
 * What the room in front of you is part of, at the head of the Room tab.
 *
 * A room on no plan gets one button rather than an empty section, because "this room is not in
 * a home" is a fact nobody needs a heading for. Everything here is about the home; the size,
 * budget and brief below it stay about the room.
 */
export default function HomeSection() {
  const rooms = useRoom((s) => s.rooms);
  const homes = useRoom((s) => s.homes);
  const currentId = useRoom((s) => s.currentId);
  const doorwayMode = useRoom((s) => s.ui.doorwayMode);
  const renameHome = useRoom((s) => s.renameHome);
  const switchRoom = useRoom((s) => s.switchRoom);
  const removeDoorway = useRoom((s) => s.removeDoorway);
  const removeRoomFromHome = useRoom((s) => s.removeRoomFromHome);
  const setEntrance = useRoom((s) => s.setEntrance);
  const setPlanView = useRoom((s) => s.setPlanView);
  const setDoorwayMode = useRoom((s) => s.setDoorwayMode);

  const home = homeContaining(homes, currentId);
  const { standalone, addExisting, addTemplate } = useAddRoom(home);
  const { homes: allHomes, join, start } = useJoinHome();

  const [open, setOpen] = useState<'add' | 'join' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const anchor = useRef<HTMLDivElement>(null);
  const close = useCallback(() => { setOpen(null); setError(null); }, []);
  useDismiss(open !== null, anchor, close);

  const run = (r: { ok: true } | { ok: false; error: string }) => (r.ok ? close() : setError(r.error));

  if (!home) {
    return (
      <section ref={anchor} className="relative">
        <div className={`mb-1.5 ${LABEL}`}>Home</div>
        <button className={`w-full ${BTN}`} aria-expanded={open === 'join'} onClick={() => setOpen((o) => (o ? null : 'join'))}>
          <Icon name="home" size={13} />Add to a home…
        </button>
        {open === 'join' && (
          <div className={`absolute left-0 right-0 top-full z-30 mt-1 p-1.5 ${CARD}`}>
            {allHomes.map((h) => (
              <button key={h.id} className={MENU_ITEM} onClick={() => run(join(h.id))}>
                <span className="min-w-0 flex-1 truncate">{h.name}</span>
                <span className={`shrink-0 text-[10.5px] text-muted ${NUM}`}>{h.rooms.length} rooms</span>
              </button>
            ))}
            {allHomes.length > 0 && <div className="my-1 h-px bg-line" />}
            <button className={MENU_ITEM} onClick={() => run(start())}><Icon name="plus" size={12} />New home</button>
            {error && <p className="px-2 pb-1 pt-1.5 text-[11px] leading-snug text-bad" role="alert">{error}</p>}
          </div>
        )}
        <p className="mt-1.5 text-[11px] leading-snug text-muted">A home lays rooms out edge to edge on one plan and cuts doorways between them.</p>
      </section>
    );
  }

  const { entranceRoomId, unreachable } = homeReachability(home, rooms);
  const isEntrance = entranceRoomId === currentId;
  const name = (id: string) => rooms[id]?.name ?? 'a room that is gone';

  const showHome = () => setPlanView('home');

  return (
    <section ref={anchor} className="relative">
      <div className={`mb-1.5 ${LABEL}`}>Home</div>
      <input
        className={INPUT}
        aria-label="Home name"
        value={home.name}
        onChange={(e) => renameHome(e.target.value)}
      />

      <div className="mt-2 space-y-0.5">
        {home.rooms.map((p) => {
          const on = p.roomId === currentId;
          return (
            <button
              key={p.roomId}
              className={`flex w-full items-baseline gap-2 rounded-md px-1.5 py-1 text-left text-[12px] transition-colors ${FOCUS} ${on ? 'bg-raised text-fg' : 'text-muted hover:bg-raised hover:text-fg'}`}
              onClick={() => { switchRoom(p.roomId); showHome(); }}
            >
              <span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 rounded-full ${on ? 'bg-accent' : 'bg-transparent'}`} />
              <span className="min-w-0 flex-1 truncate">{name(p.roomId)}</span>
              {entranceRoomId === p.roomId && <span className="shrink-0 text-[10px] uppercase tracking-[0.06em] text-muted">entrance</span>}
              {unreachable.includes(p.roomId) && <span className="shrink-0 text-[10px] uppercase tracking-[0.06em] text-warn">no way in</span>}
              <span className={`shrink-0 text-[10.5px] text-muted ${NUM}`}>{rooms[p.roomId]?.items.length ?? 0}</span>
            </button>
          );
        })}
      </div>

      <div className={`mt-2.5 mb-1 ${LABEL}`}>Doorways</div>
      {home.doorways.length === 0 ? (
        <p className="text-[11px] leading-snug text-muted">None yet. Cut doorway opens the plan of the whole home, where a click on a shared wall makes one.</p>
      ) : (
        <div className="space-y-0.5">
          {home.doorways.map((d) => (
            <div key={d.id} className="flex items-center gap-1 rounded-md px-1.5 py-0.5 transition-colors hover:bg-raised">
              <span className="min-w-0 flex-1 truncate text-[11.5px] text-muted">
                {name(d.a.roomId)} <span className="text-fg">→</span> {name(d.b.roomId)}, <span className={NUM}>{d.width} cm</span>
              </span>
              <button
                className={`shrink-0 rounded p-0.5 text-muted transition-colors hover:bg-bad/12 hover:text-bad ${FOCUS}`}
                aria-label={`Remove the doorway between ${name(d.a.roomId)} and ${name(d.b.roomId)}`}
                title="Take this doorway out of both rooms"
                onClick={() => removeDoorway(d.id)}
              ><Icon name="close" size={12} /></button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-2.5 grid grid-cols-2 gap-1.5">
        <button className={BTN} aria-expanded={open === 'add'} onClick={() => setOpen((o) => (o ? null : 'add'))}><Icon name="plus" size={13} />Add room…</button>
        <button
          className={doorwayMode ? BTN_ON : BTN}
          aria-pressed={doorwayMode}
          title="Click a wall two rooms share on the home plan to cut a door through it"
          onClick={() => { setDoorwayMode(!doorwayMode); showHome(); }}
        ><Icon name="doorway" size={13} />Cut doorway</button>
        <button
          className={BTN}
          disabled={isEntrance}
          title={isEntrance ? 'The front door is already in this room' : 'Say the front door is in this room, so reachability starts here'}
          onClick={() => setEntrance(currentId)}
        >Set as entrance</button>
        <button
          className={BTN}
          title="Take this room off the plan. It survives on its own, without its doorways."
          onClick={() => removeRoomFromHome(currentId)}
        >Remove from home</button>
      </div>

      {open === 'add' && (
        <div className={`absolute left-0 right-0 top-full z-30 mt-1 max-h-[340px] overflow-y-auto p-1.5 ${CARD}`}>
          {standalone.length > 0 && (
            <>
              <div className={MENU_LABEL}>Rooms you already have</div>
              {standalone.map((r) => (
                <button key={r.id} className={MENU_ITEM} onClick={() => run(addExisting(r.id))}>
                  <span className="min-w-0 flex-1 truncate">{r.name}</span>
                  <span className={`shrink-0 text-[10.5px] text-muted ${NUM}`}>{r.width}×{r.depth}</span>
                </button>
              ))}
            </>
          )}
          <div className={MENU_LABEL}>Ready-made rooms</div>
          {TEMPLATES.map((t) => (
            <button key={t.key} className={MENU_ITEM} title={t.blurb} onClick={() => run(addTemplate(t.key))}>
              <span className="min-w-0 flex-1 truncate">{t.name}</span>
              <span className={`shrink-0 text-[10.5px] text-muted ${NUM}`}>{t.width}×{t.depth}</span>
            </button>
          ))}
          {error && <p className="px-2 pb-1 pt-1.5 text-[11px] leading-snug text-bad" role="alert">{error}</p>}
        </div>
      )}

      <div className="mt-1.5 flex items-center gap-1.5">
        <button className={BTN_SM} onClick={showHome}>Show the whole home</button>
        {unreachable.length > 0 && (
          <span className="text-[11px] text-warn">{unreachable.length} room{unreachable.length === 1 ? '' : 's'} with no way in</span>
        )}
      </div>
    </section>
  );
}
