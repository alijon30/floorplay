// src/App.tsx
import { useState } from 'react';
import TopBar from './ui/TopBar';
import MetricChips from './ui/MetricChips';
import SplitPane from './ui/SplitPane';
import DevPanel from './ui/DevPanel';
import Plan from './plan/Plan';
import Scene from './three/Scene';
import CatalogDrawer from './ui/CatalogDrawer';
import Inspector from './ui/Inspector';
import RoomPanel from './ui/RoomPanel';
import IssuesPanel from './ui/IssuesPanel';
import ProposalTray from './ui/ProposalTray';
import Ledger from './ui/Ledger';
import Onboarding from './ui/Onboarding';
import RoomWizard from './ui/RoomWizard';
import ShellDialog from './ui/ShellDialog';
import BriefDialog from './ui/BriefDialog';
import { useRoom } from './store';
import './webmcp';

export default function App() {
  const [ledgerOpen, setLedgerOpen] = useState(true);
  // The wizard lives here rather than inside the rooms menu, so the onboarding card can open
  // the same dialog without reaching across the top bar.
  const wizardOpen = useRoom((s) => s.ui.wizardOpen);
  const setWizardOpen = useRoom((s) => s.setWizardOpen);
  // The shell and brief dialogs are shared: the top bar and the room panel both open them
  // through `ui.dialog`, and they render once, here.
  const dialog = useRoom((s) => s.ui.dialog);
  const closeDialog = useRoom((s) => s.closeDialog);
  const selectedItemId = useRoom((s) => s.ui.selectedItemId);
  return (
    <div className="flex h-full flex-col">
      <TopBar />
      <MetricChips />
      <SplitPane
        left={(
          <div className="relative h-full">
            <Plan />
            <CatalogDrawer />
            <Onboarding />
            {/* One card at a time: the room's own numbers, or the selected piece's. */}
            <div className="absolute right-3 top-3 z-20 flex max-h-[calc(100%-1.5rem)] w-64 flex-col gap-2 overflow-auto">
              {selectedItemId ? <Inspector /> : <RoomPanel />}
              <IssuesPanel />
            </div>
          </div>
        )}
        right={<Scene />}
      />
      <div className={`flex border-t border-neutral-800 ${ledgerOpen ? 'h-48' : 'h-10'}`}>
        {ledgerOpen && <div className="w-1/2 border-r border-neutral-800"><ProposalTray /></div>}
        <div className={ledgerOpen ? 'w-1/2' : 'w-full'}><Ledger open={ledgerOpen} onToggle={() => setLedgerOpen((o) => !o)} /></div>
      </div>
      {wizardOpen && <RoomWizard onClose={() => setWizardOpen(false)} />}
      {dialog === 'shell' && <ShellDialog onClose={closeDialog} />}
      {dialog === 'brief' && <BriefDialog onClose={closeDialog} />}
      <DevPanel />
    </div>
  );
}
