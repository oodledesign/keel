import { defineConfig } from 'tsup';

export default defineConfig((options) => ({
  entry: ['src/index.ts'],
  outDir: 'build',
  target: 'es2024',
  dts: false,
  clean: true,
  format: ['cjs'],
  ...options,
}));
