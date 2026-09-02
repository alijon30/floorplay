// src/ui/TopBar.tsx
import { useRoom } from '../store';
import { APP_NAME } from '../config';
import AgentChip from './AgentChip';
import RoomsMenu from './RoomsMenu';
import { Icon } from './icons';
import { ICON_BTN, NUM } from './styles';

/** The product mark: the same floor-plan glyph the rail uses, in the accent, once. */
function Brand() {
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[5px] bg-accent/12 text-accent">
      <Icon name="room" size={14} />
    </span>
  );
}

/**
 * Forty-four pixels: what this document is on the left, what the session is on the right,
 * and nothing at all in the middle.
 *
 * Everything that acts on the drawing lives in the rail or in a viewport's own toolbar, so
 * this bar never grows a second row of controls to push the work down the page.
 */
export default function TopBar() {
  const room = useRoom((s) => s.rooms[s.currentId]!);
  const persistError = useRoom((s) => s.persistError);
  const renameRoom = useRoom((s) => s.renameRoom);
  const undo = useRoom((s) => s.undo);

  return (
    <header className="flex h-11 shrink-0 items-center gap-2 border-b border-line bg-panel px-3">
      <Brand />
      <span className="shrink-0 text-[13px] font-medium tracking-tight">{APP_NAME}</span>
      <span aria-hidden="true" className="mx-1 h-4 w-px shrink-0 bg-line" />
      <input
        className="h-7 w-44 min-w-8 rounded-md border border-transparent bg-transparent px-1.5 text-[12.5px] text-fg outline-none transition-colors hover:bg-raised focus:border-line focus:bg-raised focus-visible:ring-1 focus-visible:ring-accent"
        value={room.name}
        onChange={(e) => renameRoom(e.target.value)}
        aria-label="Room name"
      />
      <span
        className={`shrink-0 text-[11px] text-muted ${NUM}`}
        title="Room size in centimetres"
      >{room.width} × {room.depth} × {room.height} cm</span>

      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        <button
          className={ICON_BTN}
          disabled={room.ledger.length === 0}
          aria-label="Undo"
          title="Undo the last change (Cmd/Ctrl+Z)"
          onClick={() => undo()}
        ><Icon name="undo" /></button>
        <RoomsMenu />
        <span aria-hidden="true" className="mx-0.5 h-4 w-px shrink-0 bg-line" />
        <AgentChip />
        {persistError && (
          <span className="flex shrink-0 items-center gap-1 rounded-md border border-warn/50 px-1.5 py-0.5 text-[11px] text-warn" title={persistError}>
            <Icon name="warning" size={12} />Not saved
          </span>
        )}
      </div>
    </header>
  );
}
