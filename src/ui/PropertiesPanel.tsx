// src/ui/PropertiesPanel.tsx
import { useRoom } from '../store';
import type { PropsTab } from '../store';
import CatalogDrawer from './CatalogDrawer';
import RoomPanel from './RoomPanel';
import StylePanel from './StylePanel';
import Inspector from './Inspector';
import IssuesPanel from './IssuesPanel';
import { Icon } from './icons';
import { CLOSE, FOCUS } from './styles';

const TABS: { key: PropsTab; label: string }[] = [
  { key: 'catalog', label: 'Catalog' },
  { key: 'room', label: 'Room' },
  { key: 'style', label: 'Style' },
  { key: 'selection', label: 'Selection' },
  { key: 'issues', label: 'Issues' },
];

/**
 * The properties column: the catalog, the room, its style, one selection, and what is wrong.
 *
 * It sits between the tool rail and the viewports rather than on the far side of them, so
 * every control in the app is down one edge and the drawing has the rest of the window. The
 * catalog is a tab here for the same reason: a second column of its own left the plan boxed
 * in between two panels.
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
    <aside className="flex h-full w-[320px] shrink-0 flex-col border-r border-line bg-panel">
      <div className="flex h-10 shrink-0 items-center gap-1 border-b border-line pl-1.5 pr-2">
        {/* Five tabs do not fit 320 px at every font size, so the strip scrolls rather than
            wrapping to a second row and stealing height from the panel below it. */}
        <div role="tablist" aria-label="Properties" className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto">
          {TABS.map((t) => {
            const on = tab === t.key;
            return (
              <button
                key={t.key}
                role="tab"
                aria-selected={on}
                onClick={() => setPropsTab(t.key)}
                className={`inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md px-1.5 text-[12px] transition-colors ${FOCUS} ${
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

      {/* The catalog brings its own scrolling list and sticky group headings, so it gets the
          box whole; everything else is a short column that scrolls as one. */}
      <div className={`min-h-0 flex-1 ${tab === 'catalog' ? 'flex flex-col overflow-hidden' : 'overflow-y-auto'}`}>
        {tab === 'catalog' && <CatalogDrawer />}
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
