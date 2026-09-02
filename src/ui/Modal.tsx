// src/ui/Modal.tsx
import type { ReactNode } from 'react';
import { Icon } from './icons';
import { CLOSE } from './styles';

export default function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/55 backdrop-blur-[2px]" onClick={onClose}>
      <div
        className="max-h-[85vh] w-[460px] overflow-auto rounded-lg border border-line bg-panel shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-line bg-panel px-4 py-2.5">
          <h2 className="text-[13px] font-medium text-fg">{title}</h2>
          <button className={CLOSE} onClick={onClose} aria-label="Close"><Icon name="close" size={13} /></button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
