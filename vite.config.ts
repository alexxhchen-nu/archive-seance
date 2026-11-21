import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import { cpSync } from 'node:fs';
import { resolve } from 'node:path';

// Copies pdf.js font, CMap and wasm data (with their LICENSE_* files) into <outDir>/pdfjs/ after the
// bundle is written, so emptyOutDir cannot remove them. The files are not committed to git.
function copyPdfjsData(outDir: string): Plugin {
  return {
    name: 'copy-pdfjs-data',
    apply: 'build',
    writeBundle() {
      for (const dir of ['standard_fonts', 'cmaps', 'wasm']) {
        cpSync(resolve(import.meta.dirname, 'node_modules/pdfjs-dist', dir), resolve(outDir, 'pdfjs', dir), { recursive: true });
      }
    }
  };
}

// MV3 build: HTML entry for the app page + a module service worker.
// `--mode mock` builds the same extension with a scripted Firebase AI Logic layer (dist-mock/).
export default defineConfig(({ mode }) => {
  const outDir = resolve(import.meta.dirname, mode === 'mock' ? 'dist-mock' : 'dist');
  return {
  plugins: [copyPdfjsData(outDir)],
  root: 'src',
  publicDir: resolve(import.meta.dirname, 'public'),
  envDir: import.meta.dirname,
  base: './',
  build: {
    outDir,
    emptyOutDir: true,
    target: 'es2022',
    sourcemap: false,
    rollupOptions: {
      input: {
        'app/index': resolve(import.meta.dirname, 'src/app/index.html'),
        'background/sw': resolve(import.meta.dirname, 'src/background/sw.ts')
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]'
      }
    }
  }
};
});
