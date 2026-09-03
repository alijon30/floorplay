// src/ui/BuyPanel.tsx
import { useMemo, useState } from 'react';
import { useRoom } from '../store';
import { shoppingList, shoppingListText } from '../engine/shopping';
import { PURCHASE_STATUSES, type Purchase, type PurchaseStatus } from '../engine/types';
import { ItemGlyph } from '../plan/glyphs';
import { catalogFor } from '../engine/catalog';
import { BTN_SM, INPUT, LABEL, NUM, ROW } from './styles';

const STATUS_LABEL: Record<PurchaseStatus, string> = { 'to-buy': 'To buy', owned: 'Owned', ordered: 'Ordered' };
const STATUS_TONE: Record<PurchaseStatus, string> = { 'to-buy': 'text-warn', owned: 'text-ok', ordered: 'text-accent' };

/**
 * The Buy tab: the room read back as a shopping list.
 *
 * A plan is only half an answer — the other half is what it costs to actually own, and from
 * where. The app can do the first half on its own, because it knows every piece in the room
 * and what the catalog thinks it is worth. It cannot do the second: no page here knows what a
 * shop near you has in stock this week. So the list is the app's, and the store name and the
 * link are the agent's, filled in through `set_purchase_status`.
 *
 * Status lives per placement rather than per line, which is why marking a line marks every
 * copy of that piece at once: nobody wants to tick two identical chairs separately.
 */
export default function BuyPanel() {
  const room = useRoom((s) => s.rooms[s.currentId]!);
  const dispatch = useRoom((s) => s.dispatch);
  const list = useMemo(() => shoppingList(room), [room]);
  const byId = useMemo(() => new Map(catalogFor(room).map((c) => [c.id, c])), [room]);
  const [copied, setCopied] = useState(false);

  /** One change to a line is one ledger entry, however many placements stand behind it. */
  const setLine = (itemIds: string[], purchase: Purchase, summary: string) =>
    dispatch({ actor: 'human', ops: itemIds.map((id) => ({ type: 'setPurchase' as const, id, purchase })), summary });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shoppingListText(room));
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  if (list.lines.length === 0) {
    return <p className="p-3 text-[11.5px] text-muted">Nothing is in the room yet. Place a few pieces and they turn up here as a list to buy.</p>;
  }

  return (
    <div className="flex flex-col gap-2 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className={LABEL}>Shopping list</div>
        <button className={BTN_SM} title="Copy the list as plain text" onClick={copy}>{copied ? 'Copied' : 'Copy list'}</button>
      </div>

      <div className="space-y-1.5">
        {list.lines.map((l) => {
          const cat = byId.get(l.catalogId);
          return (
            <div key={l.catalogId} className={`${ROW} p-2`}>
              <div className="flex items-center gap-2.5">
                {cat && <ItemGlyph shape={cat.shape} color={cat.color} w={cat.width} h={cat.depth} size={34} />}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12px] text-fg">{l.name}{l.qty > 1 && <span className={`ml-1 text-muted ${NUM}`}>×{l.qty}</span>}</div>
                  <div className={`text-[11px] text-muted ${NUM}`}>${l.unitPrice} each</div>
                </div>
                <div className={`shrink-0 text-[12px] ${NUM} ${STATUS_TONE[l.status]}`}>${l.lineTotal}</div>
              </div>

              <div className="mt-1.5 flex gap-1.5">
                <label className="flex shrink-0 items-center rounded-md border border-line bg-panel px-1.5">
                  <select
                    aria-label={`Buying status of ${l.name}`}
                    value={l.status}
                    onChange={(e) => {
                      const status = e.target.value as PurchaseStatus;
                      setLine(l.itemIds, { status, ...(l.source ? { source: l.source } : {}), ...(l.url ? { url: l.url } : {}) }, `Marked ${l.name} ${STATUS_LABEL[status].toLowerCase()}`);
                    }}
                    className="h-6 cursor-pointer bg-transparent text-[11.5px] text-fg outline-none"
                  >
                    {PURCHASE_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                  </select>
                </label>
                <input
                  className={`${INPUT} h-6 min-w-0 flex-1 text-[11.5px]`}
                  placeholder="Store"
                  aria-label={`Where to buy ${l.name}`}
                  defaultValue={l.source ?? ''}
                  onBlur={(e) => {
                    const source = e.target.value.trim();
                    if (source === (l.source ?? '')) return;
                    setLine(l.itemIds, { status: l.status, ...(source ? { source } : {}), ...(l.url ? { url: l.url } : {}) }, `${l.name} from ${source || 'nowhere in particular'}`);
                  }}
                />
              </div>
              <input
                className={`${INPUT} mt-1 h-6 text-[11.5px]`}
                placeholder="Link"
                aria-label={`Link for ${l.name}`}
                defaultValue={l.url ?? ''}
                onBlur={(e) => {
                  const url = e.target.value.trim();
                  if (url === (l.url ?? '')) return;
                  setLine(l.itemIds, { status: l.status, ...(l.source ? { source: l.source } : {}), ...(url ? { url } : {}) }, `Link for ${l.name}`);
                }}
              />
              {l.url && (
                <a href={l.url} target="_blank" rel="noreferrer" className="mt-1 inline-block truncate text-[11px] text-accent hover:underline">Open the listing</a>
              )}
            </div>
          );
        })}
      </div>

      <div className="border-t border-line pt-2">
        <div className="flex items-baseline justify-between text-[12px]">
          <span className="text-muted">Still to buy</span>
          <span className={`${NUM} text-fg`} title="Total price of every line still marked to buy">${list.toBuy} / ${list.budget}</span>
        </div>
        <div className={`mt-0.5 text-[11px] ${list.remaining >= 0 ? 'text-muted' : 'text-bad'} ${NUM}`}>
          {list.remaining >= 0 ? `$${list.remaining} left in the budget` : `$${-list.remaining} over the budget`}
          {list.owned > 0 && <span className="text-muted"> · ${list.owned} already owned</span>}
          {list.ordered > 0 && <span className="text-muted"> · ${list.ordered} ordered</span>}
        </div>
      </div>

      <p className="text-[11px] leading-snug text-muted">Ask your agent: find these near me and fill in the store.</p>
    </div>
  );
}
