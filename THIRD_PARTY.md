# Third-party software

Runtime dependencies are bundled into the extension build. Dev dependencies are not shipped.
See `package.json` and `package-lock.json` for exact versions. Licenses below are the `license` field of each installed package.

## Runtime (bundled)

| Package | Use | License |
|---|---|---|
| firebase | Firebase AI Logic (hybrid inference), App Check | Apache-2.0 |
| pdfjs-dist | PDF parsing and text extraction; its worker is bundled locally (no CDN) | Apache-2.0 |
| d3 | Force-directed graph view (pinned; not imported yet) | ISC |

## Development only (not shipped)

| Package | License |
|---|---|
| typescript | Apache-2.0 |
| playwright-core | Apache-2.0 |
| vite, vitest, fast-check, jsdom | MIT |
| eslint, @eslint/js, typescript-eslint, globals | MIT |
| @types/chrome | MIT |
