import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  base: process.env.BASE_PATH || '/',
  plugins: [react()],
  server: {
    port: 3273,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    // `.worktrees/**` holds sibling git worktrees, each with its own
    // node_modules and src — without this, a run from the main checkout picks
    // up their tests (and their dependencies' bundled tests) and fails.
    exclude: ['e2e/**', 'node_modules/**', '.worktrees/**'],
  },
});
