// src/ui/IssuesPanel.tsx
import { useMemo } from 'react';
import { useRoom } from '../store';
import { BLOCKING_KINDS, nearestValid } from '../engine/nearest';
import { BTN_SM, BTN_SM_ON, CARD, ROW } from './styles';

/**
 * The room's open violations, each with a way to act on it.
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

  if (violations.length === 0) return null;

  return (
    <div className={`w-full p-3 text-sm ${CARD}`}>
      <strong className="mb-2 block">Issues ({violations.length})</strong>
      <ul className="max-h-[45vh] space-y-1 overflow-auto">
        {rows.map(({ v, item, fixable, spot, blocked }, i) => (
          <li key={i} className={`p-2 ${ROW}`}>
            <span className="rounded bg-red-950 px-1 py-0.5 text-[10px] text-red-300">{v.kind.replace(/_/g, ' ')}</span>
            <p className="mt-1 text-[11px] text-neutral-300">{v.message}</p>
            <div className="mt-1.5 flex gap-1">
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
                  Fix
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
