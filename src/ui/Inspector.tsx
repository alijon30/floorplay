// src/ui/Inspector.tsx
import { useRoom } from '../store';
import { findCatalogItem, itemColor } from '../engine/catalog';
import { rotatedDims } from '../engine/geometry';
import { ROTATIONS } from '../engine/types';

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
  return (
    <div className="w-64 shrink-0 rounded-lg border border-neutral-700 bg-neutral-900/95 p-3 text-sm shadow-xl backdrop-blur">
      <div className="mb-1 flex items-center justify-between"><strong>{cat.name}</strong><button className="text-neutral-400 hover:text-white" onClick={() => select(null)}>×</button></div>
      <div className="mb-2 text-xs text-neutral-400">{cat.category} · {dims.w}×{dims.h} cm footprint · {cat.height} cm tall · ${cat.price} · light {light}%</div>
      <div className="mb-2 flex gap-1">
        {ROTATIONS.map((r) => (
          <button key={r} disabled={item.locked} className={`flex-1 rounded px-1 py-0.5 text-xs ${item.rotation === r ? 'bg-emerald-700' : 'bg-neutral-800 hover:bg-neutral-700'} disabled:opacity-40`} onClick={() => dispatch({ actor: 'human', ops: [{ type: 'move', id: item.id, x: item.x, y: item.y, rotation: r }] })}>{r}°</button>
        ))}
      </div>
      {cat.colors && cat.colors.length > 0 && (
        <div className="mb-2">
          <div className="mb-1 text-[11px] uppercase tracking-wide text-neutral-500">Finish</div>
          <div className="flex flex-wrap items-center gap-1.5">
            {cat.colors.map((c) => (
              <button
                key={c}
                title={c}
                aria-label={`Color ${c}`}
                aria-pressed={itemColor(cat, item.color) === c}
                onClick={() => dispatch({ actor: 'human', ops: [{ type: 'recolor', id: item.id, color: c }] })}
                className={`h-6 w-6 rounded ring-offset-2 ring-offset-neutral-900 ${itemColor(cat, item.color) === c ? 'ring-2 ring-emerald-400' : 'ring-1 ring-neutral-700 hover:ring-neutral-400'}`}
                style={{ background: c }}
              />
            ))}
            {/* Clearing the override is its own choice, so it gets a chip rather than hiding
                behind whichever swatch happens to equal the catalog color. */}
            <button
              aria-pressed={item.color === undefined}
              onClick={() => dispatch({ actor: 'human', ops: [{ type: 'recolor', id: item.id, color: null }] })}
              className={`rounded px-2 py-0.5 text-[11px] ${item.color === undefined ? 'bg-emerald-700 text-white' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'}`}
            >Default</button>
          </div>
        </div>
      )}
      <div className="mb-2 flex gap-1">
        <button className="flex-1 rounded bg-neutral-800 px-2 py-1 text-xs hover:bg-neutral-700" onClick={() => dispatch({ actor: 'human', ops: [{ type: 'setLocked', id: item.id, locked: !item.locked }] })}>{item.locked ? 'Unlock' : 'Lock'}</button>
        <button className="flex-1 rounded bg-neutral-800 px-2 py-1 text-xs hover:bg-neutral-700" onClick={() => setCatalogOpen(true, { category: cat.category, fitsItemId: item.id })}>Alternatives</button>
        <button disabled={item.locked} className="flex-1 rounded bg-red-900 px-2 py-1 text-xs hover:bg-red-800 disabled:opacity-40" onClick={() => { dispatch({ actor: 'human', ops: [{ type: 'remove', id: item.id }] }); select(null); }}>Remove</button>
      </div>
      {issues.length > 0 && <ul className="list-disc pl-4 text-xs text-red-300">{issues.map((v, i) => <li key={i}>{v.message}</li>)}</ul>}
      <p className="mt-2 text-[11px] text-neutral-500">Drag to move · R rotate · L lock · Delete remove</p>
    </div>
  );
}
