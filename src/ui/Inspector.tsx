// src/ui/Inspector.tsx
import { useRoom } from '../store';
import { findCatalogItem, itemColor } from '../engine/catalog';
import { rotatedDims } from '../engine/geometry';
import { ROTATIONS } from '../engine/types';
import { ItemGlyph } from '../plan/glyphs';
import { Icon } from './icons';
import { BTN_DANGER, BTN_QUIET, BTN_SM, LABEL, NUM, SEG, SEG_ITEM, SEG_ITEM_ON } from './styles';

/** One number of the selected piece, in mono, under its own word. */
function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[10.5px] uppercase tracking-[0.06em] text-muted">{label}</div>
      <div className={`truncate text-[12px] text-fg ${NUM}`}>{value}</div>
    </div>
  );
}

/** The Selection tab: what this piece is, how it sits, and the three things you can do to it. */
export default function Inspector() {
  const room = useRoom((s) => s.rooms[s.currentId]!);
  const analysis = useRoom((s) => s.analysis);
  const selectedId = useRoom((s) => s.ui.selectedItemId);
  const { dispatch, select, setCatalogOpen } = useRoom((s) => s);
  const item = selectedId ? room.items.find((i) => i.id === selectedId) : undefined;
  const cat = item ? findCatalogItem(room, item.catalogId) : undefined;
  if (!item || !cat) return null;
  const dims = rotatedDims(cat, item.rotation);
  const issues = analysis.violations.filter((v) => v.itemIds.includes(item.id));
  const light = Math.round((analysis.metrics.lightByItem[item.id] ?? 0) * 100);
  const color = itemColor(cat, item.color);

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex items-start gap-2.5">
        <ItemGlyph shape={cat.shape} color={color} w={cat.width} h={cat.depth} size={34} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-medium leading-tight text-fg">{cat.name}</div>
          <div className="mt-0.5 text-[11px] capitalize text-muted">{cat.category} · <span className={NUM}>${cat.price}</span></div>
        </div>
        {item.locked && (
          <span className="flex h-5 items-center gap-1 rounded border border-line px-1.5 text-[10px] uppercase tracking-[0.06em] text-muted" title="Locked: nothing can move it">
            <Icon name="lock" size={11} />Locked
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 border-y border-line py-2.5">
        <Field label="Footprint" value={`${dims.w}×${dims.h}`} />
        <Field label="Height" value={`${cat.height} cm`} />
        <Field label="Light" value={`${light}%`} />
      </div>

      <section>
        <div className={`mb-1.5 ${LABEL}`}>Rotation</div>
        <div className={`${SEG} w-full`}>
          {ROTATIONS.map((r) => (
            <button
              key={r}
              disabled={item.locked}
              aria-pressed={item.rotation === r}
              className={`flex-1 ${item.rotation === r ? SEG_ITEM_ON : SEG_ITEM} ${NUM}`}
              onClick={() => dispatch({ actor: 'human', ops: [{ type: 'move', id: item.id, x: item.x, y: item.y, rotation: r }] })}
            >{r}°</button>
          ))}
        </div>
      </section>

      {cat.colors && cat.colors.length > 0 && (
        <section>
          <div className={`mb-1.5 ${LABEL}`}>Finish</div>
          <div className="flex flex-wrap items-center gap-1.5">
            {cat.colors.map((c) => (
              <button
                key={c}
                title={c}
                aria-label={`Color ${c}`}
                aria-pressed={color === c}
                onClick={() => dispatch({ actor: 'human', ops: [{ type: 'recolor', id: item.id, color: c }] })}
                className={`h-[22px] w-[22px] rounded-[3px] transition-shadow focus-visible:outline-none ${color === c ? 'ring-2 ring-accent ring-offset-2 ring-offset-panel' : 'ring-1 ring-line hover:ring-[var(--line-hi)]'}`}
                style={{ background: c }}
              />
            ))}
            {/* Clearing the override is its own choice, so it gets a chip rather than hiding
                behind whichever swatch happens to equal the catalog color. */}
            <button
              aria-pressed={item.color === undefined}
              onClick={() => dispatch({ actor: 'human', ops: [{ type: 'recolor', id: item.id, color: null }] })}
              className={item.color === undefined ? 'inline-flex h-[22px] shrink-0 items-center rounded-[3px] bg-[var(--accent-fill)] px-2 text-[11px] text-accent' : BTN_SM}
            >Default</button>
          </div>
        </section>
      )}

      <div className="flex gap-1.5">
        <button className={`flex-1 ${BTN_QUIET}`} onClick={() => dispatch({ actor: 'human', ops: [{ type: 'setLocked', id: item.id, locked: !item.locked }] })}>
          <Icon name={item.locked ? 'unlock' : 'lock'} size={13} />{item.locked ? 'Unlock' : 'Lock'}
        </button>
        <button className={`flex-1 ${BTN_QUIET}`} title="Show pieces that could take its place" onClick={() => setCatalogOpen(true, { category: cat.category, fitsItemId: item.id })}>
          <Icon name="swap" size={13} />Swap
        </button>
        <button disabled={item.locked} className={BTN_DANGER} aria-label="Remove" title="Remove this piece" onClick={() => { dispatch({ actor: 'human', ops: [{ type: 'remove', id: item.id }] }); select(null); }}>
          <Icon name="trash" size={13} />
        </button>
      </div>

      {issues.length > 0 && (
        <ul className="space-y-1 rounded-md border border-bad/30 bg-bad/6 p-2">
          {issues.map((v, i) => <li key={i} className="text-[11.5px] leading-snug text-bad">{v.message}</li>)}
        </ul>
      )}

      <p className="text-[11px] leading-snug text-muted">
        <span className="font-mono text-fg">Drag</span> move · <span className="font-mono text-fg">R</span> rotate ·{' '}
        <span className="font-mono text-fg">L</span> lock · <span className="font-mono text-fg">Del</span> remove
      </p>
    </div>
  );
}
