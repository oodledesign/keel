import path from 'node:path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '~/home': path.resolve(__dirname, 'app/home'),
      '~/lib': path.resolve(__dirname, 'lib'),
      '~/config': path.resolve(__dirname, 'config'),
      '~/components': path.resolve(__dirname, 'components'),
      'server-only': path.resolve(__dirname, 'vitest.server-only.stub.ts'),
    },
  },
});
