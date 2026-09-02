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
import { BTN_SM, BTN_SM_ON, CLOSE, INPUT, LABEL, NUM, TITLE } from './styles';

/**
 * One horizontally scrolling line of filter chips. Twenty categories should cost one row, not
 * five, so the list they filter starts near the top of the panel. The fade on the right edge
 * is the only thing saying there is more to scroll to.
 */
function ChipRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="relative shrink-0">
      <div role="group" aria-label={label} className="flex gap-1 overflow-x-auto px-2.5 pb-1.5 whitespace-nowrap">
        {children}
      </div>
      <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-panel to-transparent" />
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
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-line bg-panel">
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-line px-2.5">
        <strong className={TITLE}>{fitsItem ? 'Alternatives' : 'Catalog'}</strong>
        <button className={CLOSE} aria-label="Close the catalog" onClick={() => setCatalogOpen(false)}><Icon name="close" size={13} /></button>
      </div>
      {fitsItem ? (
        <div className="flex-1 space-y-1 overflow-auto p-2">
          {alternatives.length === 0 && <p className="px-0.5 text-[11.5px] text-muted">Nothing else in this category.</p>}
          {alternatives.map((a) => {
            const cat = byId.get(a.catalogId);
            return (
              <div key={a.catalogId} className="flex items-center gap-2.5 rounded-md border border-line bg-raised p-2">
                {cat && <ItemGlyph shape={cat.shape} color={cat.color} w={cat.width} h={cat.depth} />}
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
          <div className="p-2.5 pb-2">
            <input className={INPUT} placeholder="Search the catalog" aria-label="Search the catalog" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <div className={`px-2.5 pb-1 ${LABEL}`}>Room</div>
          <ChipRow label="Room kinds">
            <button className={roomKind === null ? BTN_SM_ON : BTN_SM} onClick={() => setRoomKind(null)}>All rooms</button>
            {ROOM_KINDS.map((k) => (
              <button key={k} className={`capitalize ${roomKind === k ? BTN_SM_ON : BTN_SM}`} onClick={() => setRoomKind(k)}>{k}</button>
            ))}
          </ChipRow>
          <div className={`px-2.5 pb-1 pt-1 ${LABEL}`}>Category</div>
          <ChipRow label="Categories">
            <button className={category === null ? BTN_SM_ON : BTN_SM} onClick={() => setCategory(null)}>all</button>
            {CATEGORIES.map((c) => <button key={c} className={category === c ? BTN_SM_ON : BTN_SM} onClick={() => setCategory(c)}>{c}</button>)}
          </ChipRow>
          <div className="min-h-0 flex-1 space-y-1 overflow-auto p-2 pt-1.5">
            {items.length === 0 && <p className="px-0.5 text-[11.5px] text-muted">Nothing matches that filter.</p>}
            {items.map((c) => (
              <div
                key={c.id}
                draggable
                onDragStart={(e) => e.dataTransfer.setData('text/floorplay-catalog', c.id)}
                className="group flex cursor-grab items-center gap-2.5 rounded-md border border-line bg-raised p-2 transition-colors hover:border-accent/40"
              >
                {/* The mark the plan will draw, in the colour it will draw it. */}
                <ItemGlyph shape={c.shape} color={c.color} w={c.width} h={c.depth} />
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
        </>
      )}
    </aside>
  );
}
