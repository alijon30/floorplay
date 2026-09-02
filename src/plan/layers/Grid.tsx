// src/plan/layers/Grid.tsx
import type { ReactElement } from 'react';
import { GRID_FINE, GRID_MAJOR } from '../tokens';

/**
 * Two weights of rule: 10 cm everywhere, 100 cm over the top.
 *
 * The fine grid is dropped once a metre falls below about 20 px on screen, where it would
 * turn into a flat tint rather than a grid — `u` is centimetres per screen pixel, so the
 * test is a plain comparison rather than a guess about zoom.
 */
export default function Grid({ width, depth, u }: { width: number; depth: number; u: number }) {
  const lines: ReactElement[] = [];
  const fine = 100 / u > 24;
  if (fine) {
    for (let x = 10; x < width; x += 10) if (x % 100 !== 0) lines.push(<line key={`fv${x}`} x1={x} y1={0} x2={x} y2={depth} stroke={GRID_FINE} strokeWidth={1} vectorEffect="non-scaling-stroke" />);
    for (let y = 10; y < depth; y += 10) if (y % 100 !== 0) lines.push(<line key={`fh${y}`} x1={0} y1={y} x2={width} y2={y} stroke={GRID_FINE} strokeWidth={1} vectorEffect="non-scaling-stroke" />);
  }
  for (let x = 0; x <= width; x += 100) lines.push(<line key={`mv${x}`} x1={x} y1={0} x2={x} y2={depth} stroke={GRID_MAJOR} strokeWidth={1} vectorEffect="non-scaling-stroke" />);
  for (let y = 0; y <= depth; y += 100) lines.push(<line key={`mh${y}`} x1={0} y1={y} x2={width} y2={y} stroke={GRID_MAJOR} strokeWidth={1} vectorEffect="non-scaling-stroke" />);
  return <g pointerEvents="none">{lines}</g>;
}
