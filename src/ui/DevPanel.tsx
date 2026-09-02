// src/ui/DevPanel.tsx
import { useEffect, useState } from 'react';
import { webmcp, useRegistryVersion } from '../webmcp';
import { Icon } from './icons';
import { BTN_PRIMARY, CARD, CLOSE, INPUT, LABEL, NUM, TITLE } from './styles';

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
    <div className={`fixed bottom-12 right-4 z-50 flex h-[70vh] w-[520px] flex-col p-3 ${CARD}`}>
      <div className="mb-2.5 flex items-center gap-2">
        <Icon name="dev" size={14} className="text-accent" />
        <strong className={TITLE}>WebMCP dev panel</strong>
        <span className={`ml-auto text-[11px] text-muted ${NUM}`}>{webmcp.isNative ? 'native modelContext' : 'shim'} · {tools.length} tools</span>
        <button className={CLOSE} aria-label="Close the dev panel" onClick={() => setOpen(false)}><Icon name="close" size={13} /></button>
      </div>
      <div className="mb-2 flex gap-1.5">
        <select className={`${INPUT} flex-1 font-mono`} aria-label="Tool" value={name} onChange={(e) => { setName(e.target.value); setOutput(''); }}>
          {tools.map((t) => <option key={t.name} value={t.name}>{t.name}{t.annotations?.readOnlyHint ? ' (read-only)' : ''}</option>)}
        </select>
        <button className={BTN_PRIMARY} onClick={run}>Run</button>
      </div>
      {tool && <p className="mb-2 max-h-16 overflow-auto text-[11.5px] leading-snug text-muted">{tool.description}</p>}
      <div className={`mb-1 ${LABEL}`}>Input</div>
      <textarea
        className="mb-2 h-24 rounded-md border border-line bg-raised p-2 font-mono text-[11.5px] text-fg outline-none focus:border-accent/70"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        spellCheck={false}
        aria-label="Tool input JSON"
      />
      <details className="mb-2 text-[11px] text-muted">
        <summary className="cursor-pointer select-none">input schema</summary>
        <pre className="max-h-32 overflow-auto font-mono text-[10.5px] text-muted">{JSON.stringify(tool?.inputSchema, null, 1)}</pre>
      </details>
      <div className={`mb-1 ${LABEL}`}>Result</div>
      <pre className="min-h-0 flex-1 overflow-auto rounded-md border border-line bg-bg p-2 font-mono text-[11px] text-ok">{output}</pre>
    </div>
  );
}
