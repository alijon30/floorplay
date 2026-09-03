// src/ui/Viewport.tsx
import type { ReactNode } from 'react';

/**
 * The frame both viewports share: a name at the top left, its own tools at the top right,
 * and the drawing or the render filling everything underneath.
 *
 * Both are overlays rather than a bar above the content, so neither viewport loses height to
 * its own chrome and the two stay the same size beside each other.
 */
export default function Viewport({
  label, toolbar, children, tone = 'dark',
}: {
  label: string; toolbar?: ReactNode; children: ReactNode; tone?: 'dark' | 'light';
}) {
  const text = tone === 'light' ? 'text-[var(--plan-dim)]' : 'text-muted';
  return (
    <section aria-label={label} className="@container relative h-full w-full overflow-hidden">
      {children}
      <span
        className={`pointer-events-none absolute left-3 top-2.5 select-none text-[10.5px] font-medium uppercase tracking-[0.12em] ${text}`}
      >{label}</span>
      {toolbar && <div className="absolute right-2.5 top-2 flex items-center gap-1.5">{toolbar}</div>}
    </section>
  );
}
