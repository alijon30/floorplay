// src/ui/Onboarding.tsx
import { useState } from 'react';
import { useRoom } from '../store';
import { WEBMCP_FLAG_URL } from '../config';
import { Icon } from './icons';
import { BTN_PRIMARY, BTN_QUIET, BTN_SM, CARD, CLOSE, LABEL, LINK } from './styles';

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
    <button className={BTN_SM} onClick={copy}>
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
  const setWizardOpen = useRoom((s) => s.setWizardOpen);
  if (dismissed || room.items.length > 0 || room.ledger.length > 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center p-4">
      <div className={`pointer-events-auto w-[26rem] max-w-full p-4 ${CARD}`}>
        {/* Three ways out of this card and none of them was the × people reach for first. */}
        <div className="flex items-start gap-2">
          <h2 className="min-w-0 flex-1 text-[15px] font-medium leading-snug text-fg">Design a room with ChatGPT on the same plan</h2>
          <button className={CLOSE} aria-label="Close" title="Close this card" onClick={dismiss}><Icon name="close" size={13} /></button>
        </div>

        <ol className="mt-3 space-y-1.5 text-[12px] leading-snug text-muted">
          <li><span className="mr-1.5 font-mono text-[11px] text-muted/60">01</span>Load a room — the demo studio, or an empty one you size yourself.</li>
          <li><span className="mr-1.5 font-mono text-[11px] text-muted/60">02</span>Open this page in ChatGPT&apos;s browser, or in Chrome with <code className="rounded bg-raised px-1 font-mono text-[10.5px] text-accent">{WEBMCP_FLAG_URL}</code> enabled.</li>
          <li><span className="mr-1.5 font-mono text-[11px] text-muted/60">03</span>Ask for options — layouts land on the plan for you to accept or reject.</li>
        </ol>

        <div className="mt-4 flex items-center gap-1.5">
          <button className={BTN_PRIMARY} onClick={() => { loadDemo(); dismiss(); }}>Load the demo studio</button>
          <button className={BTN_QUIET} onClick={dismiss}>Start empty</button>
          <button className={`ml-auto ${LINK}`} onClick={() => setWizardOpen(true)}>Ready-made rooms…</button>
        </div>

        <div className={`mt-4 ${LABEL}`}>Try asking</div>
        <ul className="mt-1.5 space-y-1">
          {PROMPTS.map((p) => (
            <li key={p} className="flex items-center gap-2 rounded-md border border-line bg-raised px-2 py-1.5 text-[11.5px] text-fg/90">
              <span className="flex-1">{p}</span>
              <CopyButton text={p} />
            </li>
          ))}
        </ul>

        <button className="mt-3 rounded text-[11px] text-muted underline transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent" onClick={dismiss}>Don&apos;t show again</button>
      </div>
    </div>
  );
}
