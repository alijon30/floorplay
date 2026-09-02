// src/ui/IssuesPanel.tsx
import { useMemo } from 'react';
import { useRoom } from '../store';
import { BLOCKING_KINDS, nearestValid } from '../engine/nearest';
import { Icon } from './icons';
import { BTN_SM, BTN_SM_ON } from './styles';

/**
 * The Issues tab: every rule the layout breaks right now, each with a way to act on it.
 *
 * "Fix" is offered only for the kinds a move can actually resolve — `BLOCKING_KINDS` — so
 * `over_budget` and `unreachable` get a message and a Select button and nothing else.
 */
export default function IssuesPanel() {
  const room = useRoom((s) => s.rooms[s.currentId]!);
  const violations = useRoom((s) => s.analysis.violations);
  const { dispatch, select } = useRoom((s) => s);

  const rows = useMemo(
    () =>
      violations.map((v) => {
        const item = v.itemIds[0] ? room.items.find((i) => i.id === v.itemIds[0]) : undefined;
        const fixable = BLOCKING_KINDS.has(v.kind);
        const spot = fixable && item && !item.locked ? nearestValid(room, item.catalogId, item.x, item.y, item.rotation, item.id) : null;
        const blocked = !item ? 'No item to move' : item.locked ? 'Unlock the item to fix it' : !spot ? 'No clear spot within 200 cm' : null;
        return { v, item, fixable, spot, blocked };
      }),
    [room, violations],
  );

  if (violations.length === 0) {
    return (
      <div className="flex flex-col items-start gap-1.5 p-3">
        <span className="flex h-6 items-center gap-1.5 rounded border border-ok/30 bg-ok/8 px-1.5 text-[11px] text-ok">
          <Icon name="fit" size={12} />No issues
        </span>
        <p className="text-[11.5px] leading-snug text-muted">Nothing overlaps, every walkway is clear and the layout is inside its budget.</p>
      </div>
    );
  }

  return (
    <div className="p-3">
      <h2 className="mb-2 text-[13px] font-medium text-fg">Issues ({violations.length})</h2>
      <ul className="space-y-1.5">
        {rows.map(({ v, item, fixable, spot, blocked }, i) => (
          <li key={i} className="rounded-md border border-line bg-raised p-2">
            <span className="inline-block rounded bg-bad/15 px-1.5 py-px text-[10px] uppercase tracking-[0.06em] text-bad">{v.kind.replace(/_/g, ' ')}</span>
            <p className="mt-1.5 text-[11.5px] leading-snug text-fg/90">{v.message}</p>
            <div className="mt-2 flex gap-1.5">
              <button
                className={BTN_SM}
                disabled={!item}
                title={item ? undefined : 'This issue is not about one item'}
                onClick={() => item && select(item.id)}
              >
                Select
              </button>
              {fixable && (
                <button
                  className={BTN_SM_ON}
                  disabled={blocked !== null}
                  title={blocked ?? 'Move it to the nearest clear spot'}
                  onClick={() => {
                    if (!item || !spot) return;
                    dispatch({ actor: 'human', ops: [{ type: 'move', id: item.id, x: spot.x, y: spot.y, rotation: item.rotation }] });
                  }}
                >
                  <Icon name="wand" size={12} />Fix
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
