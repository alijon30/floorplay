/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// WebMCP exposes document.modelContext only on origin-isolated documents, so both the dev
// server and the preview server must send Origin-Agent-Cluster. Production uses vercel.json.
const isolationHeaders = { 'Origin-Agent-Cluster': '?1', 'Permissions-Policy': 'tools=(self)' };

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { headers: isolationHeaders },
  preview: { headers: isolationHeaders },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
