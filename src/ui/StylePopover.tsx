// src/ui/StylePopover.tsx
import { useEffect, useMemo, type RefObject } from 'react';
import { useRoom } from '../store';
import { FLOOR_LABEL, FLOOR_SWATCH } from '../finishes';
import { WALL_SWATCHES, suggestPalettes, type Palette } from '../engine/palette';
import { FLOOR_FINISHES, type FloorFinish, type Op } from '../engine/types';
import { BTN_SM_ON, CARD, CLOSE, LABEL, ROW } from './styles';

const SCHEME_BLURB: Record<Palette['name'], string> = {
  warm: 'Earth tones: sand and terracotta.',
  cool: 'Blues, greys and a cool light.',
  neutral: 'One strong wall, everything else quiet.',
};

/**
 * Wall paint, floor material and three whole-room schemes, under the top bar's "Style" button.
 *
 * `anchorRef` wraps both the button and this panel, so clicking the button toggles it instead
 * of racing the outside-click close, exactly as the help popover does.
 */
export default function StylePopover({ onClose, anchorRef }: { onClose: () => void; anchorRef: RefObject<HTMLElement | null> }) {
  const room = useRoom((s) => s.rooms[s.currentId]!);
  const dispatch = useRoom((s) => s.dispatch);
  const palettes = useMemo(() => suggestPalettes(room), [room]);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const el = anchorRef.current;
      if (el && !el.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose, anchorRef]);

  const setWall = (wall: string) => dispatch({ actor: 'human', ops: [{ type: 'setFinish', finish: { ...room.finish, wall } }] });
  const setFloor = (floor: FloorFinish) => dispatch({ actor: 'human', ops: [{ type: 'setFinish', finish: { ...room.finish, floor } }] });

  /**
   * A scheme is one decision, so its wall, its floor and every repaint land as a single
   * ledger entry. Undo takes the room back to how it looked before, in one press.
   */
  const applyPalette = (p: Palette) => {
    const ops: Op[] = [
      { type: 'setFinish', finish: { wall: p.wall, floor: p.floor } },
      ...p.recolor.map((r): Op => ({ type: 'recolor', id: r.id, color: r.color })),
    ];
    dispatch({ actor: 'human', ops, summary: `Applied ${p.name} palette` });
  };

  return (
    <div role="dialog" aria-label="Style" className={`absolute right-0 z-30 mt-1 max-h-[70vh] w-72 overflow-auto p-3 text-xs shadow-2xl ${CARD}`}>
      <div className="mb-2 flex items-center justify-between">
        <strong className="text-sm">Style</strong>
        <button className={CLOSE} onClick={onClose} aria-label="Close">×</button>
      </div>

      <strong className={`block ${LABEL}`}>Walls</strong>
      <div className="mt-1 grid grid-cols-4 gap-2">
        {WALL_SWATCHES.map((s) => (
          <button
            key={s.hex}
            title={`${s.name} ${s.hex}`}
            aria-label={`Wall ${s.name}`}
            aria-pressed={room.finish.wall === s.hex}
            onClick={() => setWall(s.hex)}
            className={`h-8 w-full rounded ring-offset-2 ring-offset-neutral-900 focus-visible:outline-none ${room.finish.wall === s.hex ? 'ring-2 ring-emerald-400' : 'ring-1 ring-neutral-700 hover:ring-neutral-400'}`}
            style={{ background: s.hex }}
          />
        ))}
      </div>

      <strong className={`mt-3 block ${LABEL}`}>Floor</strong>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {FLOOR_FINISHES.map((f) => (
          <button
            key={f}
            aria-pressed={room.finish.floor === f}
            onClick={() => setFloor(f)}
            className={`inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${room.finish.floor === f ? 'border-emerald-500 text-emerald-300' : 'border-neutral-700 text-neutral-300 hover:border-emerald-500'}`}
          >
            <span className="h-3.5 w-3.5 rounded-sm" style={{ background: FLOOR_SWATCH[f] }} />
            {FLOOR_LABEL[f]}
          </button>
        ))}
      </div>

      <strong className={`mt-3 block ${LABEL}`}>Suggest palettes</strong>
      <p className="mt-1 text-neutral-500">Read from what is already in the room.</p>
      <div className="mt-1 space-y-1.5">
        {palettes.map((p) => (
          <div key={p.name} className={`p-2 ${ROW}`}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <span className="h-4 w-4 rounded-sm ring-1 ring-neutral-700" style={{ background: p.wall }} />
                <span className="h-4 w-4 rounded-sm ring-1 ring-neutral-700" style={{ background: FLOOR_SWATCH[p.floor] }} />
                {p.accents.map((a) => <span key={a} className="h-4 w-4 rounded-full ring-1 ring-neutral-700" style={{ background: a }} />)}
              </div>
              <button className={BTN_SM_ON} onClick={() => applyPalette(p)}>Apply</button>
            </div>
            <div className="mt-1 capitalize text-neutral-300">{p.name}</div>
            <div className="text-neutral-500">{SCHEME_BLURB[p.name]} {FLOOR_LABEL[p.floor]} floor{p.recolor.length ? `, repaints ${p.recolor.length}` : ''}.</div>
          </div>
        ))}
      </div>
    </div>
  );
}
