// src/elevation/ViewToggle.tsx
import { useRoom } from '../store';
import { SEG, SEG_ITEM, SEG_ITEM_ON } from '../ui/styles';

/**
 * The right viewport's own switch: the room in 3D, or one wall drawn straight on.
 *
 * It lives in both toolbars rather than above the pane, so neither view loses height to it and
 * the control is in the same place whichever one you are looking at.
 */
export default function ViewToggle() {
  const rightView = useRoom((s) => s.ui.rightView);
  const setRightView = useRoom((s) => s.setRightView);
  return (
    <div className={SEG} role="group" aria-label="Right viewport">
      <button
        className={rightView === '3d' ? SEG_ITEM_ON : SEG_ITEM}
        aria-pressed={rightView === '3d'}
        title="See the room in 3D"
        onClick={() => setRightView('3d')}
      >3D</button>
      <button
        className={rightView === 'wall' ? SEG_ITEM_ON : SEG_ITEM}
        aria-pressed={rightView === 'wall'}
        title="Draw one wall straight on, to hang things on it"
        onClick={() => setRightView('wall')}
      >Wall</button>
    </div>
  );
}
