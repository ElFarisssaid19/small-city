import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Served from https://<user>.github.io/small-city/
  base: '/small-city/',
  build: {
    target: 'es2022',
    // three.js and its GLTF loader are most of the bundle (~600 of ~710 kB minified).
    chunkSizeWarningLimit: 800,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    // The simulation is DOM-free, so tests run in plain Node.
    environment: 'node',
  },
});
