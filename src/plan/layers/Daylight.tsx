// src/plan/layers/Daylight.tsx
import { useMemo } from 'react';
import type { Daylight as DaylightData } from '../../engine/types';
import { CELL } from '../../engine/types';
import { SUNLIGHT } from '../tokens';

/** Nothing under this much light is drawn at all; below it the wash reads as dirt. */
const FLOOR = 0.18;
/** The most opaque the wash ever gets, over the brightest cell in the room. */
const CEILING = 0.18;

/**
 * Daylight as one soft wash rather than a grid of squares.
 *
 * The engine's 10 cm grid is painted into an off-screen canvas one pixel per cell and handed
 * to a single `<image>`, which the browser scales up with its own smoothing. What lands on
 * the plan is a gradient the shape of the light coming through the windows, and one element
 * instead of two thousand.
 */
export default function Daylight({ d }: { d: DaylightData }) {
  const href = useMemo(() => {
    if (typeof document === 'undefined' || d.cols < 1 || d.rows < 1) return null;
    const canvas = document.createElement('canvas');
    canvas.width = d.cols;
    canvas.height = d.rows;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const img = ctx.createImageData(d.cols, d.rows);
    for (let i = 0; i < d.grid.length; i++) {
      const v = d.grid[i]!;
      const a = v <= FLOOR ? 0 : Math.min(CEILING, (v - FLOOR) * 0.42);
      img.data[i * 4] = SUNLIGHT.r;
      img.data[i * 4 + 1] = SUNLIGHT.g;
      img.data[i * 4 + 2] = SUNLIGHT.b;
      img.data[i * 4 + 3] = Math.round(a * 255);
    }
    ctx.putImageData(img, 0, 0);
    return canvas.toDataURL();
  }, [d]);
  if (!href) return null;
  return (
    <image
      href={href}
      x={0}
      y={0}
      width={d.cols * CELL}
      height={d.rows * CELL}
      preserveAspectRatio="none"
      pointerEvents="none"
    />
  );
}
