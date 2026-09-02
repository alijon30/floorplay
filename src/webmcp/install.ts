// src/webmcp/install.ts
import { ToolRegistry, type ModelContextLike } from './registry';
import { getModelContext } from './shim';
import type { RoomStore } from '../store/roomStore';
import { buildReadTools } from './tools/readTools';
import { buildMutateTools } from './tools/mutateTools';
import { buildProposalTools, buildSelectionTools } from './tools/dynamicTools';
import { findCatalogItem } from '../engine/catalog';

export function installWebMCP(store: RoomStore, mcOverride?: ModelContextLike): { registry: ToolRegistry; isNative: boolean } {
  const { mc, isNative } = mcOverride ? { mc: mcOverride, isNative: false } : getModelContext();
  const registry = new ToolRegistry(mc);
  const ctx = { store };
  registry.setGroup('static', [...buildReadTools(ctx), ...buildMutateTools(ctx)]);

  let selKey: string | null = null;
  let propKey = '';
  const sync = () => {
    const s = store.getState();
    const room = s.current();
    const item = s.ui.selectedItemId ? room.items.find((i) => i.id === s.ui.selectedItemId) : undefined;
    const cat = item ? findCatalogItem(room, item.catalogId) : undefined;
    const nextSel = item && cat ? `${item.id}:${cat.id}:${item.x}:${item.y}:${item.rotation}:${item.locked}` : null;
    if (nextSel !== selKey) {
      selKey = nextSel;
      if (item && cat) registry.setGroup('selection', buildSelectionTools(ctx, item, cat));
      else registry.clearGroup('selection');
    }
    const nextProp = room.proposals.map((p) => `${p.id}:${p.label}`).join(',');
    if (nextProp !== propKey) {
      propKey = nextProp;
      if (room.proposals.length) registry.setGroup('proposals', buildProposalTools(ctx));
      else registry.clearGroup('proposals');
    }
  };
  sync();
  store.subscribe(sync);
  return { registry, isNative };
}
