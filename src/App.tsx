// src/App.tsx
import TopBar from './ui/TopBar';
import MetricChips from './ui/MetricChips';
import SplitPane from './ui/SplitPane';
import DevPanel from './ui/DevPanel';
import './webmcp';

const Placeholder = ({ label }: { label: string }) => <div className="flex h-full items-center justify-center text-neutral-600">{label}</div>;

export default function App() {
  return (
    <div className="flex h-full flex-col">
      <TopBar />
      <MetricChips />
      <SplitPane left={<Placeholder label="Plan (Task 16)" />} right={<Placeholder label="3D (Task 19)" />} />
      <div className="h-48 border-t border-neutral-800"><Placeholder label="Proposals and ledger (Task 18)" /></div>
      <DevPanel />
    </div>
  );
}
