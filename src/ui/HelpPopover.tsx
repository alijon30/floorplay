// src/ui/HelpPopover.tsx
import { useEffect, type RefObject } from 'react';
import { WEBMCP_FLAG_URL } from '../config';
import { Icon } from './icons';
import { CARD, CLOSE, LABEL, TITLE } from './styles';

const SHORTCUTS: [string, string][] = [
  ['Drag', 'Move an item on the plan. It snaps to walls and to the nearest 5 cm.'],
  ['Wheel', 'Zoom the plan. Fit to view puts the whole room back on screen.'],
  ['R', 'Rotate the selected item by 90°.'],
  ['L', 'Lock or unlock the selected item so nothing can move it.'],
  ['Delete', 'Remove the selected item (Backspace works too).'],
  ['Esc', 'Close whatever is open — a dialog, this sheet, a menu — or clear the selection.'],
  ['⌘/Ctrl Z', 'Undo the last change, yours or the agent’s.'],
  ['⌘/Ctrl ⇧ D', 'Show the developer panel with the raw tool log.'],
];

/**
 * Help sheet beside the rail's "?" button. `anchorRef` wraps both the button and this panel,
 * so clicking the button toggles it instead of racing the outside-click close.
 */
export default function HelpPopover({ onClose, anchorRef, position = 'right-0 mt-1' }: { onClose: () => void; anchorRef: RefObject<HTMLElement | null>; position?: string }) {
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
    <div role="dialog" aria-label="Help" className={`absolute z-40 w-[340px] p-3 ${position} ${CARD}`}>
      <div className="mb-2.5 flex items-center justify-between">
        <strong className={TITLE}>Keyboard and mouse</strong>
        <button className={CLOSE} onClick={onClose} aria-label="Close"><Icon name="close" size={13} /></button>
      </div>
      <dl className="space-y-1">
        {SHORTCUTS.map(([key, what]) => (
          <div key={key} className="flex gap-2.5">
            <dt className="w-[76px] shrink-0 rounded border border-line bg-raised px-1 py-0.5 text-center font-mono text-[10.5px] text-fg">{key}</dt>
            <dd className="flex-1 text-[11.5px] leading-snug text-muted">{what}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-[11px] text-muted">Click the plan first so it has keyboard focus.</p>

      <strong className={`mt-3.5 block ${LABEL}`}>The agent readout</strong>
      <p className="mt-1 text-[11.5px] leading-snug text-muted">
        The dot in the top right says whether a WebMCP agent is connected and how many tools this page offers it.
        Hover it to see which tool it called last. Grey means no agent is listening; the plan still works on its own.
      </p>

      <strong className={`mt-3 block ${LABEL}`}>Connecting an agent</strong>
      <p className="mt-1 text-[11.5px] leading-snug text-muted">
        Open this page in your agent&apos;s browser (ChatGPT&apos;s today), or in Chrome with WebMCP turned on at{' '}
        <code className="rounded bg-raised px-1 font-mono text-[10.5px] text-accent">{WEBMCP_FLAG_URL}</code>, then reload.
      </p>
    </div>
  );
}
