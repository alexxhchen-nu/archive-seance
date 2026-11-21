# Work log

Dated running log, newest entry first, one entry per pull request. Times are America/Chicago.
"Grok Workhorse" means the coding worker run through Kilo (`user-workhorse`, profile `default`). "Grok Bot" means the supervising assistant working for Alex. "Alex" means Alex Chen, who reviews and merges every PR.

---

## 2026-11-21 — PR #3: T11–T14 PDF pipeline, demo sources, prior art (open, not merged)

- **PR:** https://github.com/alexxhchen-nu/archive-seance/pull/3 (branch `t11-t14-pdf-pipeline`, from `0668c3c`).
- **What was done**
  - T11: the design section 4 types, the three message types, `PAIR_LABEL_SCHEMA` and `VERDICT_SCHEMA`, and hand-written validators (`src/ai/validateSchema.ts`, `src/ai/validators.ts`). They return path-bearing errors, accept an object or a JSON string, and never throw.
  - T12: `src/pdf/loadPdf.ts` (file and URL loading, 50 MB limit checked before reading and while streaming, `%PDF-` header check, per-origin host-permission flow that never calls `fetch` without permission), `src/util/hash.ts` (SHA-256), `src/pdf/openPdf.ts` (pdf.js with the worker bundled locally under `dist/assets`), and an "Open local PDF" panel with the "Allow access to <origin>" button.
  - T13: `src/pdf/pageIndex.ts` (`itemOffsets` with one entry per text item, ligature expansion, whitespace normalization, `no-text` pages flagged and never dropped). Two synthetic fixture PDFs made by `scripts/make-fixtures.mjs` (made-up text, one page with no text layer).
  - T14: `src/pdf/chunker.ts` (`Intl.Segmenter`, greedy packing to `routeLocalMaxChunkChars`, hard split for over-long sentences, never crosses a page) with fast-check property tests.
  - Config gained `maxPdfMegabytes` (50), `maxPdfPages` (500) and `minTextCharsPerPage` (40).
  - The app page shows `Pages: N`, `Chunks: M`, a hash prefix, and `Page N: This page looks scanned (no text layer)` for no-text pages. e2e gained `pdf:` checks that load both fixtures through the file input in the mock and real builds.
  - T06 closed: `docs/DEMO_SOURCES.md` (NHPRC 2015-11 minutes, 8 pages; ACHP February 2026 minutes, 15 pages; both US federal works in the public domain under 17 U.S.C. § 105) and `docs/PRIOR_ART.md`. THIRD_PARTY.md now lists `pdfjs-dist` and `d3` and the dev dependencies.
  - Spec wording changed per Alex's answers of 2026-11-21: `requirements.md` R13.2 and the T06 line in `tasks.md` used to say the Zenodo preprint is "cited only for ideas". They now say the author's own preprint is not used as a reference or a source of ideas, that no external papers or projects were used, and that there are no exceptions. `design.md` Q6 still mentions "the Zenodo problem" as a user-need question; it was not changed (see open items).
  - `tasks.md`: T06, T11, T12, T13, T14 ticked.
- **Demo sources picked (T06):** Alex picked both on 2026-11-21 (see `docs/DEMO_SOURCES.md`). The PDFs are not committed. As a one-off check, not a committed test, both local copies were run through `openPdf`, `buildPageIndex` and `chunkPages` in Node: NHPRC 8 pages, ACHP 15 pages, every page `ok`.
- **Tests and results**
  - Working clone: typecheck, lint, build, `build:mock`, `check:secrets`, `check:bundle-rhc` pass; `npm test` 119/119 in 20 files (36 existing plus 83 new); `npm run e2e` 35/35 (17 existing plus 18 new `pdf:` checks).
  - Fixture counts (asserted by tests): `harbor-lantern-minutes.pdf` 3 pages, 3 chunks at 6000 and 5 at 400; `mixed-scanned.pdf` 3 pages, page 2 `no-text`, 2 chunks.
  - Fresh-clone results and the GitHub CI result are in the PR description.
