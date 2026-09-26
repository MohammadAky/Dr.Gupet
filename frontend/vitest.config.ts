import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Unit tests cover pure logic (formatters, schemas, filters, session helpers).
    // Component tests can switch this per-file when they need a DOM.
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    globals: false,
    pool: 'threads',
  },
});
