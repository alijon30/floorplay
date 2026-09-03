// src/ui/StylePopover.tsx
import { useEffect, useMemo, type RefObject } from 'react';
import { useRoom } from '../store';
import { FLOOR_LABEL, FLOOR_SWATCH } from '../finishes';
import { WALL_SWATCHES, suggestPalettes, type Palette } from '../engine/palette';
import { FLOOR_FINISHES, type FloorFinish, type Op } from '../engine/types';
import WallPalettePanel from '../elevation/WallPalettePanel';
import { Icon } from './icons';
import { BTN_SM, BTN_SM_ON, CARD, CLOSE, LABEL, TITLE } from './styles';

const SCHEME_BLURB: Record<Palette['name'], string> = {
  warm: 'Earth tones: sand and terracotta.',
  cool: 'Blues, greys and a cool light.',
  neutral: 'One strong wall, everything else quiet.',
};

/**
 * Wall paint, floor material and three whole-room schemes, beside the rail's Style button.
 *
 * `anchorRef` wraps both the button and this panel, so clicking the button toggles it instead
 * of racing the outside-click close, exactly as the help popover does.
 */
export default function StylePopover({ onClose, anchorRef, position = 'right-0 mt-1' }: { onClose: () => void; anchorRef: RefObject<HTMLElement | null>; position?: string }) {
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
    <div role="dialog" aria-label="Style" className={`absolute z-40 max-h-[76vh] w-[288px] overflow-auto p-3 ${position} ${CARD}`}>
      <div className="mb-2.5 flex items-center justify-between">
        <strong className={TITLE}>Style</strong>
        <button className={CLOSE} onClick={onClose} aria-label="Close"><Icon name="close" size={13} /></button>
      </div>

      <strong className={`block ${LABEL}`}>Walls</strong>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {WALL_SWATCHES.map((s) => (
          <button
            key={s.hex}
            title={`${s.name} ${s.hex}`}
            aria-label={`Wall ${s.name}`}
            aria-pressed={room.finish.wall === s.hex}
            onClick={() => setWall(s.hex)}
            className={`h-[22px] w-[22px] rounded-[3px] transition-shadow focus-visible:outline-none ${room.finish.wall === s.hex ? 'ring-2 ring-accent ring-offset-2 ring-offset-panel' : 'ring-1 ring-line hover:ring-[var(--line-hi)]'}`}
            style={{ background: s.hex }}
          />
        ))}
      </div>

      <WallPalettePanel />

      <strong className={`mt-3.5 block ${LABEL}`}>Floor</strong>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {FLOOR_FINISHES.map((f) => (
          <button
            key={f}
            aria-pressed={room.finish.floor === f}
            onClick={() => setFloor(f)}
            className={room.finish.floor === f ? BTN_SM_ON : BTN_SM}
          >
            <span className="h-3 w-3 rounded-[2px] ring-1 ring-black/25" style={{ background: FLOOR_SWATCH[f] }} />
            {FLOOR_LABEL[f]}
          </button>
        ))}
      </div>

      <strong className={`mt-3.5 block ${LABEL}`}>Schemes</strong>
      <p className="mt-1 text-[11px] text-muted">Read from what is already in the room.</p>
      <div className="mt-1.5 space-y-1.5">
        {palettes.map((p) => (
          <div key={p.name} className="rounded-md border border-line bg-raised p-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <span className="h-4 w-4 rounded-[3px] ring-1 ring-black/25" style={{ background: p.wall }} />
                <span className="h-4 w-4 rounded-[3px] ring-1 ring-black/25" style={{ background: FLOOR_SWATCH[p.floor] }} />
                {p.accents.map((a) => <span key={a} className="h-4 w-4 rounded-full ring-1 ring-black/25" style={{ background: a }} />)}
              </div>
              <button className={BTN_SM_ON} onClick={() => applyPalette(p)}>Apply</button>
            </div>
            <div className="mt-1.5 text-[12px] capitalize text-fg">{p.name}</div>
            <div className="text-[11px] leading-snug text-muted">{SCHEME_BLURB[p.name]} {FLOOR_LABEL[p.floor]} floor{p.recolor.length ? `, repaints ${p.recolor.length}` : ''}.</div>
          </div>
        ))}
      </div>
    </div>
  );
}
