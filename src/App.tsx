// src/App.tsx
import DevPanel from './ui/DevPanel';
import AgentChip from './ui/AgentChip';
import { APP_NAME } from './config';
import './webmcp';

export default function App() {
  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-neutral-800 px-4 py-2">
        <div className="text-lg font-semibold">{APP_NAME}</div>
        <AgentChip />
      </header>
      <main className="flex-1 p-4 text-neutral-400">Plan and 3D view arrive in Tasks 15 to 19. Press Ctrl+Shift+D (Cmd+Shift+D on macOS) for the WebMCP dev panel.</main>
      <DevPanel />
    </div>
  );
}
