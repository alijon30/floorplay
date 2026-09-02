// src/ui/CatalogDrawer.tsx
import { useMemo, useState } from 'react';
import { useRoom } from '../store';
import { catalogFor } from '../engine/catalog';
import { CATEGORIES, ROOM_KINDS, type Category, type RoomKind, type Rotation } from '../engine/types';
import { nearestValid } from '../engine/nearest';
import { suggestPositions } from '../engine/anchors';
import { alternativesFor } from '../engine/alternatives';
import { ItemGlyph } from '../plan/glyphs';
import { BTN_QUIET, BTN_SM, BTN_SM_ON, CLOSE, INPUT, ROW } from './styles';

/**
 * One horizontally scrolling line of filter chips. Twenty categories should cost one row, not
 * five, so the list they filter starts near the top of the drawer. The fade on the right edge
 * is the only thing saying there is more to scroll to.
 */
function ChipRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="relative shrink-0">
      <div role="group" aria-label={label} className="flex gap-1 overflow-x-auto px-2 pb-1.5 whitespace-nowrap">
        {children}
      </div>
      <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-neutral-900 to-transparent" />
    </div>
  );
}

export default function CatalogDrawer() {
  const room = useRoom((s) => s.rooms[s.currentId]!);
  const ui = useRoom((s) => s.ui);
  const { dispatch, select, setCatalogOpen } = useRoom((s) => s);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<Category | null>(ui.catalogFilter?.category ?? null);
  const [roomKind, setRoomKind] = useState<RoomKind | null>(null);

  const fitsItem = ui.catalogFilter?.fitsItemId ? room.items.find((i) => i.id === ui.catalogFilter?.fitsItemId) : undefined;
  const alternatives = useMemo(() => (fitsItem ? alternativesFor(room, fitsItem.id) : []), [room, fitsItem]);
  // Alternatives carry only their numbers, so the thumbnail reads its shape and colour back
  // out of the catalog the row came from.
  const byId = useMemo(() => new Map(catalogFor(room).map((c) => [c.id, c])), [room]);

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
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-neutral-800 bg-neutral-900 text-sm">
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-neutral-800 px-3">
        <strong className="text-sm">{fitsItem ? 'Alternatives' : 'Catalog'}</strong>
        <button className={CLOSE} aria-label="Close the catalog" onClick={() => setCatalogOpen(false)}>×</button>
      </div>
      {fitsItem ? (
        <div className="flex-1 space-y-1 overflow-auto p-2">
          {alternatives.length === 0 && <p className="text-xs text-neutral-500">Nothing else in this category.</p>}
          {alternatives.map((a) => {
            const cat = byId.get(a.catalogId);
            return (
              <div key={a.catalogId} className={`flex items-center gap-2 p-2 ${ROW}`}>
                {cat && <ItemGlyph shape={cat.shape} color={cat.color} w={cat.width} h={cat.depth} />}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs text-neutral-100">{a.name}</div>
                  <div className="text-[11px] text-neutral-500">
                    {a.width}×{a.depth}×{a.height} · ${a.price} · {a.fits ? <span className="text-emerald-400">fits</span> : <span className="text-amber-400">does not fit</span>}
                  </div>
                </div>
                <button className={BTN_SM_ON} onClick={() => replace(a.catalogId)}>Replace</button>
              </div>
            );
          })}
        </div>
      ) : (
        <>
          <div className="p-2 pb-1.5">
            <input className={`${INPUT} w-full`} placeholder="Search" aria-label="Search the catalog" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <ChipRow label="Room kinds">
            <button className={roomKind === null ? 'shrink-0 rounded-full bg-sky-800 px-2 py-0.5 text-xs text-sky-100' : 'shrink-0 rounded-full bg-neutral-800 px-2 py-0.5 text-xs text-neutral-300 hover:bg-neutral-700'} onClick={() => setRoomKind(null)}>All rooms</button>
            {ROOM_KINDS.map((k) => (
              <button key={k} className={roomKind === k ? 'shrink-0 rounded-full bg-sky-800 px-2 py-0.5 text-xs capitalize text-sky-100' : 'shrink-0 rounded-full bg-neutral-800 px-2 py-0.5 text-xs capitalize text-neutral-300 hover:bg-neutral-700'} onClick={() => setRoomKind(k)}>{k}</button>
            ))}
          </ChipRow>
          <ChipRow label="Categories">
            <button className={category === null ? BTN_SM_ON : BTN_SM} onClick={() => setCategory(null)}>all</button>
            {CATEGORIES.map((c) => <button key={c} className={category === c ? BTN_SM_ON : BTN_SM} onClick={() => setCategory(c)}>{c}</button>)}
          </ChipRow>
          <div className="flex-1 space-y-1 overflow-auto p-2 pt-1">
            {items.length === 0 && <p className="text-xs text-neutral-500">Nothing matches that filter.</p>}
            {items.map((c) => (
              <div
                key={c.id}
                draggable
                onDragStart={(e) => e.dataTransfer.setData('text/floorplay-catalog', c.id)}
                className={`flex cursor-grab items-center gap-2 p-2 transition-colors hover:border-emerald-600 ${ROW}`}
              >
                {/* The mark the plan will draw, in the colour it will draw it. */}
                <ItemGlyph shape={c.shape} color={c.color} w={c.width} h={c.depth} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-xs text-neutral-100">{c.name}</span>
                    {c.source === 'agent' && <span className="shrink-0 rounded bg-sky-900 px-1 text-[10px] text-sky-200">from agent</span>}
                  </div>
                  <div className="text-[11px] text-neutral-500">{c.width}×{c.depth}×{c.height} cm · ${c.price}</div>
                  {/* A few dots are enough to say "this one comes in other finishes". */}
                  {c.colors && c.colors.length > 0 && (
                    <div className="mt-1 flex gap-1">
                      {c.colors.slice(0, 5).map((col) => <span key={col} className="inline-block h-2 w-2 rounded-full ring-1 ring-neutral-700" style={{ background: col }} />)}
                    </div>
                  )}
                </div>
                <button className={BTN_QUIET} onClick={() => place(c.id)}>Place</button>
              </div>
            ))}
          </div>
        </>
      )}
    </aside>
  );
}
