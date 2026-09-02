// src/plan/layers/Items.tsx
import type { PlacedItem, Room } from '../../engine/types';
import { findCatalogItem, isMounted, itemColor } from '../../engine/catalog';
import { footprint, frontVector, rotatedDims } from '../../engine/geometry';
import { Glyph } from '../glyphs';
import { ACCENT, BAD, INK_SOFT, ITEM_FILL_ALPHA, PAPER } from '../tokens';

/** Live verdict on the dragged item's position: accent when it fits, red when it does not. */
export type Fit = 'ok' | 'bad' | null;

const FIT_STROKE: Record<'ok' | 'bad', string> = { ok: ACCENT, bad: BAD };
const SIGNS: [number, number][] = [[0, 0], [1, 0], [0, 1], [1, 1]];

export function FrontMark({ item, room }: { item: PlacedItem; room: Room }) {
  const cat = findCatalogItem(room, item.catalogId);
  // A rug has no front to face, and a wall-mounted thing always faces the room it hangs in.
  if (!cat || cat.category === 'rug' || isMounted(cat)) return null;
  const { w, h } = rotatedDims(cat, item.rotation);
  const f = frontVector(item.rotation);
  const cx = item.x + (f.dx * w) / 2;
  const cy = item.y + (f.dy * h) / 2;
  const len = (f.dx === 0 ? w : h) * 0.55;
  const x1 = cx - (f.dy * len) / 2, y1 = cy + (f.dx * len) / 2, x2 = cx + (f.dy * len) / 2, y2 = cy - (f.dx * len) / 2;
  return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={INK_SOFT} strokeWidth={2} opacity={0.5} vectorEffect="non-scaling-stroke" />;
}

/** The four corner handles that say a shape is the one selected. */
function Handles({ x, y, w, h, u }: { x: number; y: number; w: number; h: number; u: number }) {
  const s = 5 * u;
  return (
    <g pointerEvents="none">
      {SIGNS.map(([sx, sy], i) => (
        <rect
          key={i}
          x={x + sx * w - s / 2}
          y={y + sy * h - s / 2}
          width={s}
          height={s}
          fill={PAPER}
          stroke={ACCENT}
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </g>
  );
}

/** A padlock at the corner of anything nothing is allowed to move. */
function LockMark({ x, y, u }: { x: number; y: number; u: number }) {
  const k = (10 * u) / 16;
  return (
    <g transform={`translate(${x} ${y}) scale(${k})`} pointerEvents="none" opacity={0.75}>
      <rect x={3.25} y={7} width={9.5} height={6.5} rx={1.5} fill={INK_SOFT} />
      <path d="M5.6 7V5.2a2.4 2.4 0 0 1 4.8 0V7" fill="none" stroke={INK_SOFT} strokeWidth={1.6} />
    </g>
  );
}

export default function Items({
  room, selectedId, dragPos, fit = null, u, onPointerDown,
}: {
  room: Room; selectedId: string | null; dragPos: { id: string; x: number; y: number } | null; fit?: Fit; u: number;
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
        const mounted = isMounted(cat);
        const fs = 9.5 * u;
        // A label only earns its place when the shape can hold it; below that the glyph and
        // the hover title carry the name on their own.
        const showLabel = r.w > cat.name.length * fs * 0.62 && r.h > fs * 2.2;
        return (
          <g key={raw.id} className="cursor-grab" onPointerDown={(e) => onPointerDown(e, raw)}>
            <title>{`${cat.name} · ${cat.width}×${cat.depth} cm · $${cat.price}`}</title>
            {/* A dashed outline says the piece hangs on the wall rather than standing on the floor. */}
            <rect
              x={r.x} y={r.y} width={r.w} height={r.h}
              fill={color} fillOpacity={mounted ? ITEM_FILL_ALPHA * 0.7 : ITEM_FILL_ALPHA}
              stroke={fitStroke ?? (selected ? ACCENT : INK_SOFT)}
              strokeWidth={fitStroke || selected ? 1.5 : 1}
              strokeDasharray={mounted && !fitStroke && !selected ? '4 3' : undefined}
              vectorEffect="non-scaling-stroke"
            />
            {/* Glyphs are authored front-down and rotated with the item, so a bed's pillows stay at its head. */}
            <g transform={`rotate(${item.rotation} ${item.x} ${item.y})`} pointerEvents="none">
              <Glyph shape={cat.shape} cx={item.x} cy={item.y} w={cat.width} h={cat.depth} color={INK_SOFT} />
            </g>
            <FrontMark item={item} room={room} />
            {showLabel && (
              <text
                x={item.x} y={item.y + fs * 0.36} fill={INK_SOFT} fontSize={fs} textAnchor="middle" pointerEvents="none"
                style={{ fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: `${0.5 * u}px` }}
              >{cat.name}</text>
            )}
            {raw.locked && <LockMark x={r.x + r.w - 12 * u} y={r.y + 2 * u} u={u} />}
            {selected && <Handles x={r.x} y={r.y} w={r.w} h={r.h} u={u} />}
          </g>
        );
      })}
    </g>
  );
}
