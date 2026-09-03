// src/elevation/RightViewport.tsx
import { useRoom } from '../store';
import Scene from '../three/Scene';
import Elevation from './Elevation';

/**
 * Whichever of the two the right pane is showing.
 *
 * A thin switch rather than a tab strip of its own: both views fill the same pane and carry
 * the same toggle in their toolbar, so this only has to decide which one mounts.
 */
export default function RightViewport() {
  const rightView = useRoom((s) => s.ui.rightView);
  return rightView === 'wall' ? <Elevation /> : <Scene />;
}
