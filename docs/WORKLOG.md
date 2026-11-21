# Work log

Dated running log, newest entry first, one entry per pull request. Times are America/Chicago.
"Grok Workhorse" means the coding worker run through Kilo (`user-workhorse`, profile `default`). "Grok Bot" means the supervising assistant working for Alex. "Alex" means Alex Chen, who reviews and merges every PR.

---

## 2026-11-21 — PR #10: T21 graph model (`toGraph`) (open, not merged)

- **PR:** https://github.com/alexxhchen-nu/archive-seance/pull/10. Branch `t21-graph-model`, head `8a29cfd`, from main `7db71d3`. Not merged, not pushed to main.

- **What was done:** `src/graph/toGraph.ts` adds a pure `toGraph(entities, mentions, relations)` that returns `{ nodes, links, dropped }`. Nodes carry id, entityId, type, label, mention count, solid/ghost, confidence, evidence refs (docId, page, start, end, quote), evidenceCount, and route tags (`on_device` / `in_cloud` / `mixed`) for R8.5. Entities with no anchored mention are dropped (R8.4). Relation endpoints are resolved by `candidateKey` of the subject/object surface to the node that contains that key, so merged aliases remap to the canonical node. Dangling, self-loop and unanchored relations are dropped and counted. `SYMMETRIC_LABELS` (imported from `src/eval/score.ts`) are deduped into one undirected link. Evidence is deduplicated by (docId, page, start, end) and `evidenceCount` is the number of distinct anchors. Output is sorted by id.
- **Id rule:** node id = `n:` + the smallest candidate key among the entity's evidenced members, so it does not depend on `Entity.id` or input order. Link id = `l:label:src>dst` (directed) or `l:label:min|max` (symmetric). **Limitation:** a node id still changes when a cluster absorbs a member whose key sorts before all current keys (the same weakness as `buildEntities`' `c.keys[0]`). T22 should treat that as a node replacement, or carry a node-id alias map. `merge.ts` is unchanged.
- **Assumptions:** a surface that resolves to more than one node is treated as dangling. The console demo JSON is unchanged.
- **Tests (fresh clone `/tmp/as-verify-t21` at `8a29cfd`):** typecheck, lint, `npm test` 760 passed / 1 skipped, `npm run build`, `npm run build:mock`, e2e **62/62**, `check:secrets`, `check:bundle-rhc`. T21 ticked.
- **Who:** Grok Workhorse (implementation); Grok Bot (review and verification).

## 2026-11-21 — Spec: T20 follow-up decisions from Bloks (cut order)

- **What was done:** Applied Bloks's `spec-t20.patch`: the design §7.4 ghost "breathing" animation (T31) is now first in the cut order; a static dashed ring + opacity already satisfies R7.4. Bloks's answers to the other T20 questions needed no spec change: Confirm/Split/Not sure and persist-by-hash belong to T32; the demo stays `cloudEnabled: false` (cloud path is T27, no-Nano prompt is T33); merge-threshold overrides belong to T29 (Settings panel required, ghost < auto), and T32's ghost card shows the current thresholds and their source.
- **Tests:** docs only; `git apply --check` clean.
- **Who:** Bloks (spec), Grok Bot (applied).

## 2026-11-21 — PR #8: T20 console demo (open, not merged)

- **PR:** https://github.com/alexxhchen-nu/archive-seance/pull/8. Branch `t20-console-demo`, head `4098c50`, from main `a2d4fd6`. Not merged, not pushed to main.

- **What was done**
  - `src/app/consoleDemo.ts`: `runConsoleDemo` calls the existing `runExtraction` (local route, `cloudEnabled: false`) and `buildDemoPayload` merges with `buildEntities`. The payload (`archive-seance/console-demo@1`) has per entity: label, type, `status` solid|ghost, confidence, design 7.4 ghost opacity, member surfaces, evidence page + anchored quote, weakest link with score breakdown. It also carries the thresholds (source `defaults`), chunk counts, `droppedUnanchored` and relations (page + quote). No other document text.
  - `src/app/panels/ConsoleDemoPanel.ts`: "Console demo (debug)" card on the existing app page (`app/index.html`). It has a **Summon** button, a list with `solid` / `ghost` classes (ghost: dashed border, opacity), a details view per entity, a JSON dump, and Copy JSON / Download JSON. In `main.ts` the Summon click checks availability and calls `enableDevice` (`initializeDeviceModel`) when the model is `downloadable`/`downloading` (R3.8).
  - Mock build: `DEMO_SCRIPT` / `demoExtractionText` in `mockFirebase.ts` return verbatim quotes from `test/fixtures/eval/harbor-eval-minutes.pdf`, filtered to the chunk in the prompt. The probe's `MOCK_JSON` is unchanged. Expected result: "E. Marlow" + "Edith Marlow" form a ghost (name 0.88, context 0.5, total ≈ 0.77), and "Dr. Oswin Hale" (pages 1 and 3) is solid.
  - Tests: `test/unit/app/consoleDemo.test.ts` (view-model against `buildEntities`, and the mock script on the real fixture via pdf.js with `droppedUnanchored === 0`). E2E: new `demo:` checks in `scripts/e2e-extension.mjs` (mock: solid + ghost classes and JSON schema; real: Summon without config shows the config-missing error).
