// src/ui/DevPanel.tsx
import { useEffect, useState } from 'react';
import { webmcp, useRegistryVersion } from '../webmcp';

export default function DevPanel() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('get_room');
  const [input, setInput] = useState('{}');
  const [output, setOutput] = useState('');
  useRegistryVersion();
  const tools = webmcp.registry.listTools();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'd') { e.preventDefault(); setOpen((o) => !o); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!open) return null;
  const tool = tools.find((t) => t.name === name);

  const run = async () => {
    let parsed: unknown = {};
    try { parsed = input.trim() ? JSON.parse(input) : {}; } catch (e) { setOutput(`Invalid JSON: ${String(e)}`); return; }
    const r = await webmcp.registry.invoke(name, parsed);
    try { setOutput(JSON.stringify(JSON.parse(r.content[0]?.text ?? '{}'), null, 2)); } catch { setOutput(r.content[0]?.text ?? ''); }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 flex h-[70vh] w-[520px] flex-col rounded-lg border border-neutral-700 bg-neutral-900 p-3 text-xs shadow-2xl">
      <div className="mb-2 flex items-center justify-between">
        <strong>WebMCP dev panel</strong>
        <span className="text-neutral-400">{webmcp.isNative ? 'native modelContext' : 'fake modelContext (shim)'} · {tools.length} tools</span>
        <button className="text-neutral-400 hover:text-white" onClick={() => setOpen(false)}>close</button>
      </div>
      <div className="mb-2 flex gap-2">
        <select className="flex-1 rounded bg-neutral-800 p-1" value={name} onChange={(e) => { setName(e.target.value); setOutput(''); }}>
          {tools.map((t) => <option key={t.name} value={t.name}>{t.name}{t.annotations?.readOnlyHint ? ' (read-only)' : ''}</option>)}
        </select>
        <button className="rounded bg-emerald-600 px-3 py-1 font-medium text-white hover:bg-emerald-500" onClick={run}>Run</button>
      </div>
      {tool && <p className="mb-2 max-h-16 overflow-auto text-neutral-400">{tool.description}</p>}
      <textarea className="mb-2 h-24 rounded bg-neutral-800 p-2 font-mono" value={input} onChange={(e) => setInput(e.target.value)} spellCheck={false} />
      <details className="mb-2 text-neutral-400"><summary>input schema</summary><pre className="max-h-32 overflow-auto">{JSON.stringify(tool?.inputSchema, null, 1)}</pre></details>
      <pre className="flex-1 overflow-auto rounded bg-neutral-950 p-2 font-mono text-emerald-200">{output}</pre>
    </div>
  );
}
