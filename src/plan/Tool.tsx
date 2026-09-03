// src/plan/Tool.tsx
import { Icon } from '../ui/icons';

/**
 * One of a plan viewport's own tools.
 *
 * `text` is the word beside the mark. It appears once the viewport itself is 600 px wide —
 * a window past about 1280 px with the side panels shut — because below that the toolbar and
 * the drawing compete for the same width and the drawing wins. On a wide screen there is no
 * reason to make anyone learn four pictograms. Measured on the viewport rather than the
 * window, so opening the catalog puts the tools back to marks instead of over the label.
 *
 * Shared by the room plan and the home plan, so the two toolbars are the same row of controls
 * with different things on it rather than two things that merely look alike.
 */
export default function Tool({ on, label, hint, text, icon, onClick, disabled, expanded }: {
  on?: boolean;
  label: string;
  hint?: string;
  text?: string;
  icon: Parameters<typeof Icon>[0]['name'];
  onClick: () => void;
  disabled?: boolean;
  /** Set when the tool opens a menu, so the button says whether it is open. */
  expanded?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={on === undefined ? undefined : on}
      aria-expanded={expanded}
      title={hint ?? label}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-7 min-w-7 items-center justify-center gap-1.5 rounded-md border px-1.5 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent disabled:opacity-40 disabled:pointer-events-none ${
        on ? 'border-accent/50 bg-[var(--accent-fill)] text-accent' : 'border-black/8 bg-white/70 text-[var(--plan-ink-soft)] hover:bg-white hover:text-[var(--plan-ink)]'
      }`}
    >
      <Icon name={icon} />
      {text && <span className="hidden pr-0.5 text-[11.5px] @[600px]:inline">{text}</span>}
    </button>
  );
}

/** The card a plan toolbar's menus drop into: paper, not panel, because it sits on the drawing. */
export const PLAN_MENU = 'absolute right-0 top-[calc(100%+6px)] z-30 rounded-lg border border-black/10 bg-white p-1.5 shadow-xl';

/** One line in such a menu. */
export const PLAN_MENU_ITEM = 'flex w-full items-baseline gap-2 rounded-md px-2 py-1.5 text-left text-[12px] text-[var(--plan-ink)] transition-colors hover:bg-black/[0.06] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent';

/** A heading over a group of them. */
export const PLAN_MENU_LABEL = 'px-2 pb-1 pt-1.5 text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--plan-dim)]';
