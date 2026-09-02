// src/plan/layers/Items.tsx
import type { PlacedItem, Room } from '../../engine/types';
import { findCatalogItem } from '../../engine/catalog';
import { footprint, frontVector, rotatedDims } from '../../engine/geometry';

/** Live verdict on the dragged item's position: emerald when it fits, red when it does not. */
export type Fit = 'ok' | 'bad' | null;

const FIT_STROKE: Record<'ok' | 'bad', string> = { ok: '#34d399', bad: '#ef4444' };

export function FrontMark({ item, room }: { item: PlacedItem; room: Room }) {
  const cat = findCatalogItem(room, item.catalogId);
  if (!cat || cat.category === 'rug') return null;
  const { w, h } = rotatedDims(cat, item.rotation);
  const f = frontVector(item.rotation);
  const cx = item.x + (f.dx * w) / 2;
  const cy = item.y + (f.dy * h) / 2;
  const len = (f.dx === 0 ? w : h) * 0.6;
  const x1 = cx - (f.dy * len) / 2, y1 = cy + (f.dx * len) / 2, x2 = cx + (f.dy * len) / 2, y2 = cy - (f.dx * len) / 2;
  return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#0a0a0a" strokeWidth={3} opacity={0.6} />;
}

export default function Items({
  room, selectedId, dragPos, fit = null, onPointerDown,
}: {
  room: Room; selectedId: string | null; dragPos: { id: string; x: number; y: number } | null; fit?: Fit;
  onPointerDown: (e: React.PointerEvent, item: PlacedItem) => void;
}) {
  const ordered = [...room.items].sort((a, b) => Number(findCatalogItem(room, a.catalogId)?.category !== 'rug') - Number(findCatalogItem(room, b.catalogId)?.category !== 'rug'));
  return (
    <g>
      {ordered.map((raw) => {
        const cat = findCatalogItem(room, raw.catalogId);
        if (!cat) return null;
        const dragging = dragPos?.id === raw.id;
        const item = dragging ? { ...raw, x: dragPos.x, y: dragPos.y } : raw;
        const r = footprint(item, cat);
        const selected = raw.id === selectedId;
        const fitStroke = dragging && fit ? FIT_STROKE[fit] : null;
        return (
          <g key={raw.id} className="cursor-grab" onPointerDown={(e) => onPointerDown(e, raw)}>
            <rect x={r.x} y={r.y} width={r.w} height={r.h} rx={cat.category === 'rug' ? 4 : 2} fill={cat.color} opacity={cat.category === 'rug' ? 0.5 : 0.95} stroke={fitStroke ?? (selected ? '#34d399' : '#0a0a0a')} strokeWidth={fitStroke || selected ? 3 : 1} />
            <FrontMark item={item} room={room} />
            <text x={item.x} y={item.y + 4} fill="#0a0a0a" fontSize={Math.min(12, Math.max(8, r.w / 8))} textAnchor="middle" pointerEvents="none">{cat.name}</text>
            {raw.locked && <text x={r.x + r.w - 6} y={r.y + 12} fontSize={11} textAnchor="end" pointerEvents="none">🔒</text>}
          </g>
        );
      })}
    </g>
  );
}
