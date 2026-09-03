// src/webmcp/install.ts
import { ToolRegistry, type ModelContextLike } from './registry';
import { getModelContext } from './shim';
import type { RoomStore } from '../store/roomStore';
import { buildReadTools } from './tools/readTools';
import { buildMutateTools } from './tools/mutateTools';
import { buildProposalTools, buildSelectionTools } from './tools/dynamicTools';
import { buildWallTools } from './tools/wallTools';
import { buildScriptTool } from './tools/scriptTool';
import { buildShoppingTools } from './tools/shoppingTools';
import { findCatalogItem } from '../engine/catalog';

export function installWebMCP(store: RoomStore, mcOverride?: ModelContextLike): { registry: ToolRegistry; isNative: boolean } {
  const { mc, isNative } = mcOverride ? { mc: mcOverride, isNative: false } : getModelContext();
  const registry = new ToolRegistry(mc);
  if (typeof console !== 'undefined') console.info(`[floorplay] WebMCP context: ${isNative ? 'native document.modelContext' : 'fake shim (no agent browser detected)'}`);
  const ctx = { store };
  // Proposal tools are static, not selection-scoped: spec 8.3 requires everything reachable
  // through a dynamic tool to also be reachable statically by id, and applying or withdrawing
  // a proposal has no other static route.
  const staticTools = [...buildReadTools(ctx), ...buildMutateTools(ctx), ...buildWallTools(ctx), ...buildShoppingTools(ctx), ...buildProposalTools(ctx)];
  // `run_layout_script` needs a real Web Worker for its sandbox, so it is only offered where
  // one exists. The `mcOverride` guard keeps it out of the tests' fake model context, which
  // runs in Node with no Worker anyway.
  if (typeof Worker !== 'undefined' && !mcOverride) staticTools.push(buildScriptTool(ctx));
  registry.setGroup('static', staticTools);

  let selKey: string | null = null;
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
  };
  sync();
  store.subscribe(sync);
  return { registry, isNative };
}
