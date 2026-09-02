// src/ui/Inspector.tsx
import { useRoom } from '../store';
import { findCatalogItem, itemColor } from '../engine/catalog';
import { rotatedDims } from '../engine/geometry';
import { ROTATIONS } from '../engine/types';
import { ItemGlyph } from '../plan/glyphs';
import { BTN_DANGER, BTN_QUIET, BTN_SM, BTN_SM_ON, CARD, CLOSE, LABEL } from './styles';

export default function Inspector() {
  const room = useRoom((s) => s.rooms[s.currentId]!);
  const analysis = useRoom((s) => s.analysis);
  const selectedId = useRoom((s) => s.ui.selectedItemId);
  const { dispatch, select, setCatalogOpen } = useRoom((s) => s);
  const item = selectedId ? room.items.find((i) => i.id === selectedId) : undefined;
  const cat = item ? findCatalogItem(room, item.catalogId) : undefined;
  if (!item || !cat) return null;
  const dims = rotatedDims(cat, item.rotation);
  const issues = analysis.violations.filter((v) => v.itemIds.includes(item.id));
  const light = Math.round((analysis.metrics.lightByItem[item.id] ?? 0) * 100);
  const color = itemColor(cat, item.color);
  return (
    <div className={`w-full p-3 text-sm ${CARD}`}>
      <div className="mb-2 flex items-start gap-2">
        <ItemGlyph shape={cat.shape} color={color} w={cat.width} h={cat.depth} />
        <div className="min-w-0 flex-1">
          <strong className="block truncate leading-tight">{cat.name}</strong>
          <span className="text-[11px] text-neutral-500">{cat.category} · ${cat.price}</span>
        </div>
        <button className={CLOSE} aria-label="Close the inspector" onClick={() => select(null)}>×</button>
      </div>
      <div className="mb-2 text-[11px] text-neutral-400">{dims.w}×{dims.h} cm footprint · {cat.height} cm tall · light {light}%</div>

      <div className={`mb-1 ${LABEL}`}>Rotation</div>
      <div className="mb-2 flex gap-1">
        {ROTATIONS.map((r) => (
          <button
            key={r}
            disabled={item.locked}
            className={`flex-1 ${item.rotation === r ? BTN_SM_ON : BTN_SM}`}
            onClick={() => dispatch({ actor: 'human', ops: [{ type: 'move', id: item.id, x: item.x, y: item.y, rotation: r }] })}
          >{r}°</button>
        ))}
      </div>

      {cat.colors && cat.colors.length > 0 && (
        <div className="mb-2">
          <div className={`mb-1 ${LABEL}`}>Finish</div>
          <div className="flex flex-wrap items-center gap-1.5">
            {cat.colors.map((c) => (
              <button
                key={c}
                title={c}
                aria-label={`Color ${c}`}
                aria-pressed={color === c}
                onClick={() => dispatch({ actor: 'human', ops: [{ type: 'recolor', id: item.id, color: c }] })}
                className={`h-6 w-6 rounded ring-offset-2 ring-offset-neutral-900 focus-visible:outline-none ${color === c ? 'ring-2 ring-emerald-400' : 'ring-1 ring-neutral-700 hover:ring-neutral-400'}`}
                style={{ background: c }}
              />
            ))}
            {/* Clearing the override is its own choice, so it gets a chip rather than hiding
                behind whichever swatch happens to equal the catalog color. */}
            <button
              aria-pressed={item.color === undefined}
              onClick={() => dispatch({ actor: 'human', ops: [{ type: 'recolor', id: item.id, color: null }] })}
              className={item.color === undefined ? BTN_SM_ON : BTN_SM}
            >Default</button>
          </div>
        </div>
      )}

      <div className="mb-2 flex gap-1">
        <button className={`flex-1 ${BTN_QUIET}`} onClick={() => dispatch({ actor: 'human', ops: [{ type: 'setLocked', id: item.id, locked: !item.locked }] })}>{item.locked ? 'Unlock' : 'Lock'}</button>
        <button className={`flex-1 ${BTN_QUIET}`} title="Show pieces that could take its place" onClick={() => setCatalogOpen(true, { category: cat.category, fitsItemId: item.id })}>Swap</button>
        <button disabled={item.locked} className={`flex-1 ${BTN_DANGER}`} onClick={() => { dispatch({ actor: 'human', ops: [{ type: 'remove', id: item.id }] }); select(null); }}>Remove</button>
      </div>

      {issues.length > 0 && <ul className="list-disc pl-4 text-[11px] text-red-300">{issues.map((v, i) => <li key={i}>{v.message}</li>)}</ul>}
      <p className="mt-2 text-[11px] text-neutral-500">Drag to move · R rotate · L lock · Delete remove</p>
    </div>
  );
}
