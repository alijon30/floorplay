// src/ui/MetricChips.tsx
import { useRoom } from '../store';
import { findCatalogItem } from '../engine/catalog';

function Chip({ label, value, tone }: { label: string; value: string; tone: 'ok' | 'warn' | 'bad' }) {
  const color = tone === 'ok' ? 'border-neutral-700 text-neutral-200' : tone === 'warn' ? 'border-amber-500 text-amber-300' : 'border-red-500 text-red-300';
  return <div className={`rounded-full border px-3 py-1 text-xs ${color}`}><span className="text-neutral-500">{label} </span>{value}</div>;
}

export default function MetricChips() {
  const room = useRoom((s) => s.rooms[s.currentId]!);
  const m = useRoom((s) => s.analysis.metrics);
  const selected = useRoom((s) => s.ui.selectedItemId);
  const lightTarget = (selected && room.items.find((i) => i.id === selected)) ?? room.items.find((i) => findCatalogItem(room, i.catalogId)?.category === 'desk');
  const lightName = lightTarget ? findCatalogItem(room, lightTarget.catalogId)?.name ?? 'item' : 'desk';
  const light = lightTarget ? Math.round((m.lightByItem[lightTarget.id] ?? 0) * 100) : null;
  const budgetPct = room.brief.budget > 0 ? m.budgetUsed / room.brief.budget : 0;
  return (
    <div className="flex flex-wrap gap-2 border-b border-neutral-800 px-4 py-2">
      <Chip label="free floor" value={`${m.freeFloorPct}%`} tone={m.freeFloorPct < 30 ? 'warn' : 'ok'} />
      <Chip label="walkway" value={`${m.minWalkwayCm} cm`} tone={m.minWalkwayCm < 60 ? 'bad' : 'ok'} />
      <Chip label="open area" value={`${(m.openAreaCm2 / 10000).toFixed(1)} m²`} tone="ok" />
      <Chip label="budget" value={`$${m.budgetUsed} / $${room.brief.budget}`} tone={budgetPct > 1 ? 'bad' : budgetPct > 0.9 ? 'warn' : 'ok'} />
      <Chip label={`light at ${lightName}`} value={light === null ? '—' : `${light}%`} tone={light !== null && light < 30 ? 'warn' : 'ok'} />
      <Chip label="issues" value={String(m.violationCount)} tone={m.violationCount > 0 ? 'warn' : 'ok'} />
    </div>
  );
}
