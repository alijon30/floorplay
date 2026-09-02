// src/plan/glyphs.tsx
import type { Shape } from '../engine/types';

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

/** `#rrggbb` mixed toward white by `amount`. */
function lighten(hex: string, amount: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = Number.parseInt(m[1]!, 16);
  const channel = (shift: number) => {
    const v = (n >> shift) & 0xff;
    return Math.round(v + (255 - v) * amount).toString(16).padStart(2, '0');
  };
  return `#${channel(16)}${channel(8)}${channel(0)}`;
}

/** Rough perceived brightness, 0 to 1. Unparseable colours are treated as mid-grey. */
function luminance(hex: string): number {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 0.5;
  const n = Number.parseInt(m[1]!, 16);
  return (0.299 * ((n >> 16) & 0xff) + 0.587 * ((n >> 8) & 0xff) + 0.114 * (n & 0xff)) / 255;
}

/**
 * A small mark that says what the rectangle is without a legend. Drawn in the item's own
 * frame — `w` across, `h` deep, front edge at `+y` — and rotated into place by the caller.
 *
 * Everything is sized from `w` and `h` rather than from centimetres, so the same component
 * draws a 200 cm bed on the plan and a 28 px bed in the catalog and both read correctly.
 */
export function Glyph({ shape, cx, cy, w, h, color }: { shape: Shape; cx: number; cy: number; w: number; h: number; color: string }) {
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

/**
 * One catalog item as a standalone thumbnail: its own colour, its own proportions, and the
 * very same mark the plan draws for it. The list stops being twenty grey rows and starts
 * being furniture you can pick out at a glance.
 *
 * `w` and `h` are the item's real centimetres; the box keeps their ratio inside `size`.
 */
export function ItemGlyph({ shape, color, w, h, size = 28 }: { shape: Shape; color: string; w: number; h: number; size?: number }) {
  const scale = size / Math.max(w, h, 1);
  // Wall-mounted pieces are a few centimetres deep, which would scale to a hairline; a floor
  // of 6 px keeps the mark inside something the eye can still read as a rectangle.
  const gw = Math.max(6, Math.min(size, Math.round(w * scale)));
  const gh = Math.max(6, Math.min(size, Math.round(h * scale)));
  // On the plan a dark piece is a large shape on a pale floor, so a darker mark reads. At
  // 28 px against a dark panel it would not, so the mark turns and goes lighter instead.
  const ink = luminance(color) < 0.4 ? lighten(color, 0.5) : darken(color);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" focusable="false" className="shrink-0">
      {/* A tile behind every thumbnail: it fixes the footprint at one size, and gives the
          darkest pieces in the catalog something to stand against. */}
      <rect x={0} y={0} width={size} height={size} rx={4} style={{ fill: 'var(--bg)' }} />
      <rect
        x={(size - gw) / 2} y={(size - gh) / 2} width={gw} height={gh} rx={2}
        fill={color} stroke={ink} strokeWidth={1}
      />
      <Glyph shape={shape} cx={size / 2} cy={size / 2} w={gw} h={gh} color={ink} />
    </svg>
  );
}
