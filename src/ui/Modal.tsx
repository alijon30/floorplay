// src/ui/Modal.tsx
import { useEffect, type ReactNode } from 'react';
import { Icon } from './icons';
import { CLOSE } from './styles';

export default function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  // Escape closes every overlay in the app, so it has to close this one too — the help
  // popover already does, and a key that works on one sheet and not the next is worse
  // than a key that works nowhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/55 backdrop-blur-[2px]" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-[85vh] w-[460px] overflow-auto rounded-lg border border-line bg-panel shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-line bg-panel px-4 py-2.5">
          <h2 className="text-[13px] font-medium text-fg">{title}</h2>
          <button className={CLOSE} onClick={onClose} aria-label="Close" title="Close (Esc)"><Icon name="close" size={13} /></button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
