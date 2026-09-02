// src/ui/Modal.tsx
import type { ReactNode } from 'react';
import { CLOSE } from './styles';

export default function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="max-h-[85vh] w-[440px] overflow-auto rounded-lg border border-neutral-800 bg-neutral-900 p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">{title}</h2>
          <button className={CLOSE} onClick={onClose} aria-label="Close">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}
