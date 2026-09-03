// src/ui/PropertiesPanel.tsx
import { useRoom } from '../store';
import type { PropsTab } from '../store';
import RoomPanel from './RoomPanel';
import StylePanel from './StylePanel';
import Inspector from './Inspector';
import IssuesPanel from './IssuesPanel';
import { Icon } from './icons';
import { CLOSE, FOCUS } from './styles';

const TABS: { key: PropsTab; label: string }[] = [
  { key: 'room', label: 'Room' },
  { key: 'style', label: 'Style' },
  { key: 'selection', label: 'Selection' },
  { key: 'issues', label: 'Issues' },
];

/**
 * The properties column: one room, one selection, one list of what is wrong.
 *
 * The tab is held in the store rather than here, because selecting something is what moves
 * it — and a selection can arrive from the plan, from the 3D view or from an agent's tool
 * call. Whichever it was, the column is already showing that piece by the time you look.
 */
export default function PropertiesPanel() {
  const tab = useRoom((s) => s.ui.propsTab);
  const selectedId = useRoom((s) => s.ui.selectedItemId);
  const issues = useRoom((s) => s.analysis.violations.length);
  const setPropsTab = useRoom((s) => s.setPropsTab);
  const setRoomPanelOpen = useRoom((s) => s.setRoomPanelOpen);

  return (
    <aside className="flex h-full w-[300px] shrink-0 flex-col border-l border-line bg-panel">
      <div className="flex h-10 shrink-0 items-center gap-1 border-b border-line pl-1.5 pr-2">
        <div role="tablist" aria-label="Properties" className="flex min-w-0 flex-1 items-center gap-0.5">
          {TABS.map((t) => {
            const on = tab === t.key;
            return (
              <button
                key={t.key}
                role="tab"
                aria-selected={on}
                onClick={() => setPropsTab(t.key)}
                className={`inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[12px] transition-colors ${FOCUS} ${
                  on ? 'bg-raised font-medium text-fg' : 'text-muted hover:text-fg'
                }`}
              >
                {t.label}
                {t.key === 'issues' && issues > 0 && (
                  <span className={`inline-flex h-4 min-w-4 items-center justify-center rounded px-1 font-mono text-[10px] tabular-nums ${on ? 'bg-bad/20 text-bad' : 'bg-bad/15 text-bad/90'}`}>{issues}</span>
                )}
              </button>
            );
          })}
        </div>
        <button
          className={CLOSE}
          aria-label="Close the room panel"
          title="Close the properties column. The Room button in the rail brings it back."
          onClick={() => setRoomPanelOpen(false)}
        ><Icon name="close" size={13} /></button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === 'room' && <RoomPanel />}
        {tab === 'style' && <StylePanel />}
        {tab === 'selection' && (selectedId ? <Inspector /> : (
          <p className="p-3 text-[11.5px] text-muted">Nothing is selected. Click a piece on the plan or in the 3D view to see its size, finish and clearances here.</p>
        ))}
        {tab === 'issues' && <IssuesPanel />}
      </div>
    </aside>
  );
}
