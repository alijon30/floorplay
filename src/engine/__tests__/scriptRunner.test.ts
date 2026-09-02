import { describe, it, expect } from 'vitest';
import { makeDemoRoom } from '../rooms';
import { runLayoutScript } from '../scriptRunner';

describe('runLayoutScript', () => {
  it('exposes room, catalog, evaluate and nearestValid to the script', () => {
    const room = makeDemoRoom();
    const code = `
      const bed = api.catalog.find(c => c.id === 'bed-queen-160');
      let best = null;
      for (let y = 150; y <= 400; y += 50) {
        const r = api.evaluate([{ action: 'place', catalogId: bed.id, x: 80, y }]);
        if (r.violations.length === 0 && (!best || r.metrics.freeFloorPct > best.score)) best = { y, score: r.metrics.freeFloorPct };
      }
      return [{ action: 'place', catalogId: bed.id, x: 80, y: best.y }];
    `;
    const r = runLayoutScript(code, room);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.placements[0]).toMatchObject({ action: 'place', catalogId: 'bed-queen-160', x: 80 });
  });

  it('rejects non-array results and reports thrown errors', () => {
    const room = makeDemoRoom();
    expect(runLayoutScript('return 42', room)).toMatchObject({ ok: false });
    expect(runLayoutScript('throw new Error("boom")', room)).toMatchObject({ ok: false, error: expect.stringContaining('boom') });
  });
});
