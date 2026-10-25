import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative asset paths: the same dist/ works on Netlify, on a subpath and opened from a folder.
  base: './',
  build: { target: 'es2022' },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
