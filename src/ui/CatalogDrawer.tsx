// src/ui/CatalogDrawer.tsx
import { useMemo, useState } from 'react';
import { useRoom } from '../store';
import { catalogFor } from '../engine/catalog';
import { CATEGORIES, type Category } from '../engine/types';
import { nearestValid } from '../engine/nearest';
import { alternativesFor } from '../engine/alternatives';

export default function CatalogDrawer() {
  const room = useRoom((s) => s.rooms[s.currentId]!);
  const ui = useRoom((s) => s.ui);
  const { dispatch, select, setCatalogOpen } = useRoom((s) => s);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<Category | null>(ui.catalogFilter?.category ?? null);

  const fitsItem = ui.catalogFilter?.fitsItemId ? room.items.find((i) => i.id === ui.catalogFilter?.fitsItemId) : undefined;
  const alternatives = useMemo(() => (fitsItem ? alternativesFor(room, fitsItem.id) : []), [room, fitsItem]);

  const items = useMemo(() => {
    const q = query.toLowerCase();
    return catalogFor(room)
      .filter((c) => !category || c.category === category)
      .filter((c) => !q || c.name.toLowerCase().includes(q) || c.category.includes(q))
      .sort((a, b) => a.category.localeCompare(b.category) || a.price - b.price);
  }, [room, query, category]);

  if (!ui.catalogOpen) return null;

  const place = (catalogId: string) => {
    const pos = nearestValid(room, catalogId, Math.round(room.width / 2), Math.round(room.depth / 2), 0) ?? { x: Math.round(room.width / 2), y: Math.round(room.depth / 2) };
    const id = `item_${Date.now().toString(36)}`;
    dispatch({ actor: 'human', ops: [{ type: 'place', item: { id, catalogId, x: pos.x, y: pos.y, rotation: 0, locked: false } }] });
    select(id);
  };
  const replace = (catalogId: string) => {
    if (!fitsItem) return;
    dispatch({ actor: 'human', ops: [{ type: 'swap', id: fitsItem.id, catalogId }] });
    setCatalogOpen(false);
  };

  return (
    <aside className="absolute left-0 top-0 z-20 flex h-full w-72 flex-col border-r border-neutral-800 bg-neutral-900/95 text-sm backdrop-blur">
      <div className="flex items-center justify-between p-2">
        <strong>{fitsItem ? 'Alternatives' : 'Catalog'}</strong>
        <button className="text-neutral-400 hover:text-white" onClick={() => setCatalogOpen(false)}>×</button>
      </div>
      {fitsItem ? (
        <div className="flex-1 overflow-auto px-2 pb-2">
          {alternatives.length === 0 && <p className="text-neutral-500">Nothing else in this category.</p>}
          {alternatives.map((a) => (
            <div key={a.catalogId} className="mb-1 flex items-center justify-between rounded border border-neutral-800 p-2">
              <div><div>{a.name}</div><div className="text-xs text-neutral-500">{a.width}×{a.depth}×{a.height} · ${a.price} · {a.fits ? <span className="text-emerald-400">fits</span> : <span className="text-amber-400">does not fit</span>}</div></div>
              <button className="rounded bg-emerald-700 px-2 py-1 text-xs hover:bg-emerald-600" onClick={() => replace(a.catalogId)}>Replace</button>
            </div>
          ))}
        </div>
      ) : (
        <>
          <input className="mx-2 mb-2 rounded bg-neutral-800 p-2" placeholder="Search" value={query} onChange={(e) => setQuery(e.target.value)} />
          <div className="mb-2 flex flex-wrap gap-1 px-2">
            <button className={`rounded px-2 py-0.5 text-xs ${category === null ? 'bg-emerald-700' : 'bg-neutral-800'}`} onClick={() => setCategory(null)}>all</button>
            {CATEGORIES.map((c) => <button key={c} className={`rounded px-2 py-0.5 text-xs ${category === c ? 'bg-emerald-700' : 'bg-neutral-800'}`} onClick={() => setCategory(c)}>{c}</button>)}
          </div>
          <div className="flex-1 overflow-auto px-2 pb-2">
            {items.map((c) => (
              <div
                key={c.id}
                draggable
                onDragStart={(e) => e.dataTransfer.setData('text/floorplay-catalog', c.id)}
                className="mb-1 flex cursor-grab items-center justify-between rounded border border-neutral-800 p-2 hover:border-emerald-600"
              >
                <div>
                  <div className="flex items-center gap-2"><span className="inline-block h-3 w-3 rounded-sm" style={{ background: c.color }} />{c.name}{c.source === 'agent' && <span className="rounded bg-sky-900 px-1 text-[10px] text-sky-200">from agent</span>}</div>
                  <div className="text-xs text-neutral-500">{c.width}×{c.depth}×{c.height} cm · ${c.price}</div>
                </div>
                <button className="rounded bg-neutral-800 px-2 py-1 text-xs hover:bg-neutral-700" onClick={() => place(c.id)}>Place</button>
              </div>
            ))}
          </div>
        </>
      )}
    </aside>
  );
}
