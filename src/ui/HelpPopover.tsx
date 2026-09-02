// src/ui/HelpPopover.tsx
import { useEffect, type RefObject } from 'react';
import { WEBMCP_FLAG_URL } from '../config';
import { CARD, CLOSE } from './styles';

const SHORTCUTS: [string, string][] = [
  ['Drag', 'Move an item on the plan. It snaps to walls and to the nearest 5 cm.'],
  ['R', 'Rotate the selected item by 90°.'],
  ['L', 'Lock or unlock the selected item so nothing can move it.'],
  ['Delete', 'Remove the selected item (Backspace works too).'],
  ['Esc', 'Clear the selection.'],
  ['Cmd/Ctrl+Z', 'Undo the last change, yours or the agent’s.'],
  ['Cmd/Ctrl+Shift+D', 'Show the developer panel with the raw tool log.'],
];

/**
 * Help sheet under the top bar's "?" button. `anchorRef` wraps both the button and this
 * panel, so clicking the button toggles it instead of racing the outside-click close.
 */
export default function HelpPopover({ onClose, anchorRef }: { onClose: () => void; anchorRef: RefObject<HTMLElement | null> }) {
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const el = anchorRef.current;
      if (el && !el.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose, anchorRef]);

  return (
    <div role="dialog" aria-label="Help" className={`absolute right-0 z-30 mt-1 w-80 p-3 text-xs shadow-2xl ${CARD}`}>
      <div className="mb-2 flex items-center justify-between">
        <strong className="text-sm">Keyboard and mouse</strong>
        <button className={CLOSE} onClick={onClose} aria-label="Close">×</button>
      </div>
      <dl className="space-y-1">
        {SHORTCUTS.map(([key, what]) => (
          <div key={key} className="flex gap-2">
            <dt className="w-28 shrink-0 rounded border border-neutral-800 bg-neutral-800 px-1 py-0.5 text-center font-mono text-[11px] text-neutral-200">{key}</dt>
            <dd className="flex-1 text-neutral-400">{what}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-[11px] text-neutral-500">Click the plan first so it has keyboard focus.</p>

      <strong className="mt-3 block text-sm">The agent chip</strong>
      <p className="mt-1 text-neutral-400">
        The chip in the top right says whether a WebMCP agent is connected and how many tools this page offers it.
        Hover it to see which tool it called last. Grey means no agent is listening; the plan still works on its own.
      </p>

      <strong className="mt-3 block text-sm">Connecting an agent</strong>
      <p className="mt-1 text-neutral-400">
        Open this page in ChatGPT&apos;s browser, or in Chrome with WebMCP turned on at{' '}
        <code className="rounded bg-neutral-800 px-1 text-[11px] text-emerald-300">{WEBMCP_FLAG_URL}</code>, then reload.
      </p>
    </div>
  );
}
