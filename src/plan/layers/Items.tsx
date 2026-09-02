// src/plan/layers/Items.tsx
import type { PlacedItem, Room } from '../../engine/types';
import { findCatalogItem, isMounted, itemColor } from '../../engine/catalog';
import { footprint, frontVector, rotatedDims } from '../../engine/geometry';
import { Glyph, darken } from '../glyphs';

/** Live verdict on the dragged item's position: emerald when it fits, red when it does not. */
export type Fit = 'ok' | 'bad' | null;

const FIT_STROKE: Record<'ok' | 'bad', string> = { ok: '#34d399', bad: '#ef4444' };

export function FrontMark({ item, room }: { item: PlacedItem; room: Room }) {
  const cat = findCatalogItem(room, item.catalogId);
  // A rug has no front to face, and a wall-mounted thing always faces the room it hangs in.
  if (!cat || cat.category === 'rug' || isMounted(cat)) return null;
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
  // Bottom to top: rugs are underfoot, furniture stands on them, wall-mounted pieces hang
  // above everything, so a picture stays legible over the sofa it is centred on.
  const layer = (id: string) => {
    const cat = findCatalogItem(room, id);
    if (!cat) return 1;
    return cat.category === 'rug' ? 0 : isMounted(cat) ? 2 : 1;
  };
  const ordered = [...room.items].sort((a, b) => layer(a.catalogId) - layer(b.catalogId));
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
        const color = itemColor(cat, raw.color);
        const ink = darken(color);
        const mounted = isMounted(cat);
        return (
          <g key={raw.id} className="cursor-grab" onPointerDown={(e) => onPointerDown(e, raw)}>
            <title>{`${cat.name} · ${cat.width}×${cat.depth} cm · $${cat.price}`}</title>
            {/* A dashed outline says the piece hangs on the wall rather than standing on the floor. */}
            <rect
              x={r.x} y={r.y} width={r.w} height={r.h} rx={mounted ? 2 : 6}
              fill={color} opacity={mounted ? 0.7 : 0.85}
              stroke={fitStroke ?? (selected ? '#34d399' : ink)} strokeWidth={fitStroke || selected ? 3 : 1.5}
              strokeDasharray={mounted && !fitStroke && !selected ? '5 3' : undefined}
            />
            {/* Glyphs are authored front-down and rotated with the item, so a bed's pillows stay at its head. */}
            <g transform={`rotate(${item.rotation} ${item.x} ${item.y})`} pointerEvents="none">
              <Glyph shape={cat.shape} cx={item.x} cy={item.y} w={cat.width} h={cat.depth} color={ink} />
            </g>
            <FrontMark item={item} room={room} />
            {/* Wall-mounted rects are only a few centimetres deep, so the label is capped by
                the height as well as the width and never spills over the outline. */}
            <text x={item.x} y={item.y + Math.min(4, r.h * 0.35)} fill="#0a0a0a" fontSize={Math.min(12, Math.max(5, Math.min(r.w / 8, r.h * 0.8)))} textAnchor="middle" pointerEvents="none">{cat.name}</text>
            {raw.locked && <text x={r.x + r.w - 6} y={r.y + 12} fontSize={11} textAnchor="end" pointerEvents="none">🔒</text>}
          </g>
        );
      })}
    </g>
  );
}
