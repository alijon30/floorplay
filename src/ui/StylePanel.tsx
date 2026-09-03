// src/ui/StylePanel.tsx
import { useEffect, useMemo, useState } from 'react';
import { useRoom } from '../store';
import { FLOOR_LABEL, FLOOR_SWATCH } from '../finishes';
import { suggestPalettes, type Palette } from '../engine/palette';
import { WALL_PALETTES } from '../engine/wallPalettes';
import { wallColor, withAllWallsColor, withWallColor } from '../engine/wallColor';
import type { FloorFinish, Op } from '../engine/types';
import WallPicker, { type PaintTarget } from './style/WallPicker';
import { wallLabel } from '../engine/wallNames';
import RegionPalette from './style/RegionPalette';
import FloorTiles from './style/FloorTiles';
import { BTN_SM_ON, LABEL } from './styles';

const SCHEME_BLURB: Record<Palette['name'], string> = {
  warm: 'Earth tones: sand and terracotta.',
  cool: 'Blues, greys and a cool light.',
  neutral: 'One strong wall, everything else quiet.',
};

/**
 * The Style tab of the properties column: which wall, what colour, what floor, what scheme.
 *
 * It reads top to bottom as the decision actually goes — you pick the surface before you pick
 * the paint — which is why the wall picker comes first and everything under it acts on
 * whatever it has selected. The old fly-out could not do that: a popover has no room for a
 * plan of the room, so it had to name walls in words and hope you knew which was which.
 */
export default function StylePanel() {
  const room = useRoom((s) => s.rooms[s.currentId]!);
  const dispatch = useRoom((s) => s.dispatch);
  const setHighlightWall = useRoom((s) => s.setHighlightWall);
  const palettes = useMemo(() => suggestPalettes(room), [room]);
  const [target, setTarget] = useState<PaintTarget>('all');
  const [regionKey, setRegionKey] = useState(WALL_PALETTES[0]!.key);

  const activeHex = target === 'all' ? room.finish.wall : wallColor(room, target);

  const pickTarget = (t: PaintTarget) => setTarget(t);

  // The plan and the 3D view point at whatever this tab is painting, so nobody has to hold
  // "right wall" in their head while looking at a room. Cleared when the tab goes away.
  useEffect(() => {
    setHighlightWall(target === 'all' ? null : target);
    return () => setHighlightWall(null);
  }, [target, setHighlightWall]);

  const paint = (hex: string, name: string) => {
    const finish = target === 'all' ? withAllWallsColor(room.finish, hex) : withWallColor(room.finish, target, hex);
    const where = target === 'all' ? 'every wall' : `the ${wallLabel(room, target).toLowerCase()}`;
    dispatch({ actor: 'human', ops: [{ type: 'setFinish', finish }], summary: `Painted ${where} ${name}` });
  };

  const setFloor = (floor: FloorFinish) =>
    dispatch({ actor: 'human', ops: [{ type: 'setFinish', finish: { ...room.finish, floor } }] });

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
    <div className="flex flex-col gap-3 p-3">
      <section>
        <div className={`mb-2 ${LABEL}`}>Walls</div>
        <WallPicker room={room} target={target} onTarget={pickTarget} />
      </section>

      <section className="border-t border-line pt-3">
        <div className={`mb-2 ${LABEL}`}>Region</div>
        <RegionPalette regionKey={regionKey} onRegion={setRegionKey} activeHex={activeHex} onPick={paint} />
      </section>

      <section className="border-t border-line pt-3">
        <div className={`mb-2 ${LABEL}`}>Floor</div>
        <FloorTiles floor={room.finish.floor} onFloor={setFloor} />
      </section>

      <section className="border-t border-line pt-3">
        <div className={`mb-1 ${LABEL}`}>Schemes</div>
        <p className="mb-2 text-[11px] text-muted">Read from what is already in the room.</p>
        <div className="space-y-1.5">
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
      </section>
    </div>
  );
}
