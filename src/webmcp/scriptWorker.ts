// src/webmcp/scriptWorker.ts
import { runLayoutScript } from '../engine/scriptRunner';
import type { Room } from '../engine/types';

self.onmessage = (e: MessageEvent<{ code: string; room: Room }>) => {
  const r = runLayoutScript(e.data.code, e.data.room);
  (self as unknown as Worker).postMessage(r);
};
