// src/ui/BuyPanel.tsx
import { useMemo, useState } from 'react';
import { useRoom } from '../store';
import { searchQueryFor, shoppingList, shoppingListText } from '../engine/shopping';
import { PURCHASE_STATUSES, type Purchase, type PurchaseStatus } from '../engine/types';
import { ItemGlyph } from '../plan/glyphs';
import { catalogFor } from '../engine/catalog';
import { BTN_PRIMARY, BTN_SM, INPUT, LABEL, LINK, NUM, ROW } from './styles';

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
 * That division is why the store and the link read back rather than type in. A pair of empty
 * text fields asks the user to go and find what the agent is standing right there to find; a
 * "Source" line that says "Not sourced yet" asks the agent instead, and shows the exact query
 * it will run. The fields are still reachable behind **edit**, because somebody who bought a
 * chair off a neighbour has a shop name no search will ever return.
 *
 * Status lives per placement rather than per line, which is why marking a line marks every
 * copy of that piece at once: nobody wants to tick two identical chairs separately.
 */
export default function BuyPanel() {
  const room = useRoom((s) => s.rooms[s.currentId]!);
  const dispatch = useRoom((s) => s.dispatch);
  const list = useMemo(() => shoppingList(room), [room]);
  const byId = useMemo(() => new Map(catalogFor(room).map((c) => [c.id, c])), [room]);
  const [copied, setCopied] = useState<'list' | 'prompt' | null>(null);
  const [editing, setEditing] = useState<readonly string[]>([]);

  /**
   * The brief the agent is handed, list included.
   *
   * Everything already owned is left out: sourcing a chair that is standing in the room is
   * work for nobody. If the whole list is owned the brief falls back to all of it rather than
   * copying an empty errand.
   */
  const agentPrompt = useMemo(() => {
    const wanted = list.lines.filter((l) => l.status !== 'owned');
    const rows = (wanted.length > 0 ? wanted : list.lines).map((l) => `${l.name} ×${l.qty} (${searchQueryFor(room, l)})`);
    return (
      'Source my shopping list: for each line, find the best store (online or near me; ask my city if you need it) ' +
      'and record the store name and link with set_purchase_status using the catalogId. Lines: ' +
      rows.join('; ')
    );
  }, [list, room]);

  /** One change to a line is one ledger entry, however many placements stand behind it. */
  const setLine = (itemIds: string[], purchase: Purchase, summary: string) =>
    dispatch({ actor: 'human', ops: itemIds.map((id) => ({ type: 'setPurchase' as const, id, purchase })), summary });

  const copy = async (what: 'list' | 'prompt', text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      setCopied(null);
    }
  };

  if (list.lines.length === 0) {
    return <p className="p-3 text-[11.5px] text-muted">Nothing is in the room yet. Place a few pieces and they turn up here as a list to buy.</p>;
  }

  return (
    <div className="flex flex-col gap-2 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className={LABEL}>Shopping list</div>
        <button className={LINK} title="Copy the list as plain text" onClick={() => void copy('list', shoppingListText(room))}>
          {copied === 'list' ? 'Copied' : 'Copy list'}
        </button>
      </div>

      <button
        className={`${BTN_PRIMARY} h-7 w-full text-[12px]`}
        title="Copy a brief your agent can run: it finds the stores and fills the sources in"
        onClick={() => void copy('prompt', agentPrompt)}
      >
        {copied === 'prompt' ? 'Copied' : 'Source with your agent'}
      </button>

      <p className="text-[11px] leading-snug text-muted">Choose what you already own. Your agent finds where to buy the rest and fills in the sources.</p>

      <div className="space-y-1.5">
        {list.lines.map((l) => {
          const cat = byId.get(l.catalogId);
          const open = editing.includes(l.catalogId);
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

              <div className="mt-1.5 flex items-center gap-1.5">
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

                <div className="min-w-0 flex-1 text-[11.5px]">
                  {l.source ? (
                    <span className="flex min-w-0 items-baseline gap-1.5">
                      <span className="truncate text-fg" title={l.source}>{l.source}</span>
                      {l.url && <a href={l.url} target="_blank" rel="noopener noreferrer" className={`${LINK} shrink-0`}>Open</a>}
                    </span>
                  ) : (
                    <span className="text-muted">Not sourced yet</span>
                  )}
                </div>

                <button
                  className={`${BTN_SM} border-transparent bg-transparent`}
                  aria-label={`Edit the store and link for ${l.name}`}
                  aria-expanded={open}
                  title="Type the shop in yourself, for something bought in person"
                  onClick={() => setEditing((ids) => (ids.includes(l.catalogId) ? ids.filter((id) => id !== l.catalogId) : [...ids, l.catalogId]))}
                >
                  {open ? 'done' : 'edit'}
                </button>
              </div>

              <div className={`mt-1 truncate text-[10.5px] font-mono text-muted`} title={searchQueryFor(room, l)}>
                agent query: {searchQueryFor(room, l)}
              </div>

              {open && (
                <div className="mt-1.5 space-y-1">
                  <input
                    className={`${INPUT} h-6 text-[11.5px]`}
                    placeholder="Store"
                    aria-label={`Where to buy ${l.name}`}
                    defaultValue={l.source ?? ''}
                    onBlur={(e) => {
                      const source = e.target.value.trim();
                      if (source === (l.source ?? '')) return;
                      setLine(l.itemIds, { status: l.status, ...(source ? { source } : {}), ...(l.url ? { url: l.url } : {}) }, `${l.name} from ${source || 'nowhere in particular'}`);
                    }}
                  />
                  <input
                    className={`${INPUT} h-6 text-[11.5px]`}
                    placeholder="Link"
                    aria-label={`Link for ${l.name}`}
                    defaultValue={l.url ?? ''}
                    onBlur={(e) => {
                      const url = e.target.value.trim();
                      if (url === (l.url ?? '')) return;
                      setLine(l.itemIds, { status: l.status, ...(l.source ? { source: l.source } : {}), ...(url ? { url } : {}) }, `Link for ${l.name}`);
                    }}
                  />
                </div>
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
    </div>
  );
}
