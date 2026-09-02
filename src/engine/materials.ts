// src/engine/materials.ts
/**
 * The finishes real furniture is actually made of.
 *
 * Everything in the catalog is painted from this list rather than from a free hex, which is
 * what lets the 3D view answer a colour with a *material*: a hex that names oak gets wood
 * grain and a matte sheen, one that names brass gets metalness, one that names linen gets a
 * woven weave. Two rooms built from the same twenty-two finishes read as one showroom instead
 * of a bag of primaries.
 *
 * The classification runs on the hex rather than on a stored name so that a recolor, a palette
 * suggestion or an agent's `set_item_color` — none of which carry a finish name — still land on
 * the right material. It is nearest-neighbour, so a blended colour (a duvet mixed toward white,
 * a door panel mixed toward black) is treated as whatever finish it sits closest to.
 */

export type MaterialType = 'wood' | 'fabric' | 'metal' | 'surface' | 'leaf';

export interface Finish {
  /** The hex the catalog and the 3D view both use. */
  hex: string;
  /** How the surface behaves under light. */
  type: MaterialType;
  /** Shown to a person: the swatch title in the inspector. */
  label: string;
}

/**
 * Every finish, by name.
 *
 * Woods and fabrics carry the room; metals are hardware and lamp stems; surfaces are painted
 * carcasses, worktops and appliance shells; leaf is only ever a plant.
 */
export const MATERIALS = {
  // woods
  'oak': { hex: '#c8a878', type: 'wood', label: 'Oak' },
  'walnut': { hex: '#6b4a2f', type: 'wood', label: 'Walnut' },
  'ash': { hex: '#d9cdb5', type: 'wood', label: 'Ash' },
  'black-stain': { hex: '#2f2a26', type: 'wood', label: 'Black stain' },
  'white-oak': { hex: '#e3d3b6', type: 'wood', label: 'White oak' },
  // fabrics
  'linen': { hex: '#d8d0c2', type: 'fabric', label: 'Linen' },
  'charcoal': { hex: '#3b3b40', type: 'fabric', label: 'Charcoal' },
  'navy': { hex: '#2f3d5c', type: 'fabric', label: 'Navy' },
  'sage': { hex: '#8ea48a', type: 'fabric', label: 'Sage' },
  'terracotta': { hex: '#b8674a', type: 'fabric', label: 'Terracotta' },
  'mustard': { hex: '#c9a544', type: 'fabric', label: 'Mustard' },
  'blush': { hex: '#d9b8ad', type: 'fabric', label: 'Blush' },
  'forest': { hex: '#3f5d4a', type: 'fabric', label: 'Forest' },
  'stone': { hex: '#9a9a94', type: 'fabric', label: 'Stone' },
  // metals
  'black-metal': { hex: '#1f1f22', type: 'metal', label: 'Black metal' },
  'brass': { hex: '#b08d57', type: 'metal', label: 'Brass' },
  'steel': { hex: '#c9ccd1', type: 'metal', label: 'Steel' },
  // painted and mineral surfaces
  'white': { hex: '#f2efe9', type: 'surface', label: 'White' },
  'graphite': { hex: '#3a3a3f', type: 'surface', label: 'Graphite' },
  'concrete': { hex: '#b9b6b0', type: 'surface', label: 'Concrete' },
  // foliage
  'leaf': { hex: '#4c7a4a', type: 'leaf', label: 'Leaf' },
  'deep-leaf': { hex: '#315a3a', type: 'leaf', label: 'Deep leaf' },
} as const satisfies Record<string, Finish>;

export type FinishName = keyof typeof MATERIALS;

/** The hex of a named finish. The one way the catalog is allowed to write a colour. */
export function finish(name: FinishName): string {
  return MATERIALS[name].hex;
}

const ENTRIES: { rgb: [number, number, number]; type: MaterialType }[] = Object.values(MATERIALS).map((f) => ({
  rgb: rgbOf(f.hex)!,
  type: f.type,
}));

function rgbOf(hex: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const raw = m[1]!;
  const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw;
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
}

// One hex is asked about once per material per frame, so the answer is memoized rather than
// recomputed over twenty-two finishes every time a mesh renders.
const typeCache = new Map<string, MaterialType>();

/**
 * Which material a colour is made of: the type of the named finish nearest it in RGB.
 *
 * An exact catalog hex resolves to itself at distance zero. Anything else — a user's colour
 * picker, an agent's hex, a blend — lands on whichever finish it most resembles, so it is
 * still shaded as *something* real rather than as flat plastic. Unparseable input is treated
 * as a painted surface, the most neutral of the five.
 */
export function materialTypeOf(hex: string): MaterialType {
  const key = hex.trim().toLowerCase();
  const hit = typeCache.get(key);
  if (hit) return hit;
  const rgb = rgbOf(key);
  if (!rgb) return 'surface';
  let best: MaterialType = 'surface';
  let bestD = Infinity;
  for (const e of ENTRIES) {
    const dr = rgb[0] - e.rgb[0], dg = rgb[1] - e.rgb[1], db = rgb[2] - e.rgb[2];
    const d = dr * dr + dg * dg + db * db;
    if (d < bestD) { bestD = d; best = e.type; }
  }
  typeCache.set(key, best);
  return best;
}
