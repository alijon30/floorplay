// src/ui/ToolRail.tsx
import { useRef, useState } from 'react';
import { useRoom } from '../store';
import HelpPopover from './HelpPopover';
import StylePopover from './StylePopover';
import { Icon, type IconName } from './icons';
import { FOCUS } from './styles';

/** One rail button: the mark, an accent bar when its panel is open, and a tooltip beside it. */
function RailButton({
  icon, label, hint, on, onClick,
}: { icon: IconName; label: string; hint: string; on?: boolean; onClick: () => void }) {
  return (
    <div className="group/rail relative flex justify-center">
      <button
        type="button"
        aria-label={label}
        aria-pressed={on === undefined ? undefined : on}
        onClick={onClick}
        className={`relative inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors ${FOCUS} ${
          on ? 'bg-accent/12 text-accent' : 'text-muted hover:bg-raised hover:text-fg'
        }`}
      >
        {on && <span aria-hidden="true" className="absolute -left-[7px] h-4 w-[2px] rounded-full bg-accent" />}
        <Icon name={icon} />
      </button>
      {/* Drawn rather than a native title, so it lands where the eye already is. Once the
          panel it names is open, the button says so itself and the tooltip stands down. */}
      <span
        role="tooltip"
        className={`pointer-events-none absolute left-[calc(100%+6px)] top-1/2 z-40 hidden -translate-y-1/2 whitespace-nowrap rounded-md border border-line bg-raised px-2 py-1 text-[11.5px] text-fg shadow-xl ${on ? '' : 'group-hover/rail:block'}`}
      >{hint}</span>
    </div>
  );
}

/**
 * The forty-pixel column of tools down the left edge.
 *
 * Everything here toggles a surface rather than changing the room: the catalog panel beside
 * it, the properties column on the far side, and the two popovers that fly out of the rail.
 * Style and Help live here and nowhere else — one control, one place.
 */
export default function ToolRail() {
  const ui = useRoom((s) => s.ui);
  const setCatalogOpen = useRoom((s) => s.setCatalogOpen);
  const setRoomPanelOpen = useRoom((s) => s.setRoomPanelOpen);
  const setPropsTab = useRoom((s) => s.setPropsTab);
  const openDialog = useRoom((s) => s.openDialog);
  const closeDialog = useRoom((s) => s.closeDialog);
  const [help, setHelp] = useState(false);
  const style = ui.dialog === 'style';
  const styleAnchor = useRef<HTMLDivElement>(null);
  const helpAnchor = useRef<HTMLDivElement>(null);
  const roomShown = ui.roomPanelOpen && ui.propsTab === 'room';

  return (
    <nav aria-label="Tools" className="flex w-10 shrink-0 flex-col items-center gap-1 border-r border-line bg-panel py-2">
      <RailButton
        icon="catalog"
        label="Catalog"
        hint="Catalog"
        on={ui.catalogOpen}
        onClick={() => setCatalogOpen(!ui.catalogOpen)}
      />
      <RailButton
        icon="room"
        label="Room"
        hint="Room properties"
        on={roomShown}
        onClick={() => (roomShown ? setRoomPanelOpen(false) : ui.roomPanelOpen ? setPropsTab('room') : setRoomPanelOpen(true))}
      />

      <span className="flex-1" />

      <div className="relative" ref={styleAnchor}>
        <RailButton
          icon="palette"
          label="Style"
          hint="Style"
          on={style}
          onClick={() => (style ? closeDialog() : openDialog('style'))}
        />
        {style && <StylePopover onClose={closeDialog} anchorRef={styleAnchor} position="left-[calc(100%+8px)] bottom-0" />}
      </div>
      <div className="relative" ref={helpAnchor}>
        <RailButton
          icon="help"
          label="Help"
          hint="Help"
          on={help}
          onClick={() => setHelp((h) => !h)}
        />
        {help && <HelpPopover onClose={() => setHelp(false)} anchorRef={helpAnchor} position="left-[calc(100%+8px)] bottom-0" />}
      </div>
    </nav>
  );
}
