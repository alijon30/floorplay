// src/ui/styles.ts
/**
 * The class strings every panel and control in the app is built from.
 *
 * One card, one button, one input, one section label. Holding them here is what keeps the
 * top bar, the rail, the catalog and the popovers looking like one program rather than four:
 * a change to the focus ring happens once, and every control follows.
 *
 * Written as whole literals on purpose — Tailwind scans this file, so a class assembled from
 * fragments at runtime would never be generated.
 */

/** Focus is always the accent, always a ring, never an outline. */
export const FOCUS = 'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent';

/** A flat panel: the tool rail's fly-outs, the properties column, the catalog. */
export const PANEL = 'border border-line bg-panel';

/** Anything that floats over the work: popovers, proposal cards, dialogs. */
export const CARD = 'rounded-lg border border-line bg-panel shadow-xl';

/** A row inside a panel: a catalog entry, an issue, a palette. */
export const ROW = 'rounded-md border border-line bg-raised';

/** A section heading inside a panel. */
export const LABEL = 'text-[10.5px] font-medium uppercase tracking-[0.08em] text-muted';

/** Numbers, dimensions and prices. Tabular so columns of them never jitter. */
export const NUM = 'font-mono tabular-nums';

/** The panel title at the head of a column or a popover. */
export const TITLE = 'text-[13px] font-medium text-fg';

const BASE = `inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md px-2.5 text-[12.5px] transition-colors ${FOCUS} disabled:opacity-40 disabled:pointer-events-none`;

/** The default button: a quiet outline that lifts on hover. */
export const BTN = `${BASE} border border-line bg-raised text-fg hover:border-[#33333a] hover:bg-[#232329]`;

/** The same button while its panel is open or its mode is on. */
export const BTN_ON = `${BASE} border border-accent/60 bg-accent/12 text-accent`;

/** The action a card is really for: Apply, Accept, Place, Create. */
export const BTN_PRIMARY = `${BASE} bg-accent font-medium text-[#0b1020] hover:bg-[#729dff] disabled:bg-raised disabled:text-muted disabled:opacity-100`;

/** A quieter action beside it: Reject, Lock, Select, Cancel. */
export const BTN_QUIET = `${BASE} border border-transparent bg-raised text-fg hover:bg-[#232329]`;

/** A destructive one: Remove. Ghost, never filled — it should not read as the main action. */
export const BTN_DANGER = `${BASE} border border-transparent bg-raised text-bad hover:bg-bad/12`;

const SMALL = `inline-flex h-6 shrink-0 items-center justify-center gap-1 rounded px-1.5 text-[11px] transition-colors ${FOCUS} disabled:opacity-40 disabled:pointer-events-none`;

/** Half-height variants, for the chips and buttons packed inside a panel's rows. */
export const BTN_SM = `${SMALL} border border-line bg-raised text-muted hover:text-fg hover:border-[#33333a]`;
export const BTN_SM_ON = `${SMALL} border border-accent/60 bg-accent/12 text-accent`;

/** A square button carrying only an icon. */
export const ICON_BTN = `inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-raised hover:text-fg ${FOCUS} disabled:opacity-30 disabled:pointer-events-none`;

/** The same, lit. */
export const ICON_BTN_ON = `inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent/12 text-accent transition-colors ${FOCUS} disabled:opacity-30`;

/** A text field, number field or select. */
export const INPUT = `h-8 w-full min-w-0 rounded-md border border-line bg-raised px-2 text-[12.5px] text-fg outline-none transition-colors placeholder:text-muted hover:border-[#33333a] focus:border-accent/70 ${FOCUS}`;

/** The link-weight buttons at the foot of a panel. */
export const LINK = `rounded text-[11.5px] text-accent transition-colors hover:text-[#8fb0ff] ${FOCUS}`;

/** The × that closes a card or popover. */
export const CLOSE = `inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted transition-colors hover:bg-raised hover:text-fg ${FOCUS}`;

/** One cell of a segmented control. `SEG` wraps them; `SEG_ITEM`/`SEG_ITEM_ON` are the cells. */
export const SEG = 'inline-flex h-7 shrink-0 items-center gap-px rounded-md border border-line bg-raised p-px';
export const SEG_ITEM = `inline-flex h-[22px] shrink-0 items-center justify-center rounded-[4px] px-2 text-[11px] text-muted transition-colors hover:text-fg ${FOCUS}`;
export const SEG_ITEM_ON = `inline-flex h-[22px] shrink-0 items-center justify-center rounded-[4px] bg-accent/15 px-2 text-[11px] font-medium text-accent transition-colors ${FOCUS}`;
