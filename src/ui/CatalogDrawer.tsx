// src/ui/CatalogDrawer.tsx
import { useMemo, useState } from 'react';
import { useRoom } from '../store';
import { catalogFor } from '../engine/catalog';
import { CATEGORIES, ROOM_KINDS, type Category, type RoomKind, type Rotation } from '../engine/types';
import { nearestValid } from '../engine/nearest';
import { suggestPositions } from '../engine/anchors';
import { alternativesFor } from '../engine/alternatives';

export default function CatalogDrawer() {
  const room = useRoom((s) => s.rooms[s.currentId]!);
  const ui = useRoom((s) => s.ui);
  const { dispatch, select, setCatalogOpen } = useRoom((s) => s);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<Category | null>(ui.catalogFilter?.category ?? null);
  const [roomKind, setRoomKind] = useState<RoomKind | null>(null);

  const fitsItem = ui.catalogFilter?.fitsItemId ? room.items.find((i) => i.id === ui.catalogFilter?.fitsItemId) : undefined;
  const alternatives = useMemo(() => (fitsItem ? alternativesFor(room, fitsItem.id) : []), [room, fitsItem]);

  const items = useMemo(() => {
    const q = query.toLowerCase();
    return catalogFor(room)
      .filter((c) => !category || c.category === category)
      .filter((c) => !roomKind || c.rooms.includes(roomKind))
      .filter((c) => !q || c.name.toLowerCase().includes(q) || c.category.includes(q))
      .sort((a, b) => a.category.localeCompare(b.category) || a.price - b.price);
  }, [room, query, category, roomKind]);

  if (!ui.catalogOpen) return null;

  const place = (catalogId: string) => {
    // A suggestion knows about walls, light and the door, so it beats dropping the item in the
    // middle of the room and shuffling outward from there.
    const cx = Math.round(room.width / 2), cy = Math.round(room.depth / 2);
    const suggested = suggestPositions(room, catalogId, { count: 1 })[0];
    const near = suggested ? null : nearestValid(room, catalogId, cx, cy, 0);
    const pos = suggested
      ? { x: suggested.x, y: suggested.y, rotation: suggested.rotation }
      : near
        ? { x: near.x, y: near.y, rotation: 0 as Rotation }
        : { x: cx, y: cy, rotation: 0 as Rotation };
    const id = `item_${Date.now().toString(36)}`;
    dispatch({ actor: 'human', ops: [{ type: 'place', item: { id, catalogId, x: pos.x, y: pos.y, rotation: pos.rotation, locked: false } }] });
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
            <button className={`rounded-full px-2 py-0.5 text-xs ${roomKind === null ? 'bg-sky-800 text-sky-100' : 'bg-neutral-800 text-neutral-300'}`} onClick={() => setRoomKind(null)}>All rooms</button>
            {ROOM_KINDS.map((k) => (
              <button key={k} className={`rounded-full px-2 py-0.5 text-xs capitalize ${roomKind === k ? 'bg-sky-800 text-sky-100' : 'bg-neutral-800 text-neutral-300'}`} onClick={() => setRoomKind(k)}>{k}</button>
            ))}
          </div>
          <div className="mb-2 flex flex-wrap gap-1 px-2">
            <button className={`rounded px-2 py-0.5 text-xs ${category === null ? 'bg-emerald-700' : 'bg-neutral-800'}`} onClick={() => setCategory(null)}>all</button>
            {CATEGORIES.map((c) => <button key={c} className={`rounded px-2 py-0.5 text-xs ${category === c ? 'bg-emerald-700' : 'bg-neutral-800'}`} onClick={() => setCategory(c)}>{c}</button>)}
          </div>
          <div className="flex-1 overflow-auto px-2 pb-2">
            {items.length === 0 && <p className="text-neutral-500">Nothing matches that filter.</p>}
            {items.map((c) => (
              <div
                key={c.id}
                draggable
                onDragStart={(e) => e.dataTransfer.setData('text/floorplay-catalog', c.id)}
                className="mb-1 flex cursor-grab items-center justify-between rounded border border-neutral-800 p-2 hover:border-emerald-600"
              >
                <div>
                  <div className="flex items-center gap-2"><span className="inline-block h-3 w-3 rounded-sm" style={{ background: c.color }} />{c.name}{c.source === 'agent' && <span className="rounded bg-sky-900 px-1 text-[10px] text-sky-200">from agent</span>}</div>
                  <div className="flex items-center gap-2 text-xs text-neutral-500">
                    <span>{c.width}×{c.depth}×{c.height} cm · ${c.price}</span>
                    {/* A few dots are enough to say "this one comes in other finishes". */}
                    {c.colors && c.colors.length > 0 && (
                      <span className="flex gap-0.5">
                        {c.colors.slice(0, 4).map((col) => <span key={col} className="inline-block h-2 w-2 rounded-full ring-1 ring-neutral-700" style={{ background: col }} />)}
                      </span>
                    )}
                  </div>
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