- **Narrow interpretation (no spec change):** the R7 ghost card's Confirm same / Split / Not sure and persistence by PDF hash are **deferred** (to T22/T24). The demo shows members, weakest link, score breakdown, evidence and thresholds read-only. The threshold source is always `defaults`, because there is no Remote Config yet.
- **Tests (fresh clone `/tmp/as-verify-t20` at `4098c50`):** typecheck, lint, `npm test` 751 passed / 1 skipped, `npm run build`, `npm run build:mock`, e2e **62/62** (mock Summon: 2 solid, 1 ghost; JSON schema and class match; real Summon without config explains missing config), `check:secrets`, `check:bundle-rhc`. T20 ticked for mock acceptance only. M1 on a real demo PDF with on-device Gemini Nano still needs Alex to run it in Chrome. M1 is not claimed.
- **Who:** Grok Workhorse (implementation); Grok Bot (review and verification).

## 2026-11-21 — PR #7: T37a wire the R17.2 comparison pass for `npm run eval` (open, not merged)

- **PR:** https://github.com/alexxhchen-nu/archive-seance/pull/7. Branch `t37a-eval-compare`, head `f6019d4`. **Stacked on PR #6** (`t17a-nhprc-gold`). Not merged, not pushed to main. T37 and T20 are not ticked. No accuracy, precision, recall or timing numbers were written; `docs/EVAL.md` still says “not yet measured”.
- **What was done**
  - `src/eval/predictions.ts`: `buildPredictions` (pure; from `runExtraction` output, entities merged with `buildEntities`, only page + anchored quote + surface kept), `validatePredictions` (schema, fixtureId match, refuses `build.flavor: "mock"`), `scorePredictions` (calls `scoreEntities` / `scoreRelations` from `score.ts`).
  - `src/eval/evalDoc.ts`: replaces only the target mode's rows in the `docs/EVAL.md` table (idempotent; errors rather than appending if a row is missing).
  - `src/app/evalExport.ts` + two “Export eval run” buttons on the probe panel: runs the local extraction pipeline on pages 1–2 of the opened PDF and downloads the JSON. The build flavor comes from `import.meta.env.MODE`; the git SHA is stamped by `vite.config.ts` as `VITE_GIT_SHA`.
  - `scripts/eval.mjs`: R17.1a gate first (exit 1), then no `--predictions` exits 2 with export instructions, invalid file exits 3, mock run exits 4, else scores and writes rows. `EVAL_GOLD_PATH` kept; `EVAL_MD_PATH` added so tests use temp copies.
  - `docs/EVAL.md`: added “How to measure”.
- **Narrow interpretations (no spec change):** entity scoring uses every exported mention surface (as the existing harness test does), not only merged labels. “cloud-enabled” sets `cloudEnabled: true` for routing, but `runExtraction` still only runs local chunks (cloud chunks are counted as pending-cloud) because the cloud extraction path is not built yet. Timing is wall-clock of the extraction call only (excludes PDF load/index). Export refuses a PDF whose SHA-256 is not the NHPRC file in `docs/DEMO_SOURCES.md`. Measurement dates are written in America/Chicago.
- **Tests:** typecheck, lint, `npm test` 749 passed / 1 skipped after the review follow-up (fresh clone of `f6019d4` had been 747 passed / 1 skipped, plus builds, e2e 55/55, `check:secrets`, `check:bundle-rhc`). No accuracy numbers written; T37 still unticked.
- **Who:** Grok Workhorse (implementation); Grok Bot (review: SHA check, Chicago date, EVAL.md cloud-path note, refuse no-inference exports, mock export uses the controller probe; verification).

## 2026-11-21 — PR #6 follow-up: Alex reviewed the NHPRC gold

