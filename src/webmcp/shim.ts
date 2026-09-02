import type { ModelContextLike, ToolDescriptor } from './registry';
import type { ToolResult } from './results';

export class FakeModelContext extends EventTarget implements ModelContextLike {
  tools = new Map<string, ToolDescriptor>();

  registerTool(descriptor: ToolDescriptor, options?: { signal?: AbortSignal }): void {
    // An already-aborted signal never fires an `abort` event, so registering here would
    // leave a tool that can never be removed. Match the platform and drop the registration.
    if (options?.signal?.aborted) return;
    this.tools.set(descriptor.name, descriptor);
    options?.signal?.addEventListener('abort', () => {
      if (this.tools.get(descriptor.name) === descriptor) {
        this.tools.delete(descriptor.name);
        this.dispatchEvent(new Event('toolchange'));
      }
    });
    this.dispatchEvent(new Event('toolchange'));
  }

  getTools(): ToolDescriptor[] { return [...this.tools.values()]; }

  executeTool(name: string, input: unknown): Promise<ToolResult> {
    const t = this.tools.get(name);
    if (!t) return Promise.reject(new Error(`No tool ${name}`));
    return t.execute(input);
  }
}

export function getModelContext(): { mc: ModelContextLike; isNative: boolean } {
  const doc = typeof document !== 'undefined' ? (document as unknown as { modelContext?: ModelContextLike }) : undefined;
  if (doc?.modelContext && typeof doc.modelContext.registerTool === 'function') return { mc: doc.modelContext, isNative: true };
  const g = globalThis as unknown as { __floorplayFakeMC?: FakeModelContext };
  g.__floorplayFakeMC ??= new FakeModelContext();
  return { mc: g.__floorplayFakeMC, isNative: false };
}
