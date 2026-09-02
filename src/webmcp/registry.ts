import { fail, parseResult, validateInput, type JsonSchema, type ToolResult } from './results';

export interface ToolAnnotations { readOnlyHint?: boolean; untrustedContentHint?: boolean }

export interface ToolDef {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  annotations?: ToolAnnotations;
  execute(input: Record<string, unknown>): Promise<ToolResult> | ToolResult;
}

/** Shape handed to the browser. Verified against the WebMCP explainer in Step 6; only `toDescriptor` knows the field names. */
export interface ToolDescriptor {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  annotations?: ToolAnnotations;
  execute(input: unknown): Promise<ToolResult>;
}

export interface ModelContextLike {
  registerTool(descriptor: ToolDescriptor, options?: { signal?: AbortSignal }): unknown;
}

/** Reads the `ok` field out of a result payload. Text we cannot parse counts as a success. */
function resultOk(r: ToolResult): boolean {
  try {
    return parseResult(r)['ok'] !== false;
  } catch {
    return true;
  }
}

export class ToolRegistry {
  private groups = new Map<string, { controller: AbortController; tools: ToolDef[] }>();
  private listeners = new Set<() => void>();
  /** The most recent tool call. `ok` mirrors the result payload's `ok` field, not merely whether `execute` avoided throwing. */
  lastCall: { name: string; at: number; ok: boolean } | null = null;

  constructor(private mc: ModelContextLike) {}

  private emit() { for (const l of this.listeners) l(); }

  // Step 6 verification (2026-09-02) against the normative WebMCP IDL at
  // https://webmachinelearning.github.io/webmcp/ and the explainer at
  // https://github.com/webmachinelearning/webmcp/blob/main/README.md:
  //   dictionary ModelContextTool { required DOMString name; USVString title;
  //     required DOMString description; object inputSchema;
  //     required ToolExecuteCallback execute; ToolAnnotations annotations; };
  //   dictionary ToolAnnotations { boolean readOnlyHint = false; boolean untrustedContentHint = false; };
  //   dictionary ModelContextRegisterToolOptions { sequence<USVString> exposedTo; AbortSignal signal; };
  // The explainer's canonical example is
  //   await document.modelContext.registerTool({ name, description, inputSchema, execute },
  //                                            { signal: controller.signal });
  // So the descriptor fields and the { signal } options object below are correct, and both
  // readOnlyHint and untrustedContentHint do live under `annotations`. No change needed.
  // The optional `title` and `exposedTo` members exist but are unused here.
  private toDescriptor(t: ToolDef): ToolDescriptor {
    return {
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
      ...(t.annotations ? { annotations: t.annotations } : {}),
      execute: (input) => this.run(t, input),
    };
  }

  private async run(t: ToolDef, input: unknown): Promise<ToolResult> {
    const v = validateInput(t.inputSchema, input);
    if (!v.ok) {
      this.lastCall = { name: t.name, at: Date.now(), ok: false };
      this.emit();
      return fail('invalid_input', v.errors.join('; '));
    }
    try {
      const r = await t.execute(v.value);
      this.lastCall = { name: t.name, at: Date.now(), ok: resultOk(r) };
      this.emit();
      return r;
    } catch (e) {
      this.lastCall = { name: t.name, at: Date.now(), ok: false };
      this.emit();
      return fail('internal_error', e instanceof Error ? e.message : String(e));
    }
  }

  setGroup(key: string, tools: ToolDef[]): void {
    this.clearGroup(key);
    const controller = new AbortController();
    for (const t of tools) {
      try {
        Promise.resolve(this.mc.registerTool(this.toDescriptor(t), { signal: controller.signal })).catch((e) => console.warn('registerTool rejected', t.name, e));
      } catch (e) {
        console.warn('registerTool threw', t.name, e);
      }
    }
    this.groups.set(key, { controller, tools });
    this.emit();
  }

  clearGroup(key: string): void {
    const g = this.groups.get(key);
    if (!g) return;
    g.controller.abort();
    this.groups.delete(key);
    this.emit();
  }

  listTools(): ToolDef[] { return [...this.groups.values()].flatMap((g) => g.tools); }
  get(name: string): ToolDef | undefined { return this.listTools().find((t) => t.name === name); }

  invoke(name: string, input: unknown): Promise<ToolResult> {
    const t = this.get(name);
    if (!t) {
      this.lastCall = { name, at: Date.now(), ok: false };
      this.emit();
      return Promise.resolve(fail('not_found', `No tool named ${name}`));
    }
    return this.run(t, input);
  }

  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}
