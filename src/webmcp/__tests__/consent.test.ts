import { describe, it, expect } from 'vitest';
import { createRoomStore } from '../../store/roomStore';
import { installWebMCP } from '../install';
import { FakeModelContext } from '../shim';
import { parseResult } from '../results';
import { wallColor } from '../../engine/wallColor';
import { describeCall, GATED_TOOLS } from '../tools/consent';

/** A fresh app with its tools installed. The demo studio is 360 x 520 x 260. */
function boot() {
  const store = createRoomStore();
  const mc = new FakeModelContext();
  installWebMCP(store, mc);
  const call = async (name: string, input: Record<string, unknown> = {}) => parseResult(await mc.executeTool(name, input));
  return { store, mc, call, s: () => store.getState() };
}

describe('propose first for the tools no ghost can draw', () => {
  it('applies straight away while propose first is off', async () => {
    const { call, s } = boot();
    const r = await call('set_wall_color', { wall: 'right', color: '#2a3a5a' });
    expect(r['status']).toBe('applied');
    expect(wallColor(s().current(), 'right')).toBe('#2a3a5a');
    expect(s().pending).toEqual([]);
  });

  it('waits as a card while propose first is on, and applies when the user accepts', async () => {
    const { call, s } = boot();
    s().setProposeFirst(true);
    const before = wallColor(s().current(), 'right');
    const r = await call('set_wall_color', { wall: 'right', color: '#2a3a5a' });
    expect(r['status']).toBe('proposed');
    expect(typeof r['proposalId']).toBe('string');
    expect(wallColor(s().current(), 'right')).toBe(before);
    expect(s().pending).toHaveLength(1);
    expect(s().pending[0]!.label).toBe('Set wall color · wall right · color #2a3a5a');
    expect((await call('get_room'))['pendingActions']).toEqual([{ id: r['proposalId'], tool: 'set_wall_color', label: s().pending[0]!.label }]);

    const accepted = await s().acceptAction(r['proposalId'] as string);
    expect(accepted.ok).toBe(true);
    expect(wallColor(s().current(), 'right')).toBe('#2a3a5a');
    expect(s().pending).toEqual([]);
    expect(s().current().ledger.at(-1)?.actor).toBe('agent');
  });

  it('drops a rejected card without touching the room', async () => {
    const { call, s } = boot();
    s().setProposeFirst(true);
    const floor = s().current().finish.floor;
    const r = await call('set_finish', { floor: 'walnut' });
    expect(r['status']).toBe('proposed');
    expect(s().rejectAction(r['proposalId'] as string)).toBe(true);
    expect(s().current().finish.floor).toBe(floor);
    expect(s().pending).toEqual([]);
    expect(s().rejectAction('nope')).toBe(false);
  });

  it('lets the agent apply or withdraw a card by id, once the user has said so', async () => {
    const { call, s } = boot();
    s().setProposeFirst(true);
    const r = await call('set_wall_color', { wall: 'left', color: '#123456' });
    const applied = await call('apply_proposal', { proposalId: r['proposalId'] });
    expect(applied['status']).toBe('applied');
    expect(wallColor(s().current(), 'left')).toBe('#123456');

    const r2 = await call('set_wall_color', { wall: 'top', color: '#654321' });
    expect(await call('withdraw_proposal', { proposalId: r2['proposalId'] })).toMatchObject({ status: 'withdrawn' });
    expect(wallColor(s().current(), 'top')).not.toBe('#654321');
    expect(s().pending).toEqual([]);
  });

  it('keeps a card whose call fails, with the reason on it', async () => {
    const { call, s } = boot();
    s().setProposeFirst(true);
    const r = await call('remove_doorway', { id: 'dw-missing' });
    expect(r['status']).toBe('proposed');
    const result = await s().acceptAction(r['proposalId'] as string);
    expect(result.ok).toBe(false);
    expect(s().pending).toHaveLength(1);
    expect(s().pending[0]!.error).toBeTruthy();
  });

  it('gates only the design tools that do not go through mutate', async () => {
    const { mc } = boot();
    const names = new Set(mc.getTools().map((t) => t.name));
    for (const t of GATED_TOOLS) expect(names.has(t), t).toBe(true);
    for (const t of ['set_camera', 'select_item', 'switch_room', 'undo_last_action', 'set_view', 'place_item']) expect(GATED_TOOLS.has(t), t).toBe(false);
  });

  it('describes a call in the words the card shows', () => {
    expect(describeCall('cut_doorway', { roomId: 'r1', otherRoomId: 'r2', wall: 'right', offset: 100, kind: undefined }))
      .toBe('Cut doorway · roomId r1 · otherRoomId r2 · wall right · offset 100');
    expect(describeCall('apply_palette', { name: 'warm' })).toBe('Apply palette · name warm');
  });
});
