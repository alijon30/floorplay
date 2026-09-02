// src/ui/SplitPane.tsx
import { useRef, useState, type ReactNode } from 'react';

/**
 * Two viewports and the line between them.
 *
 * The line is one pixel of `--line` with a six-pixel grab area either side, so it reads as a
 * seam and still catches the cursor. Double-clicking runs through maximise-one, maximise-the-
 * other, back to even.
 */
export default function SplitPane({ left, right }: { left: ReactNode; right: ReactNode }) {
  const [split, setSplit] = useState(0.56);
  const [dragging, setDragging] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const onDown = (e: React.PointerEvent) => {
    e.preventDefault();
    const el = ref.current!;
    setDragging(true);
    const move = (ev: PointerEvent) => {
      const r = el.getBoundingClientRect();
      setSplit(Math.min(0.85, Math.max(0.15, (ev.clientX - r.left) / r.width)));
    };
    const up = () => {
      setDragging(false);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  return (
    <div ref={ref} className="flex h-full min-h-0">
      <div className="min-w-0" style={{ flexBasis: `${split * 100}%` }}>{left}</div>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize the viewports"
        className="group relative w-px shrink-0 cursor-col-resize bg-line"
        onPointerDown={onDown}
        onDoubleClick={() => setSplit((v) => (v > 0.8 ? 0.15 : v < 0.2 ? 0.56 : 0.85))}
        title="Drag to resize, double-click to maximise"
      >
        <span aria-hidden="true" className="absolute inset-y-0 -left-[5px] -right-[5px]" />
        <span aria-hidden="true" className={`absolute inset-y-0 -left-px -right-px transition-colors ${dragging ? 'bg-accent' : 'group-hover:bg-accent/60'}`} />
      </div>
      <div className="min-w-0 flex-1">{right}</div>
    </div>
  );
}
