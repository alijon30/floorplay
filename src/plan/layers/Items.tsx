// src/plan/layers/Items.tsx
import type { PlacedItem, Room, Shape } from '../../engine/types';
import { findCatalogItem, isMounted, itemColor } from '../../engine/catalog';
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
    case 'counter':
      // An unbroken run to the very ends, which is what tells a counter from a desk.
      return <line x1={l} y1={b - pad} x2={r} y2={b - pad} {...line} />;
    case 'appliance':
      return (
        <>
          <line x1={l + pad} y1={b - pad} x2={r - pad} y2={b - pad} {...line} />
          <circle cx={cx} cy={cy} r={Math.max(1.5, s * 0.09)} fill={color} />
        </>
      );
    case 'stool':
      return (
        <>
          <circle cx={cx} cy={cy} r={Math.max(2, s / 2 - pad)} fill="none" stroke={color} strokeWidth={sw} />
          <circle cx={cx} cy={cy} r={Math.max(1, sw)} fill={color} />
        </>
      );
    case 'bench':
      return <rect x={l + pad} y={t + pad} width={w - pad * 2} height={h - pad * 2} rx={2} fill="none" stroke={color} strokeWidth={sw} />;
    case 'pouf':
      return <ellipse cx={cx} cy={cy} rx={Math.max(2, w / 2 - pad)} ry={Math.max(2, h / 2 - pad)} fill="none" stroke={color} strokeWidth={sw} />;
    case 'crib': {
      const bars = 4;
      return (
        <>
          <rect x={l + pad} y={t + pad} width={w - pad * 2} height={h - pad * 2} rx={2} fill="none" stroke={color} strokeWidth={sw} />
          {Array.from({ length: bars }, (_, i) => {
            const y = t + pad + ((i + 1) * (h - pad * 2)) / (bars + 1);
            return <line key={i} x1={l + pad} y1={y} x2={r - pad} y2={y} {...line} opacity={0.7} />;
          })}
        </>
      );
    }
    // Wall-mounted shapes are only a few centimetres deep, so their marks are drawn from
    // a padding that can never eat the whole rectangle.
    case 'picture':
    case 'mirror': {
      const fp = Math.max(0.6, Math.min(pad, w * 0.22, h * 0.22));
      return (
        <>
          <rect x={l + fp} y={t + fp} width={w - fp * 2} height={h - fp * 2} fill="none" stroke={color} strokeWidth={Math.min(sw, 1.2)} />
          {shape === 'mirror' && <line x1={l + fp} y1={b - fp} x2={r - fp} y2={t + fp} stroke={color} strokeWidth={Math.min(sw, 1)} opacity={0.6} />}
        </>
      );
    }
    case 'curtain': {
      const amp = Math.max(0.8, Math.min(h * 0.3, 3));
      const folds = Math.max(3, Math.round(w / 25));
      const step = w / folds;
      const d = Array.from({ length: folds }, (_, i) => `q ${step / 4} ${i % 2 ? amp : -amp} ${step / 2} 0 q ${step / 4} ${i % 2 ? -amp : amp} ${step / 2} 0`).join(' ');
      return <path d={`M ${l} ${cy} ${d}`} fill="none" stroke={color} strokeWidth={Math.min(sw, 1.4)} strokeLinecap="round" />;
    }
    case 'hooks': {
      const rr = Math.max(0.8, Math.min(h * 0.22, w * 0.05));
      return <>{[0.25, 0.5, 0.75].map((f) => <circle key={f} cx={l + w * f} cy={cy} r={rr} fill={color} />)}</>;
    }
    case 'wallshelf':
      return <line x1={l + Math.min(pad, w * 0.08)} y1={cy} x2={r - Math.min(pad, w * 0.08)} y2={cy} stroke={color} strokeWidth={Math.min(sw, 1.4)} strokeLinecap="round" />;
    case 'box':
      return null;
  }
}

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
