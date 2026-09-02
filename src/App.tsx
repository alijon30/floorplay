// src/App.tsx
import TopBar from './ui/TopBar';
import ToolRail from './ui/ToolRail';
import StatusStrip from './ui/StatusStrip';
import SplitPane from './ui/SplitPane';
import DevPanel from './ui/DevPanel';
import Plan from './plan/Plan';
import Scene from './three/Scene';
import CatalogDrawer from './ui/CatalogDrawer';
import PropertiesPanel from './ui/PropertiesPanel';
import ProposalStrip from './ui/ProposalStrip';
import Ledger from './ui/Ledger';
import Onboarding from './ui/Onboarding';
import RoomWizard from './ui/RoomWizard';
import ShellDialog from './ui/ShellDialog';
import { useRoom } from './store';
import './webmcp';

/**
 * The workspace: a title bar, a rail of tools, two viewports, a properties column, and a
 * rule of numbers along the bottom.
 *
 * Nothing floats over the drawing except the things that are about the drawing — the agent's
 * proposals and the first-run card. Every panel takes its width from the viewports instead of
 * covering them, which is what keeps the plan whole however much is open.
 */
export default function App() {
  // The wizard lives here rather than inside the rooms menu, so the onboarding card can open
  // the same dialog without reaching across the top bar.
  const wizardOpen = useRoom((s) => s.ui.wizardOpen);
  const setWizardOpen = useRoom((s) => s.setWizardOpen);
  // The shell dialog is shared: the rail and the room panel both open it through `ui.dialog`,
  // and it renders once, here.
  const dialog = useRoom((s) => s.ui.dialog);
  const closeDialog = useRoom((s) => s.closeDialog);
  const propertiesOpen = useRoom((s) => s.ui.roomPanelOpen);

  return (
    <div className="flex h-full flex-col bg-bg text-fg">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <ToolRail />
        <CatalogDrawer />
        <div className="min-w-0 flex-1">
          <SplitPane
            left={(
              <div className="relative h-full w-full">
                <Plan />
                <ProposalStrip />
                <Onboarding />
              </div>
            )}
            right={<Scene />}
          />
        </div>
        {propertiesOpen && <PropertiesPanel />}
      </div>
      <Ledger />
      <StatusStrip />
      {wizardOpen && <RoomWizard onClose={() => setWizardOpen(false)} />}
      {dialog === 'shell' && <ShellDialog onClose={closeDialog} />}
      <DevPanel />
    </div>
  );
}
