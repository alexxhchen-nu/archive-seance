import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// MV3 build: HTML entry for the app page + a module service worker.
// `--mode mock` builds the same extension with a scripted Firebase AI Logic layer (dist-mock/).
export default defineConfig(({ mode }) => ({
  root: 'src',
  publicDir: resolve(__dirname, 'public'),
  envDir: __dirname,
  base: './',
  build: {
    outDir: resolve(__dirname, mode === 'mock' ? 'dist-mock' : 'dist'),
    emptyOutDir: true,
    target: 'es2022',
    sourcemap: false,
    rollupOptions: {
      input: {
        'app/index': resolve(__dirname, 'src/app/index.html'),
        'background/sw': resolve(__dirname, 'src/background/sw.ts')
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]'
      }
    }
  }
}));