- **Who:** the code, tests and fixtures were written by Grok Workhorse via Kilo (task `wh-20261121-093837-af15`, verdict `success`; it could not run `npm ci` or Chromium in its sandbox). Grok Bot wrote the brief, reviewed the diff, ran the full verification including e2e, split the commits, wrote the docs, and opened the PR. Alex picked the demo sources and gave the prior-art answers.
- **Open items**
  - Real Chrome has not exercised the permission button, `?src=` URL loading of a remote PDF, or the toolbar flow (R1.1, R1.3). Unit tests use fakes; headless Chromium cannot answer the permission prompt.
  - R2.4 (index kept in IndexedDB and `chrome.storage.local`, keyed by hash) is not part of T11–T14 and is not implemented; the index is in memory only.
  - pdf.js logs "Ensure that the `standardFontDataUrl` API parameter is provided" in Node tests. Font, cMap and wasm data are not bundled; some PDFs with non-embedded or CJK fonts may extract less text. Not seen on the two demo PDFs.
  - Whether the manifest still needs `wasm-unsafe-eval` for pdf.js is untested (the e2e passes with the current manifest).
  - `design.md` Q6 wording ("the Zenodo problem") may need a decision from Alex.
  - T05 (on-device test), T08 (Kiro run) and T09 are still open.

---

## 2026-11-21 — Real cloud verification (no PR; recorded in PR #2's `docs/SPIKE_RESULTS.md` and PR #3 context)

- **What was done:** after Alex enforced App Check for Firebase AI Logic in the console, the cloud calls were run again against the real project `archive-seance` (model `gemini-3.5-flash-lite`, App Check debug token registered). `ONLY_IN_CLOUD` and hybrid (no Gemini Nano on the box) both returned the badge **"Ran in cloud"**, with no errors. Each call took 1.6 to 2.3 seconds (as reported at the time).
- **Tests and results:** manual run of the built extension, 2 of 2 modes returned "Ran in cloud" with enforcement on. Before the debug token was registered, the same calls got HTTP 403 from App Check.
- **Who:** Alex enforced App Check and registered the debug token in the Firebase console. Grok Bot ran the calls and read the badges.
- **Open items:** the on-device path (`ONLY_ON_DEVICE`, hybrid with Nano) is not tested (T05); VERIFY-1, VERIFY-2, VERIFY-4 and the CSP question are still open.

---

## 2026-11-21 — PR #2: T02/T07 ESLint, CI, spike results (merged 09:34)

- **PR:** https://github.com/alexxhchen-nu/archive-seance/pull/2
- **What was done:** ESLint flat config and `npm run lint`; exact version pins for eslint, `@eslint/js`, `typescript-eslint`, `globals`, `pdfjs-dist` 6.5.438 and `d3` 7.9.2; GitHub Actions CI (typecheck, lint, test, build, `check:secrets`, `check:bundle-rhc`) with SHA-pinned actions; `docs/SPIKE_RESULTS.md` (cloud path only); T02, T03 and T07 ticked. After the first CI run failed on Node 20 (undici breaks in vitest), CI and `engines` were moved to Node 24 and CI went green.
- **Tests and results:** fresh clone: `npm ci`, typecheck, lint, 36/36 tests, build, `build:mock` plus e2e 17/17, `check:secrets`, `check:bundle-rhc` all passed. GitHub CI green on Node 24 after the fix.
- **Who:** Grok Bot finished and shipped it. Grok Workhorse via Kilo (task `wh-20261121-092422-5032`) started it but parked as `blocked`: its sandbox has no network, so it could not update `package-lock.json` or run lint; that task was closed by the supervisor. Alex reviewed and merged.
- **Open items:** T05 on-device results pending; no real-Chrome load-unpacked test of T03.

---

## 2026-11-21 — PR #1: T01 skeleton and hybrid call (merged 09:13)

- **PR:** https://github.com/alexxhchen-nu/archive-seance/pull/1
- **What was done:** repo skeleton, MV3 manifest, service worker (toolbar click opens the app page with `?src=`), app page; Firebase AI Logic hybrid probe in `src/ai/` (`initFirebase` order: app, App Check, AI; `makeModel`, `callModel` recording `inferenceSource`, fail-closed `assertModeHonored`); mock build (`build:mock`) with a MOCK banner; `check:secrets` and `check:bundle-rhc`; `/.kiro` committed; bilingual README; Apache-2.0 LICENSE and NOTICE; the two Google agent-guidance skills under `.agents/skills`.
- **Tests and results:** 36 unit and property tests passed; e2e 17/17 in Chromium against the mock build and the no-config real build. Verified against mocks only: no real Firebase or Gemini Nano call at this point.
- **Who:** Grok Workhorse via Kilo wrote the first code (task `wh-20261121-022833-597b`; verdict `integrity_violation` because the supervisor created files in the main clone during the run, and the worker could not compile or test offline). A Workhorse review task (`wh-20261121-023932-9de3`) asked for changes. Grok Bot applied and verified the diff, fixed the review findings (including failing closed when a single-path mode reports the other path), wrote the README and committed. Alex reviewed and merged.
- **Open items at the time:** real cloud and on-device runs, VERIFY-1 to VERIFY-4.
