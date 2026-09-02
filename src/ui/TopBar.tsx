// src/ui/TopBar.tsx
import { useRef, useState } from 'react';
import { useRoom } from '../store';
import { APP_NAME } from '../config';
import { WALLS } from '../engine/types';
import AgentChip from './AgentChip';
import RoomsMenu from './RoomsMenu';
import HelpPopover from './HelpPopover';
import StylePopover from './StylePopover';
import { CatalogIcon, HelpIcon, PaletteIcon, RoomIcon, SunIcon, UndoIcon } from './icons';
import { BTN, BTN_ON, ICON_BTN, ICON_BTN_ON, INPUT } from './styles';

/** A hairline between two groups of controls. */
function Divider() {
  return <span aria-hidden="true" className="mx-0.5 h-5 w-px shrink-0 bg-neutral-800" />;
}

/**
 * One row, four groups: what this room is, what it looks like right now, what to put in it,
 * and everything that belongs to the session rather than the room.
 *
 * The row is `flex-nowrap` from 1280 px up, so it never breaks into the second line that used
 * to push the plan down the page. Only the room-name input can shrink, which is what keeps
 * that promise when a long room name or the "Not saved" chip turns up.
 */
export default function TopBar() {
  const room = useRoom((s) => s.rooms[s.currentId]!);
  const ui = useRoom((s) => s.ui);
  const persistError = useRoom((s) => s.persistError);
  const { renameRoom, setDaylightHour, setNorthWall, setCatalogOpen, setProposeFirst, setShowDaylight, setRoomPanelOpen, openDialog, closeDialog, undo } = useRoom((s) => s);
  // The shell dialog lives in `App`, keyed off `ui.dialog`, so the room panel on the right
  // rail opens the very same one. Only the style popover renders here, because it hangs off
  // its own button.
  const [help, setHelp] = useState(false);
  const style = ui.dialog === 'style';
  const helpAnchor = useRef<HTMLDivElement>(null);
  const styleAnchor = useRef<HTMLDivElement>(null);
  const hour = `${String(room.daylightHour).padStart(2, '0')}:00`;

  return (
    <header className="flex h-12 shrink-0 flex-wrap items-center gap-2 border-b border-neutral-800 px-3 text-sm max-[1279px]:h-auto max-[1279px]:py-1.5 min-[1280px]:flex-nowrap">
      {/* Which room this is */}
      <span className="shrink-0 text-base font-semibold tracking-tight">{APP_NAME}</span>
      <input
        className="h-8 w-32 min-w-8 rounded-md border border-transparent bg-transparent px-2 text-sm text-neutral-200 outline-none transition-colors hover:border-neutral-700 hover:bg-neutral-800 focus:border-neutral-700 focus:bg-neutral-800 focus-visible:ring-2 focus-visible:ring-emerald-500"
        value={room.name}
        onChange={(e) => renameRoom(e.target.value)}
        aria-label="Room name"
      />

      <Divider />

      {/* How the room stands: its size, and the light falling into it */}
      <button
        className={BTN}
        title="Show the room card: size, budget and needs"
        onClick={() => setRoomPanelOpen(true)}
      ><RoomIcon />Room {room.width}×{room.depth}</button>

      <div className="flex shrink-0 items-center gap-1.5">
        <SunIcon className="shrink-0 text-amber-300" />
        <span className="w-9 shrink-0 text-xs tabular-nums text-neutral-300">{hour}</span>
        <input
          type="range"
          className="w-28 shrink-0 accent-emerald-500"
          min={6}
          max={20}
          value={room.daylightHour}
          onChange={(e) => setDaylightHour(Number(e.target.value))}
          aria-label="Daylight hour"
        />
        <button
          className={ui.showDaylight ? ICON_BTN_ON : ICON_BTN}
          title={ui.showDaylight ? 'Hide the daylight overlay on the plan' : 'Show daylight overlay on the plan'}
          aria-label="Show daylight overlay on the plan"
          aria-pressed={ui.showDaylight}
          onClick={() => setShowDaylight(!ui.showDaylight)}
        ><SunIcon /></button>
      </div>

      <label className="flex shrink-0 items-center gap-1.5 text-xs text-neutral-400">North
        <select
          className={`${INPUT} w-[4.5rem]`}
          value={room.northWall}
          onChange={(e) => setNorthWall(e.target.value as (typeof WALLS)[number])}
        >
          {WALLS.map((w) => <option key={w} value={w}>{w}</option>)}
        </select>
      </label>

      <Divider />

      {/* What goes into it, and who decides */}
      <button
        className={ui.catalogOpen ? BTN_ON : BTN}
        aria-pressed={ui.catalogOpen}
        onClick={() => setCatalogOpen(!ui.catalogOpen)}
      ><CatalogIcon />Catalog</button>

      <button
        role="switch"
        aria-checked={ui.proposeFirst}
        title="When on, every agent change becomes a proposal you accept on screen"
        onClick={() => setProposeFirst(!ui.proposeFirst)}
        className="flex h-8 shrink-0 items-center gap-2 rounded-md px-1 text-xs text-neutral-300 transition-colors hover:text-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
      >
        <span className={`relative h-4 w-7 shrink-0 rounded-full transition-colors ${ui.proposeFirst ? 'bg-emerald-600' : 'bg-neutral-700'}`}>
          <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${ui.proposeFirst ? 'left-3.5' : 'left-0.5'}`} />
        </span>
        Propose first
      </button>

      {/* The session: what it can undo, how it looks, who is watching */}
      <div className="ml-auto flex shrink-0 items-center gap-2">
        <button
          className={ICON_BTN}
          disabled={room.ledger.length === 0}
          aria-label="Undo"
          title="Undo the last change (Cmd/Ctrl+Z)"
          onClick={() => undo()}
        ><UndoIcon /></button>

        <div className="relative" ref={styleAnchor}>
          <button
            className={style ? ICON_BTN_ON : ICON_BTN}
            aria-label="Style"
            title="Wall paint, floor and whole-room schemes"
            aria-expanded={style}
            onClick={() => (style ? closeDialog() : openDialog('style'))}
          ><PaletteIcon /></button>
          {style && <StylePopover onClose={closeDialog} anchorRef={styleAnchor} />}
        </div>

        <div className="relative" ref={helpAnchor}>
          <button
            className={help ? ICON_BTN_ON : ICON_BTN}
            aria-label="Help"
            title="Keyboard, mouse and how to connect an agent"
            aria-expanded={help}
            onClick={() => setHelp((h) => !h)}
          ><HelpIcon /></button>
          {help && <HelpPopover onClose={() => setHelp(false)} anchorRef={helpAnchor} />}
        </div>

        <RoomsMenu />
        <AgentChip />
        {persistError && (
          <span className="shrink-0 rounded-full border border-amber-500 px-2 py-0.5 text-xs text-amber-300" title={persistError}>Not saved</span>
        )}
      </div>
    </header>
  );
}
