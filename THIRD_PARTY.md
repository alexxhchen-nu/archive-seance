# Third-party software

Runtime dependencies are bundled into the extension build. Dev dependencies are not shipped.
See `package.json` and `package-lock.json` for exact versions. Licenses below are the `license` field of each installed package.

## Runtime (bundled)

| Package | Use | License |
|---|---|---|
| firebase | Firebase AI Logic (hybrid inference), App Check | Apache-2.0 |
| pdfjs-dist | PDF parsing and text extraction; its worker is bundled locally (no CDN) | Apache-2.0 |
| d3 | Force-directed graph view (pinned; not imported yet) | ISC |

### pdf.js data files copied at build time

The Vite build copies three folders from `node_modules/pdfjs-dist` into `<outDir>/pdfjs/` (they are not
committed to this repository). We do not relicense them; each keeps the license shipped next to it:

- `standard_fonts/`: Foxit and Liberation fonts (see `LICENSE_FOXIT` and `LICENSE_LIBERATION` in that folder).
- `cmaps/`: Adobe CMap resources, distributed with pdfjs-dist.
- `wasm/`: OpenJPEG, JBIG2, QCMS and QuickJS builds (see the `LICENSE_*` files in that folder).

## Development only (not shipped)

| Package | License |
|---|---|
| typescript | Apache-2.0 |
| playwright-core | Apache-2.0 |
| vite, vitest, fast-check, jsdom | MIT |
| eslint, @eslint/js, typescript-eslint, globals | MIT |
| @types/chrome | MIT |
| fake-indexeddb (unit tests) | Apache-2.0 |
