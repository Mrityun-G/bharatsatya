import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/tests/acceptance.test.ts'],
    setupFiles: ['./src/tests/acceptance.setup.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
