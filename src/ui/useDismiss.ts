// src/ui/useDismiss.ts
import { useEffect, type RefObject } from 'react';

/**
 * The two gestures that close every menu in the app: Escape, and a press outside it.
 *
 * Held in one place because a popover that only shuts when you pick something from it is a
 * trap, and four copies of that rule is four chances to leave one out. `anchor` wraps both the
 * button and the panel, so pressing the button again closes it through its own handler rather
 * than being counted as an outside press.
 */
export function useDismiss(open: boolean, anchor: RefObject<HTMLElement | null>, close: () => void): void {
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const el = anchor.current;
      if (el && !el.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, anchor, close]);
}
