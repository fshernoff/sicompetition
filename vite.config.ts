import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative asset paths: the same dist/ works on Netlify, on a subpath and opened from a folder.
  base: './',
  build: { target: 'es2022' },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // The lesson tests put real plans to work in the engine (one runs all 150,000 weeks); the default 5 s is the
    // Mac's margin, not a CI runner's (the deploy of Nov 12 timed out on tests/lesson/materials.test.ts).
    testTimeout: 30_000,
  },
});
