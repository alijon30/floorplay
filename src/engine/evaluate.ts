// src/engine/evaluate.ts
import type { Analysis, Op, Room } from './types';
import { analyze } from './analyze';
import { applyOps } from './ops';

export function evaluateOps(room: Room, ops: Op[]): { ok: true; room: Room; analysis: Analysis } | { ok: false; error: string; message: string } {
  const r = applyOps(room, ops);
  if (!r.ok) return { ok: false, error: r.error, message: r.message };
  return { ok: true, room: r.room, analysis: analyze(r.room) };
}
