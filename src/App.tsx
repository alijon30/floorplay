// src/App.tsx
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
import './webmcp';

export default function App() {
  return (
    <div className="flex h-full flex-col">
      <TopBar />
      <MetricChips />
      <SplitPane
        left={(
          <div className="relative h-full">
            <Plan />
            <CatalogDrawer />
            <div className="absolute right-3 top-3 z-20 flex max-h-[calc(100%-1.5rem)] w-64 flex-col gap-2">
              <Inspector />
              <IssuesPanel />
            </div>
          </div>
        )}
        right={<Scene />}
      />
      <div className="flex h-48 border-t border-neutral-800">
        <div className="w-1/2 border-r border-neutral-800"><ProposalTray /></div>
        <div className="w-1/2"><Ledger /></div>
      </div>
      <DevPanel />
    </div>
  );
}
