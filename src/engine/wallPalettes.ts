// src/engine/wallPalettes.ts

/** One named paint. The name is the point: nobody asks for `#b7410e`, they ask for Venetian red. */
export interface WallSwatch { name: string; hex: string }

export interface WallPalette {
  /** Stable key, used by the tools and as a React key. */
  key: string;
  /** What a person would call the region: "Japan", "Middle East". */
  region: string;
  /** One line on where the palette comes from, shown under the chips. */
  note: string;
  /** Exactly six colours, every one usable as a whole wall. */
  swatches: WallSwatch[];
}

/**
 * Eleven regional wall palettes, six colours each.
 *
 * Every hex is chosen to work as a *wall*, not as an accent: nothing here is pure black, pure
 * white or fully saturated, because a wall is the largest surface in the room and a neon or a
 * void behind the furniture reads as a bug rather than a decision. The darkest entries (sumi,
 * ink, Prussian blue, lapis) sit around 20 to 30 percent lightness, which is as deep as a
 * painted wall goes before the room stops being a room.
 *
 * The order is the order the chips appear in, and it is deliberate: East Asia, then Europe and
 * its colonial offshoot, then the Mediterranean and North Africa, then the rest.
 */
export const WALL_PALETTES: WallPalette[] = [
  {
    key: 'japan',
    region: 'Japan',
    note: 'Shoji paper, indigo dye and ink — quiet grounds with one deep note.',
    swatches: [
      { name: 'Shoji white', hex: '#f2efe6' },
      { name: 'Kinari', hex: '#e3d9c6' },
      { name: 'Aizome indigo', hex: '#3b4f6b' },
      { name: 'Matcha', hex: '#a8b48a' },
      { name: 'Sumi', hex: '#3a3a38' },
      { name: 'Sakura', hex: '#f0d5d5' },
    ],
  },
  {
    key: 'china',
    region: 'China',
    note: 'Lacquer and porcelain: vermilion and imperial yellow against jade and ink.',
    swatches: [
      { name: 'Vermilion', hex: '#c0453a' },
      { name: 'Imperial yellow', hex: '#dcb04a' },
      { name: 'Jade', hex: '#8fb5a3' },
      { name: 'Porcelain blue', hex: '#b6c8dc' },
      { name: 'Lacquer red', hex: '#8f3b34' },
      { name: 'Ink', hex: '#33383c' },
    ],
  },
  {
    key: 'europe',
    region: 'Europe',
    note: 'Georgian and Nordic-European joinery colours, mixed with white lead and earth.',
    swatches: [
      { name: 'Georgian sage', hex: '#b9c2ab' },
      { name: 'French grey', hex: '#c3c6c0' },
      { name: 'Wedgwood blue', hex: '#a8bcc9' },
      { name: 'Parchment', hex: '#ece3d0' },
      { name: 'Prussian blue', hex: '#33495c' },
      { name: 'Olive', hex: '#8a8a5e' },
    ],
  },
  {
    key: 'american',
    region: 'American',
    note: 'Colonial and farmhouse: milk paint, barn red and a deep navy for the parlour.',
    swatches: [
      { name: 'Colonial cream', hex: '#efe4cb' },
      { name: 'Navy', hex: '#33415a' },
      { name: 'Barn red', hex: '#963f38' },
      { name: 'Slate', hex: '#6f7c86' },
      { name: 'Farmhouse white', hex: '#f4f1ea' },
      { name: 'Sage', hex: '#adbaa4' },
    ],
  },
  {
    key: 'italy',
    region: 'Italy',
    note: 'Roman and Tuscan earths, dug and burnt: ochre, sienna, Pompeian red.',
    swatches: [
      { name: 'Terracotta', hex: '#c37a5b' },
      { name: 'Tuscan ochre', hex: '#d8a760' },
      { name: 'Venetian red', hex: '#a94f42' },
      { name: 'Olive', hex: '#8d8f60' },
      { name: 'Sienna', hex: '#a06a45' },
      { name: 'Pompeian red', hex: '#93382f' },
    ],
  },
  {
    key: 'egypt',
    region: 'Egypt',
    note: 'Tomb painting and the river: lapis and faience against sandstone and papyrus.',
    swatches: [
      { name: 'Nile blue', hex: '#4a7f96' },
      { name: 'Sandstone', hex: '#dcc39a' },
      { name: 'Lapis', hex: '#2f4c85' },
      { name: 'Papyrus', hex: '#e8dcbd' },
      { name: 'Gold ochre', hex: '#c9973f' },
      { name: 'Faience turquoise', hex: '#5fa8a4' },
    ],
  },
  {
    key: 'middle-east',
    region: 'Middle East',
    note: 'Majorelle blue, saffron and polished tadelakt plaster.',
    swatches: [
      { name: 'Majorelle blue', hex: '#4059a8' },
      { name: 'Saffron', hex: '#d99b3d' },
      { name: 'Date brown', hex: '#7a5643' },
      { name: 'Tadelakt rose', hex: '#e0bfae' },
      { name: 'Mint', hex: '#a9cbbc' },
      { name: 'Ivory', hex: '#f0e8da' },
    ],
  },
  {
    key: 'scandinavia',
    region: 'Scandinavia',
    note: 'Long winters, short light: chalk grounds with Falu red and fjord blue.',
    swatches: [
      { name: 'Chalk white', hex: '#f3f1ec' },
      { name: 'Falu red', hex: '#8c463c' },
      { name: 'Fjord blue', hex: '#7d97ab' },
      { name: 'Birch', hex: '#e6dcc8' },
      { name: 'Lichen', hex: '#b3bda8' },
      { name: 'Nordic slate', hex: '#5d666e' },
    ],
  },
  {
    key: 'morocco',
    region: 'Morocco',
    note: 'Marrakech walls: rose plaster, mint tile, spice and a deep zellige blue.',
    swatches: [
      { name: 'Marrakech rose', hex: '#c5765f' },
      { name: 'Mint tile', hex: '#9fc4b4' },
      { name: 'Zellige blue', hex: '#3a6b8f' },
      { name: 'Argan', hex: '#c9a05e' },
      { name: 'Henna', hex: '#8e5340' },
      { name: 'Kasbah sand', hex: '#e5d2b6' },
    ],
  },
  {
    key: 'india',
    region: 'India',
    note: 'Jaipur pink, turmeric and peacock, tempered by chuna lime wash.',
    swatches: [
      { name: 'Jaipur pink', hex: '#cf7d84' },
      { name: 'Turmeric', hex: '#d9a13c' },
      { name: 'Peacock', hex: '#2f7f86' },
      { name: 'Marigold', hex: '#dd9142' },
      { name: 'Indigo', hex: '#3c4a77' },
      { name: 'Chuna lime', hex: '#efe6d6' },
    ],
  },
  {
    key: 'mexico',
    region: 'Mexico',
    note: 'Barragán walls: rosa mexicano and cobalt beside adobe and cactus.',
    swatches: [
      { name: 'Rosa mexicano', hex: '#c4576b' },
      { name: 'Cobalt', hex: '#3d63a8' },
      { name: 'Adobe', hex: '#cf8f68' },
      { name: 'Cactus', hex: '#7f9d70' },
      { name: 'Talavera cream', hex: '#f0e3cb' },
      { name: 'Oaxaca clay', hex: '#a2543c' },
    ],
  },
];

/** One palette by key, or undefined. */
export function findWallPalette(key: string): WallPalette | undefined {
  return WALL_PALETTES.find((p) => p.key === key);
}
