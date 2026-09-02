// src/webmcp/tools/scriptTool.ts
import type { ToolDef } from '../registry';
import { ok, fail } from '../results';
import { strProp } from '../schemas';
import type { ToolContext } from './context';
import { shortViolations } from './context';
import { placementsToOps, type Placement } from './placements';
import { metricsDelta } from '../../engine/metrics';
import type { Room } from '../../engine/types';

function runInWorker(code: string, room: Room): Promise<{ ok: true; placements: Placement[] } | { ok: false; error: string }> {
  return new Promise((resolve) => {
    const worker = new Worker(new URL('../scriptWorker.ts', import.meta.url), { type: 'module' });
    const timer = setTimeout(() => { worker.terminate(); resolve({ ok: false, error: 'Script exceeded the 2 second limit' }); }, 2000);
    worker.onmessage = (e) => { clearTimeout(timer); worker.terminate(); resolve(e.data); };
    worker.onerror = (e) => { clearTimeout(timer); worker.terminate(); resolve({ ok: false, error: e.message }); };
    worker.postMessage({ code, room });
  });
}

export function buildScriptTool(ctx: ToolContext): ToolDef {
  return {
    name: 'run_layout_script',
    description:
      'Run a JavaScript function body you write, in a sandboxed worker with no DOM access, to search for a layout programmatically. The body receives `api` with: api.room (shell, openings, items, brief), api.catalog (array of items with dimensions and prices), api.evaluate(placements) → { metrics, violations }, api.nearestValid(catalogId, x, y, rotation) → {x,y} | null, api.bestSpots(hour, count). It must `return` an array of placements ({ action: "place"|"move"|"remove"|"swap", catalogId, id, x, y, rotation }). The result becomes a labeled proposal for the user to accept. 2 second time limit.',
    inputSchema: { type: 'object', properties: { label: strProp('Name for the resulting proposal'), code: strProp('JavaScript function body') }, required: ['label', 'code'] },
    execute: async (i) => {
      const s = ctx.store.getState();
      const room = s.current();
      const r = await runInWorker(i['code'] as string, room);
      if (!r.ok) return fail('script_error', r.error);
      const mapped = placementsToOps(room, r.placements);
      if (!mapped.ok) return fail(mapped.error, mapped.hint);
      const p = s.propose({ label: i['label'] as string, ops: mapped.ops });
      if (!p.ok) return fail(p.error, p.message);
      return ok({ status: 'proposed', proposalId: p.proposal.id, placements: r.placements.length, delta: metricsDelta(p.proposal.metricsBefore, p.proposal.metricsAfter), violationsAfter: shortViolations(p.proposal.violationsAfter) });
    },
  };
}
