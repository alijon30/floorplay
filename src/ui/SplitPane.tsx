// src/ui/SplitPane.tsx
import { useRef, useState, type ReactNode } from 'react';

export default function SplitPane({ left, right }: { left: ReactNode; right: ReactNode }) {
  // The left pane is no longer only the plan: the catalog and the rail take their width from
  // it rather than covering it, so it starts wider than half.
  const [split, setSplit] = useState(0.62);
  const ref = useRef<HTMLDivElement>(null);
  const onDown = (e: React.PointerEvent) => {
    e.preventDefault();
    const el = ref.current!;
    const move = (ev: PointerEvent) => {
      const r = el.getBoundingClientRect();
      setSplit(Math.min(0.85, Math.max(0.15, (ev.clientX - r.left) / r.width)));
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  return (
    <div ref={ref} className="flex min-h-0 flex-1">
      <div className="min-w-0" style={{ flexBasis: `${split * 100}%` }}>{left}</div>
      <div className="w-1 cursor-col-resize bg-neutral-800 hover:bg-emerald-600" onPointerDown={onDown} onDoubleClick={() => setSplit((v) => (v > 0.8 ? 0.15 : v < 0.2 ? 0.55 : 0.85))} title="Drag to resize, double-click to maximize" />
      <div className="min-w-0 flex-1">{right}</div>
    </div>
  );
}
