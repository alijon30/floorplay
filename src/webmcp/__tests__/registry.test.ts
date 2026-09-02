import { describe, it, expect } from 'vitest';
import { ToolRegistry, type ToolDef } from '../registry';
import { FakeModelContext } from '../shim';
import { ok, fail, parseResult, validateInput } from '../results';
import { intProp, strProp, rotationProp } from '../schemas';

const tool = (name: string, body: (i: Record<string, unknown>) => unknown = () => ({})): ToolDef => ({
  name, description: name, inputSchema: { type: 'object', properties: {} },
  execute: async (i) => ok({ echo: body(i) }),
});

describe('ToolRegistry', () => {
  it('registers groups and replaces them', () => {
    const mc = new FakeModelContext();
    const reg = new ToolRegistry(mc);
    reg.setGroup('static', [tool('a'), tool('b')]);
    expect(mc.getTools().map((t) => t.name).sort()).toEqual(['a', 'b']);
    reg.setGroup('dyn', [tool('c')]);
    reg.setGroup('dyn', [tool('d')]);
    expect(mc.getTools().map((t) => t.name).sort()).toEqual(['a', 'b', 'd']);
    reg.clearGroup('dyn');
    expect(reg.listTools().map((t) => t.name)).toEqual(['a', 'b']);
  });

  it('notifies listeners and tracks the last call', async () => {
    const mc = new FakeModelContext();
    const reg = new ToolRegistry(mc);
    let n = 0;
    reg.onChange(() => n++);
    reg.setGroup('static', [tool('a', (i) => i['x'])]);
    const r = await mc.executeTool('a', { x: 1 });
    expect(parseResult(r)).toEqual({ ok: true, echo: 1 });
    expect(reg.lastCall?.name).toBe('a');
    expect(n).toBeGreaterThan(1);
  });

  it('turns thrown errors into failures and validates input on invoke', async () => {
    const mc = new FakeModelContext();
    const reg = new ToolRegistry(mc);
    reg.setGroup('s', [
      { ...tool('boom'), execute: async () => { throw new Error('nope'); } },
      { ...tool('strict'), inputSchema: { type: 'object', properties: { n: intProp('n') }, required: ['n'] } },
    ]);
    expect(parseResult(await mc.executeTool('boom', {}))).toMatchObject({ ok: false, error: 'internal_error' });
    expect(parseResult(await reg.invoke('strict', {}))).toMatchObject({ ok: false, error: 'invalid_input' });
    expect(parseResult(await reg.invoke('strict', { n: 2 }))).toMatchObject({ ok: true });
    expect(parseResult(await reg.invoke('missing', {}))).toMatchObject({ ok: false, error: 'not_found' });
  });

  it('ignores registration with an already-aborted signal', () => {
    const mc = new FakeModelContext();
    const controller = new AbortController();
    controller.abort();
    mc.registerTool({
      name: 'ghost', description: 'ghost', inputSchema: { type: 'object', properties: {} },
      execute: async () => ok({}),
    }, { signal: controller.signal });
    expect(mc.getTools()).toEqual([]);
  });

  it('lastCall.ok reflects the payload', async () => {
    const mc = new FakeModelContext();
    const reg = new ToolRegistry(mc);
    reg.setGroup('s', [{ ...tool('sad'), execute: async () => fail('nope') }]);
    await mc.executeTool('sad', {});
    expect(reg.lastCall).toMatchObject({ name: 'sad', ok: false });
  });

  it('invoke of an unknown tool records lastCall and notifies', async () => {
    const mc = new FakeModelContext();
    const reg = new ToolRegistry(mc);
    let n = 0;
    reg.onChange(() => n++);
    await reg.invoke('missing', {});
    expect(reg.lastCall).toMatchObject({ name: 'missing', ok: false });
    expect(n).toBe(1);
  });
});

describe('results and validation', () => {
  it('wraps payloads', () => {
    expect(parseResult(ok({ a: 1 }))).toEqual({ ok: true, a: 1 });
    expect(parseResult(fail('bad', 'try again', { x: 1 }))).toEqual({ ok: false, error: 'bad', hint: 'try again', x: 1 });
  });

  it('validates required fields, types, enums and ranges', () => {
    const schema = {
      type: 'object' as const,
      properties: { n: intProp('n', 0, 10), s: strProp('s'), r: rotationProp, list: { type: 'array' as const, items: strProp('x') } },
      required: ['n'],
    };
    expect(validateInput(schema, { n: 3 })).toEqual({ ok: true, value: { n: 3 } });
    expect(validateInput(schema, {})).toMatchObject({ ok: false, errors: ['n: required'] });
    expect(validateInput(schema, { n: 3.5 })).toMatchObject({ ok: false, errors: ['n: expected integer'] });
    expect(validateInput(schema, { n: 11 })).toMatchObject({ ok: false, errors: ['n: must be <= 10'] });
    expect(validateInput(schema, { n: 1, r: 45 })).toMatchObject({ ok: false, errors: ['r: must be one of 0, 90, 180, 270'] });
    expect(validateInput(schema, { n: 1, list: ['a', 2] })).toMatchObject({ ok: false, errors: ['list[1]: expected string'] });
    expect(validateInput(schema, 'x')).toMatchObject({ ok: false });
  });
});
