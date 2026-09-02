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
import { useRoom } from './store';
import './webmcp';

export default function App() {
  const [ledgerOpen, setLedgerOpen] = useState(true);
  // The wizard lives here rather than inside the rooms menu, so the onboarding card can open
  // the same dialog without reaching across the top bar.
  const wizardOpen = useRoom((s) => s.ui.wizardOpen);
  const setWizardOpen = useRoom((s) => s.setWizardOpen);
  // The shell dialog is shared: the top bar and the room panel both open it through
  // `ui.dialog`, and it renders once, here.
  const dialog = useRoom((s) => s.ui.dialog);
  const closeDialog = useRoom((s) => s.closeDialog);
  const selectedItemId = useRoom((s) => s.ui.selectedItemId);
  const roomPanelOpen = useRoom((s) => s.ui.roomPanelOpen);
  const setRoomPanelOpen = useRoom((s) => s.setRoomPanelOpen);
  const proposalCount = useRoom((s) => s.rooms[s.currentId]!.proposals.length);
  return (
    <div className="flex h-full flex-col">
      <TopBar />
      <MetricChips />
      <SplitPane
        left={(
          /* Three columns, never a stack of overlays: whatever is open takes width from the
             plan instead of covering it, so the drawing is always whole. */
          <div className="flex h-full min-w-0">
            <CatalogDrawer />
            <div className="relative min-w-0 flex-1">
              <Plan />
              <Onboarding />
            </div>
            {/* One card at a time: the room's own numbers, or the selected piece's. Closed, the
                room card leaves a pill behind, and the Room button in the top bar brings it back. */}
            <div className="flex w-64 shrink-0 flex-col gap-2 overflow-y-auto border-l border-neutral-800 bg-neutral-950 p-2">
              {selectedItemId ? <Inspector /> : roomPanelOpen ? <RoomPanel /> : (
                <button
                  className="self-start rounded-full border border-neutral-800 bg-neutral-900 px-3 py-1 text-xs text-neutral-300 transition-colors hover:border-emerald-500 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                  title="Show the room's size, budget and needs"
                  onClick={() => setRoomPanelOpen(true)}
                >Room</button>
              )}
              <IssuesPanel />
            </div>
          </div>
        )}
        right={<Scene />}
      />
      {/* The tray earns its half of the bar only when there is something in it; empty, it is
          one line and the ledger runs the full width. */}
      <div className="flex shrink-0 flex-col border-t border-neutral-800">
        {proposalCount === 0 && (
          <p className="flex h-7 shrink-0 items-center border-b border-neutral-800 px-3 text-[11px] text-neutral-500">
            No proposals yet. Ask your agent for layout options and they will appear here as cards, with ghosts on the plan.
          </p>
        )}
        {proposalCount > 0 ? (
          <div className={`flex ${ledgerOpen ? 'h-48' : 'h-10'}`}>
            <div className="w-1/2 border-r border-neutral-800"><ProposalTray /></div>
            <div className="w-1/2"><Ledger open={ledgerOpen} onToggle={() => setLedgerOpen((o) => !o)} /></div>
          </div>
        ) : (
          <div className={ledgerOpen ? 'h-40' : 'h-10'}><Ledger open={ledgerOpen} onToggle={() => setLedgerOpen((o) => !o)} /></div>
        )}
      </div>
      {wizardOpen && <RoomWizard onClose={() => setWizardOpen(false)} />}
      {dialog === 'shell' && <ShellDialog onClose={closeDialog} />}
      <DevPanel />
    </div>
  );
}
