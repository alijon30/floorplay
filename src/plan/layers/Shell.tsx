// src/plan/layers/Shell.tsx
export default function Shell({ width, depth }: { width: number; depth: number }) {
  return (
    <g pointerEvents="none">
      <rect x={-10} y={-10} width={width + 20} height={depth + 20} fill="none" stroke="#e5e5e5" strokeWidth={10} />
      <text x={width / 2} y={-18} fill="#a3a3a3" fontSize={12} textAnchor="middle">{width} cm</text>
      <text x={-18} y={depth / 2} fill="#a3a3a3" fontSize={12} textAnchor="middle" transform={`rotate(-90 -18 ${depth / 2})`}>{depth} cm</text>
    </g>
  );
}
