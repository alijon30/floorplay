// src/ui/RoomWizard.tsx
import { useMemo, useState } from 'react';
import Modal from './Modal';
import { useRoom } from '../store';
import { PRESETS } from '../engine/rooms';
import { TEMPLATES, buildTemplateRoom, templateFor } from '../engine/templates';
import { HOME_TEMPLATES } from '../engine/homeTemplates';
import { findCatalogItem, isMounted, itemColor } from '../engine/catalog';
import { footprint } from '../engine/geometry';
import { budgetUsed } from '../engine/validate';
import type { Rect, RoomKind } from '../engine/types';
import { INK, INK_SOFT, PAPER } from '../plan/tokens';
import { BTN, BTN_PRIMARY, BTN_QUIET, FOCUS, INPUT, LABEL, NUM } from './styles';

const THUMB = 56;

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

/**
 * A ready-made home as the plan would draw it: one outline per room, at its offset.
 *
 * Drawn from the template's own numbers rather than by building the home, because the wizard
 * is a picture of what a click would make and building four furnished rooms to draw four
 * rectangles is a price nobody sees.
 */
function HomeThumb({ rooms }: { rooms: Rect[] }) {
  const maxX = Math.max(...rooms.map((r) => r.x + r.w), 1);
  const maxY = Math.max(...rooms.map((r) => r.y + r.h), 1);
  const scale = (THUMB - 6) / Math.max(maxX, maxY);
  const w = maxX * scale, h = maxY * scale;
  return (
    <svg width={THUMB} height={THUMB} viewBox={`0 0 ${THUMB} ${THUMB}`} className="shrink-0 rounded" aria-hidden>
      <rect x={0} y={0} width={THUMB} height={THUMB} rx={4} fill={PAPER} />
      <g transform={`translate(${(THUMB - w) / 2} ${(THUMB - h) / 2}) scale(${scale})`}>
        {rooms.map((r, i) => (
          <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} fill={INK_SOFT} fillOpacity={0.12} stroke={INK} strokeWidth={1 / scale} />
        ))}
      </g>
    </svg>
  );
}

/** The template as the plan would draw it: paper, an outline, and the footprints inside. */
function Thumb({ card }: { card: Card }) {
  const scale = (THUMB - 6) / Math.max(card.width, card.depth);
  const w = card.width * scale, h = card.depth * scale;
  return (
    <svg width={THUMB} height={THUMB} viewBox={`0 0 ${THUMB} ${THUMB}`} className="shrink-0 rounded" aria-hidden>
      <rect x={0} y={0} width={THUMB} height={THUMB} rx={4} fill={PAPER} />
      <g transform={`translate(${(THUMB - w) / 2} ${(THUMB - h) / 2}) scale(${scale})`}>
        <rect x={0} y={0} width={card.width} height={card.depth} fill="none" stroke={INK} strokeWidth={1 / scale} />
        {card.shells.map((s, i) => (
          <rect key={i} x={s.rect.x} y={s.rect.y} width={s.rect.w} height={s.rect.h} fill={s.color} fillOpacity={s.mounted ? 0.3 : 0.5} stroke={INK_SOFT} strokeWidth={0.5 / scale} />
        ))}
      </g>
    </svg>
  );
}

export default function RoomWizard({ onClose }: { onClose: () => void }) {
  const createRoom = useRoom((s) => s.createRoom);
  const loadTemplate = useRoom((s) => s.loadTemplate);
  const createHomeFromTemplate = useRoom((s) => s.createHomeFromTemplate);
  const [name, setName] = useState('My room');
  const [dims, setDims] = useState({ width: 360, depth: 520, height: 260 });
  const cards = useMemo(buildCards, []);
  // The rooms of each ready-made home, as rectangles on its shared plan.
  const homeCards = useMemo(() => HOME_TEMPLATES.map((t) => {
    const rects = t.rooms.map((r) => { const rt = templateFor(r.key); return { x: r.x, y: r.y, w: rt.width, h: rt.depth }; });
    return { ...t, rects, areaM2: Math.round(rects.reduce((sum, r) => sum + r.w * r.h, 0) / 100) / 100 };
  }), []);
  const submit = () => { createRoom({ name, ...dims }); onClose(); };
  return (
    <Modal title="New room or home" onClose={onClose}>
      <strong className={`mb-2 block ${LABEL}`}>Ready-made homes</strong>
      <div aria-label="Ready-made homes" className="mb-5 grid grid-cols-2 gap-1.5">
        {homeCards.map((t) => (
          <button
            key={t.key}
            title={t.blurb}
            onClick={() => { createHomeFromTemplate(t.key); onClose(); }}
            className={`flex items-center gap-2.5 rounded-md border border-line bg-raised p-2 text-left transition-colors hover:border-accent/50 ${FOCUS}`}
          >
            <HomeThumb rooms={t.rects} />
            <div className="min-w-0">
              <div className="truncate text-[12px] text-fg">{t.name}</div>
              <div className={`text-[10.5px] text-muted ${NUM}`}>{t.rooms.length} rooms · {t.areaM2} m²</div>
              <div className={`text-[10.5px] text-muted ${NUM}`}>{t.doorways.length} doorway{t.doorways.length === 1 ? '' : 's'} cut</div>
            </div>
          </button>
        ))}
      </div>

      <strong className={`mb-2 block ${LABEL}`}>Ready-made rooms</strong>
      <div aria-label="Ready-made rooms" className="mb-5 grid grid-cols-2 gap-1.5">
        {cards.map((c) => (
          <button
            key={c.key}
            title={c.blurb}
            onClick={() => { loadTemplate(c.key); onClose(); }}
            className={`flex items-center gap-2.5 rounded-md border border-line bg-raised p-2 text-left transition-colors hover:border-accent/50 ${FOCUS}`}
          >
            <Thumb card={c} />
            <div className="min-w-0">
              <div className="truncate text-[12px] text-fg">{c.name}</div>
              <div className={`text-[10.5px] text-muted ${NUM}`}>{c.width}×{c.depth} cm</div>
              <div className={`text-[10.5px] text-muted ${NUM}`}>{c.count} items · ${c.price}</div>
            </div>
          </button>
        ))}
      </div>

      <strong className={`mb-2 block ${LABEL}`}>Or size an empty one</strong>
      <label className="mb-2 block">
        <span className="mb-1 block text-[11px] text-muted">Name</span>
        <input className={INPUT} aria-label="New room name" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <div className="mb-2.5 flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <button key={p.key} className={BTN} onClick={() => { setName(p.name); setDims({ width: p.width, depth: p.depth, height: p.height }); }}>
            {p.name} <span className={`text-muted ${NUM}`}>{p.width}×{p.depth}</span>
          </button>
        ))}
      </div>
      <div className="mb-4 grid grid-cols-3 gap-1.5">
        {(['width', 'depth', 'height'] as const).map((k) => (
          <label key={k} className="block">
            <span className="mb-1 block text-[11px] text-muted"><span className="capitalize">{k}</span> (cm)</span>
            <input className={`${INPUT} ${NUM}`} type="number" aria-label={`New room ${k} in cm`} value={dims[k]} onChange={(e) => setDims({ ...dims, [k]: Math.max(100, Number(e.target.value) || 100) })} />
          </label>
        ))}
      </div>
      <div className="flex justify-end gap-1.5">
        <button className={BTN_QUIET} onClick={onClose}>Cancel</button>
        <button className={BTN_PRIMARY} onClick={submit}>Create</button>
      </div>
    </Modal>
  );
}
