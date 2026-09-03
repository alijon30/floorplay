// src/ui/CatalogDrawer.tsx
import { useMemo, useState } from 'react';
import { useRoom } from '../store';
import { catalogFor } from '../engine/catalog';
import { CATEGORIES, ROOM_KINDS, type Category, type RoomKind, type Rotation } from '../engine/types';
import { nearestValid } from '../engine/nearest';
import { suggestPositions } from '../engine/anchors';
import { alternativesFor } from '../engine/alternatives';
import { ItemGlyph } from '../plan/glyphs';
import { Icon } from './icons';
import { BTN_SM, BTN_SM_ON, CLOSE, INPUT, NUM, TITLE } from './styles';

/**
 * One of the two filters under the search box.
 *
 * A select rather than a row of chips: twenty categories in a scrolling strip meant the one
 * you wanted was usually off the right edge, and a clipped chip gives no clue that it is
 * there at all. A select shows every option at once and says which one is on while closed.
 */
function Filter({ label, value, onChange, options }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md border border-line bg-raised px-2 transition-colors focus-within:border-accent/70 hover:border-[var(--line-hi)]">
      <span className="shrink-0 text-[11px] text-muted">{label}</span>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 min-w-0 flex-1 cursor-pointer bg-transparent text-[12px] capitalize text-fg outline-none"
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
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

  /**
   * The list as it is drawn: one unnamed group when a category is chosen, otherwise one group
   * per category in the order the sort already put them in.
   */
  const grouped = useMemo(() => {
    if (category) return [['', items]] as [string, typeof items][];
    const out: [string, typeof items][] = [];
    for (const c of items) {
      const last = out[out.length - 1];
      if (last && last[0] === c.category) last[1].push(c);
      else out.push([c.category, [c]]);
    }
    return out;
  }, [items, category]);

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
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-line bg-panel">
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-line px-2.5">
        <div className="flex min-w-0 items-baseline gap-1.5">
          <strong className={TITLE}>{fitsItem ? 'Alternatives' : 'Catalog'}</strong>
          <span className={`text-[11px] text-muted ${NUM}`}>{fitsItem ? alternatives.length : items.length} items</span>
        </div>
        <button className={CLOSE} aria-label="Close the catalog" onClick={() => setCatalogOpen(false)}><Icon name="close" size={13} /></button>
      </div>
      {fitsItem ? (
        <div className="flex-1 space-y-1 overflow-auto p-2">
          {alternatives.length === 0 && <p className="px-0.5 text-[11.5px] text-muted">Nothing else in this category.</p>}
          {alternatives.map((a) => {
            const cat = byId.get(a.catalogId);
            return (
              <div key={a.catalogId} className="flex items-center gap-2.5 rounded-md border border-line bg-raised p-2">
                {cat && <ItemGlyph shape={cat.shape} color={cat.color} w={cat.width} h={cat.depth} size={40} />}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12px] text-fg">{a.name}</div>
                  <div className={`text-[11px] text-muted ${NUM}`}>
                    {a.width}×{a.depth}×{a.height} · ${a.price} · {a.fits ? <span className="text-ok">fits</span> : <span className="text-warn">too big</span>}
                  </div>
                </div>
                <button className={BTN_SM_ON} onClick={() => replace(a.catalogId)}>Replace</button>
              </div>
            );
          })}
        </div>
      ) : (
        <>
          <div className="p-2.5 pb-1.5">
            <input className={INPUT} placeholder="Search the catalog" aria-label="Search the catalog" value={query} onChange={(e) => setQuery(e.target.value)} />
            <div className="mt-1.5 flex gap-1.5">
              <Filter
                label="Room:"
                value={roomKind ?? ''}
                onChange={(v) => setRoomKind(v === '' ? null : v as RoomKind)}
                options={[{ value: '', label: 'All rooms' }, ...ROOM_KINDS.map((k) => ({ value: k, label: k }))]}
              />
              <Filter
                label="Category:"
                value={category ?? ''}
                onChange={(v) => setCategory(v === '' ? null : v as Category)}
                options={[{ value: '', label: 'All' }, ...CATEGORIES.map((c) => ({ value: c, label: c }))]}
              />
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-2 pt-0.5">
            {items.length === 0 && <p className="px-0.5 text-[11.5px] text-muted">Nothing matches that filter.</p>}
            {grouped.map(([group, rows]) => (
              <div key={group}>
                {/* With no category chosen the list runs twenty categories deep, so each one
                    keeps its name pinned to the top of the scroll while its rows go past. */}
                {group !== '' && (
                  <div className="sticky top-0 z-10 -mx-2 bg-panel px-2.5 py-1 text-[10.5px] font-medium uppercase tracking-[0.08em] text-muted">
                    {group} <span className={`ml-0.5 text-muted/70 ${NUM}`}>{rows.length}</span>
                  </div>
                )}
                <div className="space-y-1 pb-1">
                  {rows.map((c) => (
                    <div
                      key={c.id}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData('text/floorplay-catalog', c.id)}
                      className="group flex cursor-grab items-center gap-2.5 rounded-md border border-line bg-raised p-2 transition-colors hover:border-accent/40"
                    >
                      {/* The mark the plan will draw, in the colour it will draw it. */}
                      <ItemGlyph shape={c.shape} color={c.color} w={c.width} h={c.depth} size={40} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-[12px] text-fg">{c.name}</span>
                          {c.source === 'agent' && <span className="shrink-0 rounded bg-accent/15 px-1 text-[10px] text-accent">agent</span>}
                        </div>
                        <div className={`text-[11px] text-muted ${NUM}`}>{c.width}×{c.depth}×{c.height} · ${c.price}</div>
                        {/* A few dots are enough to say "this one comes in other finishes". */}
                        {c.colors && c.colors.length > 0 && (
                          <div className="mt-1 flex gap-1">
                            {c.colors.slice(0, 5).map((col) => <span key={col} className="inline-block h-2 w-2 rounded-full ring-1 ring-line" style={{ background: col }} />)}
                          </div>
                        )}
                      </div>
                      <button className={BTN_SM} onClick={() => place(c.id)}>Place</button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </aside>
  );
}