- **What was done:** Alex reviewed `docs/eval/NHPRC_GOLD_REVIEW.md` and answered “全部keep” (keep all items, no edits). `gold.json` now has `reviewedBy: "Alex Chen"`, `reviewedAt: "2026-11-21"` and an updated `labeling` line. `docs/EVAL.md` checklist and the review sheet status were updated. `scripts/eval.mjs` accepts `EVAL_GOLD_PATH` so the R17.1a refusal test runs against an unreviewed temp copy; a second test checks that with the reviewed gold, `npm run eval` exits 2 (comparison not wired until T37) and leaves `docs/EVAL.md` unchanged.
- **Tests:** typecheck, lint, `npm test` 720 passed / 1 skipped. No accuracy numbers written; T37 still unticked.
- **Who:** Alex (review), Grok Bot (edits).
- **Open items:** T37 can now measure once the comparison pass is wired.

## 2026-11-21 — PR #6: NHPRC gold draft for T17a / R17.1, eval review gate (open, not merged)

- **PR:** https://github.com/alexxhchen-nu/archive-seance/pull/6. Branch `t17a-nhprc-gold`, from main `eda1d25` (PR #5 already merged). Not merged, not pushed to main.
- **What was done**
  - Applied Bloks’s R17 patch: R17.1 now requires short quotes from 1–2 pages of the NHPRC public-domain PDF, AI-drafted labels reviewed by the author, `reviewedBy` / `reviewedAt` on the fixture, and the synthetic fixture as a smoke test only. New R17.1a: `npm run eval` must refuse to write accuracy numbers while the gold is unreviewed. T17a gained an update line that T37 may not measure until Alex reviews. Existing R13.2 and T06 wording was kept. The R17 `tasks.md` hunk was merged by hand because this branch already had ticks and the T17a synthetic note.
  - Pages 1–2 of the November 6, 2015 NHPRC Executive Summary Minutes were chosen as the densest in people, organizations, and stated relations (attendance and affiliations on page 1; the strategic-planning discussion on page 2).
  - The official PDF is still not committed. The fixture is `test/fixtures/eval/nhprc-2015-11/`: `gold.json` (25 people, 9 organizations, 66 mentions, 25 relations, 14 non-entities) and `pages.json` (this repo’s pdf.js text of those two pages, public domain). `scripts/verify-nhprc-eval.mjs` fetches the official URL or takes `--pdf`, checks the SHA-256 in `docs/DEMO_SOURCES.md`, and compares a fresh extraction to `pages.json`. Ran successfully against the local copy (`ecb7abc7…`).
  - Gold is marked AI-drafted, `reviewedBy: null`, `reviewedAt: null`. Review sheet: `docs/eval/NHPRC_GOLD_REVIEW.md`. `docs/EVAL.md` stays “not yet measured,” with an author-review checklist; the synthetic fixture is described as smoke-only. T37 is not ticked and no accuracy numbers were written.
  - `src/eval/reviewGate.ts` and `npm run eval` implement the R17.1a refusal (exit 1, `docs/EVAL.md` untouched).
- **Tests and results** (fresh clone; see the PR description)
  - typecheck, lint, both builds, `build:mock` then e2e, `check:secrets`, `check:bundle-rhc`.
  - `npm test` counts are in the PR description. `npm run eval` exits 1 and does not modify `docs/EVAL.md`.
- **Who:** Grok Bot drafted the gold and the review sheet for Alex’s 20–30 minute review. No live model was called.
- **Open items**
  - Alex reviews `docs/eval/NHPRC_GOLD_REVIEW.md`, then sets `reviewedBy` / `reviewedAt`. T37 cannot measure until that is done.


## 2026-11-21 — PR #5: T16 router, T17 local extraction, T17a eval fixture, T18 merge, T19 PBT (open, not merged)

