// src/webmcp/index.ts
import { useEffect, useState } from 'react';
import { installWebMCP } from './install';
import { roomStore } from '../store';

export const webmcp = installWebMCP(roomStore);

export function useRegistryVersion(): number {
  const [v, setV] = useState(0);
  useEffect(() => webmcp.registry.onChange(() => setV((x) => x + 1)), []);
  return v;
}
