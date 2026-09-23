import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Served from https://<user>.github.io/small-city/
  base: '/small-city/',
  build: {
    target: 'es2022',
    // three.js alone is most of the bundle (~560 kB minified, ~145 kB gzipped).
    chunkSizeWarningLimit: 700,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    // The simulation is DOM-free, so tests run in plain Node.
    environment: 'node',
  },
});
