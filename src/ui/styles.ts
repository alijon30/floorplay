// src/ui/styles.ts
/**
 * The handful of class strings every panel and control in the app is built from.
 *
 * One card, one button, one input, one section label. Holding them here is what keeps the
 * top bar, the rail, the drawer and the popovers looking like one program rather than four:
 * a change to the hover colour happens once, and every control follows.
 *
 * Written as whole literals on purpose — Tailwind scans this file, so a class assembled from
 * fragments at runtime would never be generated.
 */

/** Every panel that floats above the plan: rail cards, popovers, dialogs. */
export const CARD = 'rounded-lg border border-neutral-800 bg-neutral-900/95';

/** The row inside a card: an item in a list, an issue, a swatch group. */
export const ROW = 'rounded-md border border-neutral-800';

/** A section heading inside a card. */
export const LABEL = 'text-[10px] uppercase tracking-wide text-neutral-500';

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500';

/** The default button: 32 px tall, bordered, emerald on hover. */
export const BTN =
  'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-neutral-700 px-2.5 text-xs text-neutral-200 transition-colors hover:border-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-40 disabled:hover:border-neutral-700';

/** The same button while its panel is open or its mode is on. */
export const BTN_ON =
  'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-emerald-500 px-2.5 text-xs text-emerald-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500';

/** A square button carrying only an icon. */
export const ICON_BTN =
  'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-neutral-700 text-neutral-300 transition-colors hover:border-emerald-500 hover:text-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-40 disabled:hover:border-neutral-700';

/** The same, lit. */
export const ICON_BTN_ON =
  'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-emerald-500 text-emerald-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500';

/** The action a card is really for: Apply, Accept, Place. */
export const BTN_PRIMARY =
  'inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md bg-emerald-700 px-2.5 text-xs text-white transition-colors hover:bg-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-700';

/** A quieter action beside it: Reject, Lock, Select. */
export const BTN_QUIET =
  'inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md bg-neutral-800 px-2.5 text-xs text-neutral-200 transition-colors hover:bg-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-40 disabled:hover:bg-neutral-800';

/** A destructive one: Remove. */
export const BTN_DANGER =
  'inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md bg-red-900 px-2.5 text-xs text-red-100 transition-colors hover:bg-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-40 disabled:hover:bg-red-900';

/** Half-height variants for the buttons packed inside a rail card's rows. */
export const BTN_SM = 'inline-flex h-6 shrink-0 items-center justify-center gap-1 rounded bg-neutral-800 px-2 text-[11px] text-neutral-200 transition-colors hover:bg-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-40 disabled:hover:bg-neutral-800';
export const BTN_SM_ON = 'inline-flex h-6 shrink-0 items-center justify-center gap-1 rounded bg-emerald-700 px-2 text-[11px] text-white transition-colors hover:bg-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-40';

/** A text field or select. */
export const INPUT =
  'h-8 rounded-md border border-neutral-700 bg-neutral-800 px-2 text-xs text-neutral-100 outline-none transition-colors hover:border-neutral-600 focus-visible:ring-2 focus-visible:ring-emerald-500';

/** The link-weight buttons at the foot of a card. */
export const LINK = 'rounded text-[11px] text-emerald-400 transition-colors hover:text-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500';

/** The × that closes a card or popover. */
export const CLOSE = 'rounded text-neutral-400 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500';

export { FOCUS };