- **PR:** https://github.com/alexxhchen-nu/archive-seance/pull/5. Branch `t16-t19-extraction`, from main `c2ce14a` (PR #4 already merged). Not merged, not pushed to main.
- **What was done**
  - T16: `src/ai/router.ts`, pure `decideRoute` (design 5.2). Exhaustive table test against an independent expectation written from R4, plus properties: sensitive never cloud, kill switch never cloud, local only when the device model is available, total and deterministic.
  - T17: `prompts.ts` (design 5.5 text; the probe now uses it), `src/pipeline/locateQuote.ts` (exact, then whitespace/case/line-end-hyphenation match with an index map), `src/pdf/sentenceStart.ts`, `src/pipeline/runExtraction.ts` (local route only: router per chunk, `callModel`, privacy and mode assertions, schema validation at the model-output boundary, one retry, quotes located in code, `droppedUnanchored`, inference log; a chunk the router sends to the cloud is only counted as `pending-cloud`), and a `mentions` store in IndexedDB (DB version 2; the cached-record version stays 1 so existing caches stay valid; migration tested from a real v1 database).
  - T17a: synthetic 4-page fixture `test/fixtures/eval/harbor-eval-minutes.pdf` (21 entities, 15 relations, name variants, two people per surname, an abbreviation, a split name, a hyphen split, non-entities), `gold.json`, `src/eval/score.ts`, `docs/EVAL.md` stating "not yet measured". Labels were written by an AI assistant and are not yet reviewed by a human.
  - T18: `src/graph/{similarity,confidence,cluster,merge}.ts` per design 7, merge thresholds in `DEFAULTS`, the worked-example table as tests, the seven properties of 7.6 plus the R7.8 verdict cap.
  - T19 (reversible part): `docs/PBT_FINDINGS.md` with one real finding and the hook run with a deliberately broken threshold. The Kiro hook recreation and the screenshot are Alex's, so T19 stays unticked.
  - Real defect found by property 4: lowering `mergeGhostThreshold` could split a cluster, because the literal greedy algorithm in design 7.3 is not monotone. `cluster.ts` now uses standard hierarchical complete linkage (merge order independent of the thresholds). Details and the shrunk input are in `docs/PBT_FINDINGS.md`; design 7.3 still describes the greedy variant.
  - design §4.2 updated for `DB_VERSION` 2 / `RECORD_VERSION` 1. Ticked T16, T17, T17a, T18 in tasks.md.
- **Tests and results** (fresh clone of the PR head, `npm ci` first)
  - typecheck, lint, build, `build:mock`, `check:secrets` (377 files, history scanned), `check:bundle-rhc` pass.
  - `npm test` **701/701** in 37 files (148 before this PR). `npm run e2e` **55/55**. `dist` is 5,168,543 bytes (before 5,168,359), `app/index.js` 463,785 bytes (the new code is not imported by the app yet).
  - `FC_NUM_RUNS=3000 vitest run test/property` passed 10 times in a row after the clustering fix.
  - No live model call was made in tests. No live cloud run was made for this PR: the extraction pipeline is not wired into the extension UI until T20, so the real build cannot run it.
- **Who:** Grok Workhorse via Kilo wrote the code in two tasks (`wh-20261121-102114-46a5`: T16, T18; `wh-20261121-103221-5744`: T17, T17a), both verdict `success`. Grok Bot reviewed the diffs, found the monotonicity defect through a flaky test, replaced the algorithm, added the regression test, wrote PBT_FINDINGS, EVAL.md, the design and tasks edits, and verified on a fresh clone.
- **Open items** (from the first push)
  - T19: recreate the hook in Kiro and take the screenshot (Alex). T20 (console demo, M1) is next.
  - Questions 4 and 5 (eval fixture source / gold review) still wait on Alex. R17 and the eval labels were not changed for those.

