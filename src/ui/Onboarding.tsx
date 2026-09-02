// src/ui/Onboarding.tsx
import { useState } from 'react';
import { useRoom } from '../store';
import { WEBMCP_FLAG_URL } from '../config';

const PROMPTS = [
  'Furnish this studio for my brief. Give me three options.',
  'I moved the bed. Make it work and keep the desk in morning light.',
  "I'm over budget. Find cheaper storage.",
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access is blocked in some browsers and every insecure origin; the
      // prompt is still on screen to select by hand, so there is nothing to report.
    }
  };
  return (
    <button className="shrink-0 rounded bg-neutral-800 px-2 py-0.5 text-[11px] text-neutral-300 hover:bg-neutral-700" onClick={copy}>
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

/**
 * First-run card over the plan. It only shows on an untouched room, so anyone who has
 * already placed something or asked the agent for anything never sees it.
 */
export default function Onboarding() {
  const room = useRoom((s) => s.rooms[s.currentId]!);
  const dismissed = useRoom((s) => s.ui.onboardingDismissed);
  const loadDemo = useRoom((s) => s.loadDemo);
  const dismiss = useRoom((s) => s.dismissOnboarding);
  if (dismissed || room.items.length > 0 || room.ledger.length > 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center p-4">
      <div className="pointer-events-auto w-[30rem] max-w-full rounded-lg border border-neutral-700 bg-neutral-900/95 p-4 text-sm shadow-2xl backdrop-blur">
        <h2 className="text-base font-semibold">Design a room with ChatGPT on the same plan</h2>

        <ol className="mt-3 space-y-1 text-neutral-300">
          <li><span className="text-neutral-500">1.</span> Load a room — the demo studio, or an empty one you size yourself.</li>
          <li><span className="text-neutral-500">2.</span> Open this page in ChatGPT&apos;s browser, or in Chrome with <code className="rounded bg-neutral-800 px-1 text-[11px] text-emerald-300">{WEBMCP_FLAG_URL}</code> enabled.</li>
          <li><span className="text-neutral-500">3.</span> Ask for options — layouts land on the plan for you to accept or reject.</li>
        </ol>

        <div className="mt-4 flex gap-2">
          <button className="rounded bg-emerald-700 px-3 py-1 hover:bg-emerald-600" onClick={() => { loadDemo(); dismiss(); }}>Load the demo studio</button>
          <button className="rounded bg-neutral-800 px-3 py-1 hover:bg-neutral-700" onClick={dismiss}>Start empty</button>
        </div>

        <p className="mt-4 text-xs text-neutral-500">Try asking:</p>
        <ul className="mt-1 space-y-1">
          {PROMPTS.map((p) => (
            <li key={p} className="flex items-center gap-2 rounded bg-neutral-800/60 px-2 py-1 text-xs text-neutral-300">
              <span className="flex-1">{p}</span>
              <CopyButton text={p} />
            </li>
          ))}
        </ul>

        <button className="mt-3 text-xs text-neutral-500 underline hover:text-neutral-300" onClick={dismiss}>Don&apos;t show again</button>
      </div>
    </div>
  );
}
