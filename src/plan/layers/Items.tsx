// src/plan/layers/Items.tsx
import type { PlacedItem, Room, Shape } from '../../engine/types';
import { findCatalogItem } from '../../engine/catalog';
import { footprint, frontVector, rotatedDims } from '../../engine/geometry';

/** Live verdict on the dragged item's position: emerald when it fits, red when it does not. */
export type Fit = 'ok' | 'bad' | null;

const FIT_STROKE: Record<'ok' | 'bad', string> = { ok: '#34d399', bad: '#ef4444' };

/** How much darker than the fill the border and glyph are drawn. */
const DARKEN = 0.35;

/** `#rrggbb` scaled toward black. Anything that is not a six-digit hex is returned untouched. */
export function darken(hex: string, amount = DARKEN): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = Number.parseInt(m[1]!, 16);
  const f = Math.max(0, 1 - amount);
  const channel = (shift: number) => Math.round(((n >> shift) & 0xff) * f).toString(16).padStart(2, '0');
  return `#${channel(16)}${channel(8)}${channel(0)}`;
}

/**
 * A small mark that says what the rectangle is without a legend. Drawn in the item's own
 * frame — `w` across, `h` deep, front edge at `+y` — and rotated into place by the caller.
 */
function Glyph({ shape, cx, cy, w, h, color }: { shape: Shape; cx: number; cy: number; w: number; h: number; color: string }) {
  const s = Math.min(w, h);
  const pad = Math.max(3, s * 0.14);
  const sw = Math.max(1, Math.min(2.5, s / 40));
  const l = cx - w / 2, r = cx + w / 2, t = cy - h / 2, b = cy + h / 2;
  const line = { stroke: color, strokeWidth: sw, strokeLinecap: 'round' as const };

  switch (shape) {
    case 'bed': {
      const pw = (w - pad * 3) / 2;
      const ph = Math.min(h * 0.24, pw * 0.75);
      if (pw <= 0 || ph <= 0) return null;
      return (
        <>
          <rect x={l + pad} y={t + pad} width={pw} height={ph} rx={2} fill={color} opacity={0.35} />
          <rect x={cx + pad / 2} y={t + pad} width={pw} height={ph} rx={2} fill={color} opacity={0.35} />
        </>
      );
    }
    case 'sofa':
      return (
        <>
          <line x1={l + w / 3} y1={t + pad} x2={l + w / 3} y2={b - pad} {...line} />
          <line x1={l + (2 * w) / 3} y1={t + pad} x2={l + (2 * w) / 3} y2={b - pad} {...line} />
        </>
      );
    case 'desk':
      return <line x1={l + pad} y1={b - pad} x2={r - pad} y2={b - pad} {...line} />;
    case 'table':
      return <rect x={l + pad} y={t + pad} width={w - pad * 2} height={h - pad * 2} rx={Math.min(6, s / 4)} fill="none" stroke={color} strokeWidth={sw} />;
    case 'wardrobe': {
      // Handles sit near the front, clear of the centred name label.
      const hy = cy + h * 0.22;
      const hr = Math.max(2, sw * 1.4);
      return (
        <>
          <line x1={cx} y1={t + pad} x2={cx} y2={b - pad} {...line} />
          <circle cx={cx - hr * 2} cy={hy} r={hr} fill={color} />
          <circle cx={cx + hr * 2} cy={hy} r={hr} fill={color} />
        </>
      );
    }
    case 'shelf':
      return (
        <>
          {[0.25, 0.5, 0.75].map((f) => (
            <line key={f} x1={l + pad} y1={t + h * f} x2={r - pad} y2={t + h * f} {...line} />
          ))}
        </>
      );
    case 'rug':
      return <rect x={l + pad} y={t + pad} width={w - pad * 2} height={h - pad * 2} rx={4} fill="none" stroke={color} strokeWidth={sw} opacity={0.8} />;
    case 'lamp':
    case 'plant':
      return <circle cx={cx} cy={cy} r={Math.max(2, s / 2 - pad)} fill="none" stroke={color} strokeWidth={sw} />;
    case 'tv':
      return <rect x={l + pad} y={t + pad} width={w - pad * 2} height={h - pad * 2} rx={2} fill={color} opacity={0.3} />;
    case 'chair':
      return <line x1={l + pad} y1={t + pad} x2={r - pad} y2={t + pad} {...line} />;
    case 'box':
      return null;
  }
}

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
        const ink = darken(cat.color);
        return (
          <g key={raw.id} className="cursor-grab" onPointerDown={(e) => onPointerDown(e, raw)}>
            <title>{`${cat.name} · ${cat.width}×${cat.depth} cm · $${cat.price}`}</title>
            <rect x={r.x} y={r.y} width={r.w} height={r.h} rx={6} fill={cat.color} opacity={0.85} stroke={fitStroke ?? (selected ? '#34d399' : ink)} strokeWidth={fitStroke || selected ? 3 : 1.5} />
            {/* Glyphs are authored front-down and rotated with the item, so a bed's pillows stay at its head. */}
            <g transform={`rotate(${item.rotation} ${item.x} ${item.y})`} pointerEvents="none">
              <Glyph shape={cat.shape} cx={item.x} cy={item.y} w={cat.width} h={cat.depth} color={ink} />
            </g>
            <FrontMark item={item} room={room} />
            <text x={item.x} y={item.y + 4} fill="#0a0a0a" fontSize={Math.min(12, Math.max(8, r.w / 8))} textAnchor="middle" pointerEvents="none">{cat.name}</text>
            {raw.locked && <text x={r.x + r.w - 6} y={r.y + 12} fontSize={11} textAnchor="end" pointerEvents="none">🔒</text>}
          </g>
        );
      })}
    </g>
  );
}