- **Follow-up, same day (still PR #5), after Bloks answered the other spec questions**
  - Applied Bloks's spec patch `spec-pr5.patch`. `design.md` applied cleanly. `requirements.md` and `tasks.md` needed a hand merge: R13.2 and T06 already had the later "preprint is not a reference" wording, which was kept instead of the patch's shorter replacement; existing ticks, the T17a synthetic-fixture note, and the design §4.2 `DB_VERSION` / `RECORD_VERSION` note were kept. There is no `PRD.md` in the repo. Q6 no longer mentions a "Zenodo problem". T15 was reworded so the R4.8 retry may live in `runExtraction`, and ticked.
  - §7.3 is now hierarchical complete linkage. `cluster.ts` now uses −∞ for a user-split pair and breaks linkage ties by the smallest sorted member ids of the merged group. Property 3a is a named test ("lowering `mergeGhostThreshold` never splits an existing cluster"); property 4 still covers both monotonicity claims in 7.6.4. R4.3 (budget only on long documents) and R4.5 (`local_only` with no device model → blocked) already matched; named router tests were tightened.
  - R3.4a: an entity is dropped (and `droppedUnanchored++`) if its name does not appear in the located quote after whitespace and case normalization. Relations still only need a locatable quote. Unit, property, and gold-harness tests cover this. No `gold.json` entry was rewritten: 10 of 42 mentions contain only an alias, not the canonical name; the harness now emits that alias so the name-in-quote check passes, and a new consistency test requires name or alias in every mention quote.
  - Tests (fresh clone, `npm ci` first): see the updated PR description.


---

## 2026-11-21 — PR #4: persist the page index (R2.4) and bundle pdf.js font data (open, not merged)

- **PR:** https://github.com/alexxhchen-nu/archive-seance/pull/4. Branch `t11-t14-pdf-pipeline`, from main `9b2b876` (PR #3 already merged). Not merged, not pushed to main.
- **What was done**
  - IndexedDB database `seance` (schema version 1) stores `documents`, `pages` and `chunks`, keyed by the SHA-256 of the PDF bytes. Title and source URL or filename are stored as metadata. `getIndex` misses if the record is partial or the schema version differs; `putIndex` writes in one transaction; `clearDocument`, `clearAll` and `evictOldest` are exported. There is no automatic eviction cap (the spec does not define one). PDF bytes are not stored. Nothing is written to `chrome.storage.sync`.
  - `loadAndIndex` reads the cache after hashing; a hit skips pdf.js parse/index/chunk and returns `fromCache: true`. A changed file has a new hash, so it is re-indexed. Cache read or write errors fall back to a normal index so a broken IndexedDB cannot block opening a PDF.
  - The app shows `Served from cache` (`data-testid="pdf-cached"`) only on a hit, and has a "Clear cached documents" button.
  - The Vite build copies `pdfjs-dist` `standard_fonts`, `cmaps` and `wasm` (with their LICENSE files) into `<outDir>/pdfjs/`. `openPdf` passes `standardFontDataUrl`, `cMapUrl`, `cMapPacked: true` and `wasmUrl` (via `chrome.runtime.getURL` in the extension; filesystem paths in Node tests). The manifest was not given `web_accessible_resources`; e2e confirmed the files load under the MV3 CSP.
  - New synthetic fixtures: `times-roman-plain.pdf` (Times-Roman, not embedded) and `cjk-unigb.pdf` (Type0 / UniGB-UTF16-H, no embedded font, no ToUnicode; CMap alone is enough to extract 港湾灯笼…).
  - `fake-indexeddb` 6.2.8 added as a devDependency. THIRD_PARTY.md, design.md §4.2 (raw wrapper instead of the `idb` library; `chunks` store), structure.md and ticked T13b in tasks.md. T17 is still open (mentions).
  - Review fix: the e2e cache check now waits for "Cleared cached documents." before reloading, so the second clear cannot race the reload.
- **Tests and results** (working clone; fresh-clone results are in the PR description)
  - typecheck, lint, build, `build:mock`, `check:secrets`, `check:bundle-rhc` pass.
  - `npm test` **148/148** in 21 files (119 existing, 29 new). The `standardFontDataUrl` warning is gone when the data URLs are set.
  - `npm run e2e` **55/55** (35 existing plus font and cache checks in both the mock and real builds). After a reload, the second load of `mixed-scanned.pdf` shows "Served from cache"; after clear and reload it does not.
  - Bundle size: `dist` is 5,168,359 bytes of files (~4.93 MiB; `du` reports 5.6M). Of that, `dist/pdfjs` is 3,354,280 bytes (~3.20 MiB): standard_fonts 798,046; cmaps 1,167,747; wasm 1,388,487. The worker is unchanged at 1,271,915 bytes. `app/index.js` went from 460.32 kB to 463.61 kB (~3 kB).
- **Who:** Grok Workhorse via Kilo (task `wh-20261121-100024-1f8d`, verdict `success`) wrote the code, tests, fixtures and e2e script. It could not run `npm ci` or Chromium. Grok Bot added the `fake-indexeddb` pin, reviewed the diff, fixed the e2e clear/reload race, switched the Vite config off `__dirname`, ran the full verification, and opened the PR.
- **Open items**
  - R2.4 mentions are still T17. `evictOldest` is not called automatically.
  - Remote PDF / permission flow in real Chrome is still untested (unchanged).
  - pdf.js may still extract less text from some unusual CJK fonts; the new fixture covers a CMap-decoded Type0 font, not a scanned page and not every CJK encoding.
  - T05, T08, T09, and `design.md` Q6 wording remain open.

---


## 2026-11-21 — PR #3: T11–T14 PDF pipeline, demo sources, prior art (merged later the same day)

- **PR:** https://github.com/alexxhchen-nu/archive-seance/pull/3 (branch `t11-t14-pdf-pipeline`, from `0668c3c`; Alex merged it onto main as `9b2b876`).
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
