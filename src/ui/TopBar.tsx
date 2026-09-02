// src/ui/TopBar.tsx
import { useRef, useState } from 'react';
import { useRoom } from '../store';
import { APP_NAME } from '../config';
import { WALLS } from '../engine/types';
import AgentChip from './AgentChip';
import BriefDialog from './BriefDialog';
import ShellDialog from './ShellDialog';
import RoomsMenu from './RoomsMenu';
import HelpPopover from './HelpPopover';

export default function TopBar() {
  const room = useRoom((s) => s.rooms[s.currentId]!);
  const ui = useRoom((s) => s.ui);
  const persistError = useRoom((s) => s.persistError);
  const { renameRoom, setDaylightHour, setNorthWall, setCatalogOpen, setProposeFirst, undo } = useRoom((s) => s);
  const [brief, setBrief] = useState(false);
  const [shell, setShell] = useState(false);
  const [help, setHelp] = useState(false);
  const helpAnchor = useRef<HTMLDivElement>(null);
  return (
    <header className="flex flex-wrap items-center gap-3 border-b border-neutral-800 px-4 py-2 text-sm">
      <span className="text-lg font-semibold tracking-tight">{APP_NAME}</span>
      <input className="w-40 rounded bg-transparent px-1 text-neutral-200 outline-none hover:bg-neutral-800 focus:bg-neutral-800" value={room.name} onChange={(e) => renameRoom(e.target.value)} aria-label="Room name" />
      <button className="rounded border border-neutral-700 px-2 py-1 text-xs hover:border-emerald-500" onClick={() => setShell(true)}>Room {room.width}×{room.depth}</button>
      <button className="rounded border border-neutral-700 px-2 py-1 text-xs hover:border-emerald-500" onClick={() => setBrief(true)}>Brief · ${room.brief.budget} · {room.brief.needs.length ? room.brief.needs.join(', ') : 'no needs yet'}</button>
      <label className="flex items-center gap-2 text-xs text-neutral-300">☀ {String(room.daylightHour).padStart(2, '0')}:00
        <input type="range" min={6} max={20} value={room.daylightHour} onChange={(e) => setDaylightHour(Number(e.target.value))} aria-label="Daylight hour" />
      </label>
      <label className="flex items-center gap-1 text-xs text-neutral-300">North
        <select className="rounded bg-neutral-800 p-1" value={room.northWall} onChange={(e) => setNorthWall(e.target.value as (typeof WALLS)[number])}>
          {WALLS.map((w) => <option key={w} value={w}>{w}</option>)}
        </select>
      </label>
      <button className={`rounded border px-2 py-1 text-xs ${ui.catalogOpen ? 'border-emerald-500 text-emerald-300' : 'border-neutral-700 hover:border-emerald-500'}`} onClick={() => setCatalogOpen(!ui.catalogOpen)}>Catalog</button>
      <label className="flex items-center gap-1 text-xs text-neutral-300" title="When on, every agent change becomes a proposal you accept on screen">
        <input type="checkbox" checked={ui.proposeFirst} onChange={(e) => setProposeFirst(e.target.checked)} /> Propose first
      </label>
      <div className="ml-auto flex items-center gap-3">
        <button
          className="rounded border border-neutral-700 px-2 py-1 text-xs hover:border-emerald-500 disabled:opacity-40 disabled:hover:border-neutral-700"
          disabled={room.ledger.length === 0}
          title="Undo the last change (Cmd/Ctrl+Z)"
          onClick={() => undo()}
        >Undo</button>
        <div className="relative" ref={helpAnchor}>
          <button
            className="rounded border border-neutral-700 px-2 py-1 text-xs hover:border-emerald-500"
            aria-label="Help"
            aria-expanded={help}
            onClick={() => setHelp((h) => !h)}
          >?</button>
          {help && <HelpPopover onClose={() => setHelp(false)} anchorRef={helpAnchor} />}
        </div>
        <RoomsMenu />
        <AgentChip />
        {persistError && <span className="rounded-full border border-amber-500 px-2 py-0.5 text-xs text-amber-300" title={persistError}>Not saved</span>}
      </div>
      {brief && <BriefDialog onClose={() => setBrief(false)} />}
      {shell && <ShellDialog onClose={() => setShell(false)} />}
    </header>
  );
}
