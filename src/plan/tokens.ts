// src/plan/tokens.ts
/**
 * The plan is the one light surface in a dark program, and it is a drawing rather than a
 * screen: paper, two weights of grid, one ink, one accent.
 *
 * Held apart from the interface palette in `index.css` on purpose. The panels around the plan
 * can be restyled without touching the drawing, and the drawing keeps the contrast a printed
 * sheet has.
 */
export const PAPER = '#f7f5f0';
/** 10 cm rules, drawn everywhere; and the 100 cm rules over them. */
export const GRID_FINE = '#ebe8e1';
export const GRID_MAJOR = '#dad6cd';
/** Walls, door leaves, swing arcs. The darkest thing on the sheet. */
export const INK = '#2b2b31';
/** Furniture outlines, glyphs and labels: a step back from the walls. */
export const INK_SOFT = '#4a4a52';
/** Dimension lines, ticks and their numbers. */
export const INK_DIM = '#6b6b74';
/** Selection, windows, ghosts. The same accent the interface uses. */
export const ACCENT = '#5b8cff';
/** Violations. */
export const BAD = '#d1544c';
/** Daylight, as a wash rather than a colour anyone reads a value from. */
export const SUNLIGHT = { r: 244, g: 186, b: 74 };
/** Furniture fill is the item's own colour at this alpha, so the drawing stays a drawing. */
export const ITEM_FILL_ALPHA = 0.22;
