// src/ui/RoomWizard.tsx
import { useMemo, useState } from 'react';
import Modal from './Modal';
import { useRoom } from '../store';
import { PRESETS } from '../engine/rooms';
import { TEMPLATES, buildTemplateRoom } from '../engine/templates';
import { findCatalogItem, isMounted, itemColor } from '../engine/catalog';
import { footprint } from '../engine/geometry';
import { budgetUsed } from '../engine/validate';
import type { Rect, RoomKind } from '../engine/types';
import { BTN, BTN_PRIMARY, BTN_QUIET, INPUT, LABEL } from './styles';

const THUMB = 60;

interface Card {
  key: RoomKind;
  name: string;
  blurb: string;
  width: number;
  depth: number;
  count: number;
  price: number;
  shells: { rect: Rect; color: string; mounted: boolean }[];
}

/**
 * The cards, built once.
 *
 * Each one is drawn from a real `buildTemplateRoom`, so the thumbnail and the item count are
 * the layout the click actually produces rather than a hand-kept copy of it.
 */
function buildCards(): Card[] {
  return TEMPLATES.map((t) => {
    const room = buildTemplateRoom(t.key);
    const shells = room.items.flatMap((i) => {
      const cat = findCatalogItem(room, i.catalogId);
      return cat ? [{ rect: footprint(i, cat), color: itemColor(cat, i.color), mounted: isMounted(cat) }] : [];
    });
    return { key: t.key, name: t.name, blurb: t.blurb, width: t.width, depth: t.depth, count: room.items.length, price: budgetUsed(room), shells };
  });
}

function Thumb({ card }: { card: Card }) {
  const scale = THUMB / Math.max(card.width, card.depth);
  const w = card.width * scale, h = card.depth * scale;
  return (
    <svg width={THUMB} height={THUMB} viewBox={`0 0 ${THUMB} ${THUMB}`} className="shrink-0" aria-hidden>
      <g transform={`translate(${(THUMB - w) / 2} ${(THUMB - h) / 2}) scale(${scale})`}>
        <rect x={0} y={0} width={card.width} height={card.depth} fill="#1c1c1f" stroke="#52525b" strokeWidth={1 / scale} />
        {card.shells.map((s, i) => (
          <rect key={i} x={s.rect.x} y={s.rect.y} width={s.rect.w} height={s.rect.h} fill={s.color} opacity={s.mounted ? 0.55 : 0.9} />
        ))}
      </g>
    </svg>
  );
}

export default function RoomWizard({ onClose }: { onClose: () => void }) {
  const createRoom = useRoom((s) => s.createRoom);
  const loadTemplate = useRoom((s) => s.loadTemplate);
  const [name, setName] = useState('My room');
  const [dims, setDims] = useState({ width: 360, depth: 520, height: 260 });
  const cards = useMemo(buildCards, []);
  const submit = () => { createRoom({ name, ...dims }); onClose(); };
  return (
    <Modal title="New room" onClose={onClose}>
      <strong className={`mb-1 block ${LABEL}`}>Ready-made rooms</strong>
      <div aria-label="Ready-made rooms" className="mb-4 grid grid-cols-2 gap-2">
        {cards.map((c) => (
          <button
            key={c.key}
            title={c.blurb}
            onClick={() => { loadTemplate(c.key); onClose(); }}
            className="flex items-center gap-2 rounded-lg border border-neutral-800 p-2 text-left transition-colors hover:border-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            <Thumb card={c} />
            <div className="min-w-0">
              <div className="truncate text-sm">{c.name}</div>
              <div className="text-[11px] text-neutral-500">{c.width}×{c.depth} cm</div>
              <div className="text-[11px] text-neutral-500">{c.count} items · ${c.price}</div>
            </div>
          </button>
        ))}
      </div>

      <strong className={`mb-1 block ${LABEL}`}>Or size an empty one</strong>
      <label className="mb-2 block text-[11px] text-neutral-400">Name<input className={`mt-1 w-full ${INPUT}`} aria-label="New room name" value={name} onChange={(e) => setName(e.target.value)} /></label>
      <div className="mb-2 flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button key={p.key} className={BTN} onClick={() => { setName(p.name); setDims({ width: p.width, depth: p.depth, height: p.height }); }}>
            {p.name} {p.width}×{p.depth}
          </button>
        ))}
      </div>
      <div className="mb-3 grid grid-cols-3 gap-2">
        {(['width', 'depth', 'height'] as const).map((k) => (
          <label key={k} className="block text-[11px] text-neutral-400"><span className="capitalize">{k}</span> (cm)<input className={`mt-1 w-full ${INPUT}`} type="number" aria-label={`New room ${k} in cm`} value={dims[k]} onChange={(e) => setDims({ ...dims, [k]: Math.max(100, Number(e.target.value) || 100) })} /></label>
        ))}
      </div>
      <div className="flex justify-end gap-2"><button className={BTN_QUIET} onClick={onClose}>Cancel</button><button className={BTN_PRIMARY} onClick={submit}>Create</button></div>
    </Modal>
  );
}
