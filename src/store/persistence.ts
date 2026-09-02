// src/store/persistence.ts
import type { PersistStorage, StateStorage, StorageValue } from 'zustand/middleware';

/**
 * Wraps a raw `StateStorage` in a debounced `PersistStorage`.
 *
 * Implementing `PersistStorage` rather than handing zustand a `createJSONStorage`
 * wrapper is the point: zustand calls `storage.setItem` on every `set`, so with a
 * string-based storage every camera nudge or hover would `JSON.stringify` every room
 * and its ledger. Here `setItem` only parks the latest value, and the stringify happens
 * once per flush.
 */
export function createDebouncedStorage(
  base: StateStorage,
  opts: { delayMs: number; onError: (e: unknown) => void },
): PersistStorage<unknown> & { flush(): void } {
  let pending: { name: string; value: StorageValue<unknown> } | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const clear = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const flush = (): void => {
    const next = pending;
    pending = null;
    clear();
    if (!next) return;
    try {
      base.setItem(next.name, JSON.stringify(next.value));
    } catch (e) {
      opts.onError(e);
    }
  };

  // Debounced writes would otherwise lose the last edits when the tab goes away.
  if (typeof window !== 'undefined') window.addEventListener('pagehide', flush);

  return {
    getItem(name) {
      try {
        const raw = base.getItem(name);
        // Async storages are not supported; a non-string means "nothing usable here".
        if (typeof raw !== 'string') return null;
        return JSON.parse(raw) as StorageValue<unknown>;
      } catch (e) {
        opts.onError(e);
        return null;
      }
    },
    setItem(name, value) {
      pending = { name, value };
      clear();
      timer = setTimeout(flush, opts.delayMs);
    },
    removeItem(name) {
      pending = null;
      clear();
      try {
        base.removeItem(name);
      } catch (e) {
        opts.onError(e);
      }
    },
    flush,
  };
}
