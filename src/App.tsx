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
import IssuesPanel from './ui/IssuesPanel';
import ProposalTray from './ui/ProposalTray';
import Ledger from './ui/Ledger';
import Onboarding from './ui/Onboarding';
import './webmcp';

export default function App() {
  const [ledgerOpen, setLedgerOpen] = useState(true);
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
            <div className="absolute right-3 top-3 z-20 flex max-h-[calc(100%-1.5rem)] w-64 flex-col gap-2">
              <Inspector />
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
      <DevPanel />
    </div>
  );
}
