# Implementation Plan — Archive Séance

Dates are Chicago time (America/Chicago, 2026). Cross-checked on 2026-11-21 against the Linear playbook 「档案通灵板 · 参赛作战手册」 (`cf59d1850c17`). New or tightened work from that pass is tagged `playbook`. Tag `[MM/DD]` = day the task is **done by end of day**. `Req:` references requirement ids in `requirements.md`. `Owner: Alex` = needs the human (account, console, judgement, recording); everything else is intended to be implemented through Kiro spec execution so the git history and Kiro usage are real (Kiroween judges "how thoroughly and skillfully Kiro is used").

Deadlines that drive this plan (all verified from the official rules on 2026-11-21):
- #BuildHybridAI submission closes **Mon 11/30 2:00 pm PT = 4:00 pm Chicago**; we target **noon Chicago**.
- Kiroween submission closes **Fri 12/4 2:00 pm PT = 4:00 pm Chicago**; we target **noon Chicago**.
- Kiro credit request form (optional, 4,000 credits) closes **Tue 12/1 12:00 pm PT = 2:00 pm Chicago**; codes must be redeemed by 12/4.
- Firebase quota sprint 3 (optional extra model access) request closes **Wed 11/25 10:00 am PT = 12:00 pm Chicago**. The free tier is enough for this project; skip unless blocked.

Cut order if behind: design §7.4 ghost "breathing" animation (T31; a static dashed ring + opacity satisfies R7.4) → R16 export → R15 multi-doc → R14 OCR → R11 Remote Config. Never cut: R3, R4, R5, R7, R8, R9, R10, R13.

---

## Phase 0 — Environment and spec (Sat 11/21)

- [ ] **T01 [11/21] Repo skeleton** — Create the public GitHub repo named `archive-seance`; add `LICENSE` (Apache-2.0), `.gitignore` (must ignore `node_modules`, `dist`, `.env*` except `.env.example`; must NOT mention `.kiro`), `README.md` stub, `NOTICE`, `THIRD_PARTY.md`. Copy this `/.kiro` tree to the repo root and commit it in the first commit. Verify `git check-ignore -v .kiro` prints nothing, and GitHub's About box detects the Apache-2.0 license. Req: R13.1, R10.3. Owner: Alex (repo creation) + Kiro.
- [x] **T02 [11/21] Tooling** — Vite + TypeScript (strict) + Vitest + fast-check + ESLint; npm scripts `dev`, `build`, `typecheck`, `test`, `check:secrets`, `check:bundle-rhc`. Pin versions after `npm view` (today: firebase 13.4.0, pdfjs-dist 6.5.438, d3 7.9.2, vite 8.3.8, vitest 5.1.1, fast-check 4.10.3). Req: NFR5.
- [x] **T03 [11/21] MV3 shell** — `public/manifest.json` per design 3.2, `src/background/sw.ts` (toolbar click opens `app/index.html?src=`), empty app page that loads in `chrome://extensions` (Load unpacked). Req: R1.1.
- [ ] **T04 [11/21] Firebase project setup** — Create Firebase project; Console → AI Logic → Get started with Gemini Developer API; confirm App Check is **Enforced** for AI Logic; register the web app; create untracked `.env.local` from `.env.example`. Req: R10. Owner: Alex.
- [ ] **T05 [11/21] Spike: hybrid in an extension page** — Minimal button in the app page that (a) sets the App Check debug flag, (b) calls `initializeDeviceModel()` from the click, (c) runs one structured-output call with `ONLY_ON_DEVICE`, one with `ONLY_IN_CLOUD`, logs `inferenceSource`. Register the printed debug token in Console. Record results (VERIFY-1, VERIFY-2, VERIFY-4, and the CSP question) in `docs/SPIKE_RESULTS.md`. Req: R3.1, R3.6, R10.1–2. Owner: Alex (Chrome flags, Nano download, console token) + Kiro.
- [x] **T06 [11/21] Prior-art and demo-source docs** — `docs/PRIOR_ART.md` (all code written on/after 2026-10-30; no reuse of earlier code, no exceptions; no external papers, preprints or projects used as references; the author's own Zenodo preprint is not a reference or a source of ideas; third-party libraries listed), `docs/DEMO_SOURCES.md` (neutral public PDFs with URLs and license/terms; pick 2 short ones, e.g., historical government or museum records; no sensitive cases). Req: R13.2, R13.5. Owner: Alex picks sources.
- [x] **T07 [11/21] Secret guards** — `scripts/check-secrets.mjs` (patterns in R10.4) and `scripts/check-bundle-rhc.mjs` (fails if `dist` contains `recaptcha/api.js`, `recaptcha/enterprise.js`, `apis.google.com/js/api.js`); GitHub Action running them. Req: R10.3–5.
- [ ] **T08 [11/21] Kiro assets in place** — Confirm steering files load in Kiro (`product.md`, `tech.md`, `structure.md`), recreate the three hooks through "Ask Kiro" so the committed JSON matches the installed Kiro version (VERIFY-5), open this spec in Kiro and run T02 through it as the first Kiro-executed task. Owner: Alex.
- [ ] **T09 [11/21] Request Kiro credits** — Submit the Kiro credit request form today (closes 12/1 12:00 pm PT; 48 business-hour review). Owner: Alex. Playbook status as of 11/21: already submitted; confirm and tick this only after you have the confirmation email.
- [ ] **T10 [11/21] Choose Resurrection framing** — Write 5 sentences in `docs/PITCH.md` on what "dead technology" is being resurrected (see PRD section on risks). Owner: Alex.

## Phase 1 — Core extraction (Sun 11/22 – Mon 11/23)

- [x] **T11 [11/22] Types and schemas** — `src/types/index.ts`, `src/ai/schemas.ts`, validators (hand-written or `ajv`), unit tests. Req: R3.2–3.3, design 4.
- [x] **T12 [11/22] PDF loading** — `src/pdf/loadPdf.ts` (URL fetch with permission flow, local file input, size limit, SHA-256), host-permission button. Req: R1.1–1.5.
- [x] **T13 [11/22] Page index** — `pageIndex.ts` with `itemOffsets`; `no-text` pages flagged. Tests with 2 fixture PDFs. Req: R2.1, R2.3.
- [x] **T13b [11/22] Persist page index and bundle pdf.js font data** — IndexedDB `seance` cache of pages and chunks, keyed by SHA-256; schema version; clear/evict; "Served from cache" UI. Bundle pdfjs-dist standard_fonts, cmaps and wasm at build time and pass the URLs into getDocument. Req: R2.4 (page index only; mentions land in T17).
- [x] **T14 [11/22] Chunker** — `chunker.ts` (Intl.Segmenter, max chars, never crosses pages) + property tests. Req: R2.2.
- [x] **T15 [11/22] Availability probe and models** — `src/ai/availability.ts`, `src/ai/firebase.ts`, `src/ai/models.ts`, `src/ai/call.ts` (timeout, `inferenceSource` capture, privacy invariant). The retry-once-then-reroute rule (R4.8) may live in `runExtraction`. Req: R3.1, R3.6–3.7, R4.8, R12.1.
- [x] **T16 [11/22] Router** — `src/ai/router.ts` + exhaustive table test + property test "sensitive never cloud". Req: R4.1–4.7.
- [x] **T17 [11/23] Prompts and extraction pipeline** — `prompts.ts`, `locateQuote.ts` (+ tests), `runExtraction.ts` on the **local route only**; mentions with anchors stored in IndexedDB; `droppedUnanchored` counter; R3.4a name-in-quote check. Req: R3.2–3.5, R3.4a, R2.4.
- [x] **T17a [11/23] Labeled eval fixture** — Add `test/fixtures/eval/` with gold mentions and relations for one short neutral public PDF from `docs/DEMO_SOURCES.md`. Do not invent accuracy numbers. Leave `docs/EVAL.md` as "not yet measured" until T37. Req: R17.1, R17.4. Done with a synthetic fixture (owner constraint: no committed text from real PDFs) instead of a DEMO_SOURCES PDF; labels are AI-made, not yet human-reviewed. playbook
  - Update (11/21, Alex chose A): gold = short quotes from 1–2 pages of the NHPRC public-domain PDF, AI-drafted, `reviewedBy`/`reviewedAt` fields empty until Alex reviews (~20–30 min). Keep the synthetic fixture as a smoke test. **Gate:** T37 may not measure until Alex has reviewed. Req: R17.1, R17.1a.
- [x] **T18 [11/23] Similarity and merge (pure)** — `similarity.ts`, `confidence.ts`, `cluster.ts` per design section 7, with worked-example tests and the seven fast-check properties. Req: R7.1–7.5, R7.8.
- [ ] **T19 [11/23] Hook: property tests on merge** — enable the "merge property tests" hook (see `.kiro/hooks/`) and run it at least once with a deliberately broken threshold to show it catching the bug (screenshot for the Kiro write-up). Record any *real* defect (input, wrong behavior, fix) in `docs/PBT_FINDINGS.md`; if none has been found yet, leave "not yet found" and re-check in T37. Req: NFR5, R17.5. Owner: Alex. playbook
- [x] **T20 [11/23] Console demo** — a debug page that runs T17+T18 on a fixture PDF and dumps entities (solid/ghost) as JSON. **Milestone M1: local extraction works end-to-end on a demo PDF, offline.** Req: R3, R7. Mock-build acceptance met (offline e2e on `harbor-eval-minutes.pdf`). M1 on a real demo PDF with on-device Gemini Nano still needs Alex to run it in Chrome.

## Phase 2 — Network and cloud path (Tue 11/24 – Wed 11/25)

- [ ] **T21 [11/24] Graph model** — `src/graph/toGraph.ts` (entities/relations → nodes/links with evidence counts), unit tests. Req: R8.4.
- [ ] **T22 [11/24] GraphView (D3)** — force layout, zoom/pan/drag, size by mentions, shape by type, legend, search, filters, ghost rendering (opacity formula, dashed ring), incremental update so the network grows as chunks finish. Req: R8.1–8.3, R7.4, R8.6–8.7.
- [ ] **T23 [11/24] Viewer and highlight** — `PdfViewer.ts` (pdf.js, bundled worker), `spanMapper.ts` + property tests, `goTo({page,start,end})`, fallback banner. Req: R9.1–9.5.
- [ ] **T24 [11/24] Wire node/edge click → evidence → viewer** — Evidence panel; viewer selection → node highlight. Req: R9.1–9.6. **Milestone M2: click a node, see the source sentence highlighted.**
- [ ] **T25 [11/25] Redaction and pseudonymization** — `redact.ts`, `pseudonymize.ts`, `payload.ts`, `outboundLog.ts` + tests/property tests. Req: R5.1–5.3, R5.5–5.6.
- [ ] **T26 [11/25] Consent panel** — shows exact payload, rules, counts; blocks until click; session-scoped consent; re-open the last approved payload from the Outbound log without writing the text to disk. Req: R5.4, R5.7, R5.8. playbook
- [ ] **T27 [11/25] Cloud route for chunks and cross-page** — `candidatePairs.ts`, `runCrossPage.ts`, cloud branch in `runExtraction.ts` (concurrency 3, backoff, App Check error banner, `pending-cloud` queue), run summary, and a mid-run status chip that flips to cloud when the first cloud task is queued. Req: R4.3–4.11, R6.1–6.5, R12.3–12.5. **Milestone M3: public doc runs hybrid with a visible local/cloud split.** playbook
- [ ] **T28 [11/25] Gray-zone adjudication** — `adjudicate` task with verdict schema feeding the confidence formula. Req: R7.1, R7.8.
- [ ] **T29 [11/25] Remote Config spike + Settings (BONUS remote, MUST local)** — `src/config/*`; test `isSupported()` in the extension page (VERIFY-3); if it works, wire the eight parameters and the status chip. Always ship a Settings panel that edits the same keys (R11.5) so the ghost-threshold demo works even if Remote Config is unsupported. If RC fails by 18:00, write the failure in `docs/SPIKE_RESULTS.md` and keep Settings + defaults; do not leave thresholds unchangeable. Req: R11. playbook
- [ ] **T30 [11/25] Decide OCR go/no-go** — OCR (R14) only if M1–M3 are done and bugs ≤ 3. Write the decision in `docs/DECISIONS.md`. Owner: Alex.

## Phase 3 — UI (Thu 11/26)

Note: 11/26 is US Thanksgiving; this plan still assumes a reduced day. The playbook asks for a full Halloween-style UI day — if time is short, keep T31–T33 (Summon, theme, ghost card, offline / no-Nano states) and move T34/T35 to 11/27 morning; R14 stays cut-first.

- [ ] **T31 [11/26] Layout and theme** — three-pane layout, Halloween / séance theme (parchment, planchette ring, breathing ghosts), status chips (on-device, cloud, App Check, config), run summary. Req: R8.8, R12.5, R10.6, R11.4. playbook
- [ ] **T32 [11/26] Ghost interaction** — ghost detail card with score breakdown, current thresholds and their source, Confirm/Split/Not sure, persistence via `MergeDecision`. Req: R7.6–7.7, R7.9. playbook
- [ ] **T33 [11/26] Sensitivity, Summon, and onboarding** — primary **Summon** button (also the `initializeDeviceModel` gesture); document sensitivity switch; "Enable on-device AI" button; blocked-state UI for sensitive docs; no-Nano offer-to-continue on **public** docs; offline run that still finishes the local network. Req: R3.8, R4.11, R12.1–12.4, NFR1. playbook
- [ ] **T34 [11/26] OCR (CUT-FIRST, only if T30 = go)** — `Recognize this page` via image part through the router. Req: R14.
- [ ] **T35 [11/26] Accessibility pass** — keyboard node list, focus rings, reduced motion, contrast. Req: NFR4.

## Phase 4 — Freeze and test (Fri 11/27)

- [ ] **T36 [11/27] FEATURE FREEZE at 12:00.** Only bug fixes after this. Owner: Alex.
- [ ] **T37 [11/27] Full test run and measured eval** — unit, property, integration, the manual checklist in design section 12 on two demo PDFs; offline local run (R4.11); no-Nano run on a **public** document (second Chrome profile or flag disabled). Run `npm run eval` and the timing pass; write only real numbers into `docs/EVAL.md`. Re-check `docs/PBT_FINDINGS.md`. Fix P0/P1. Req: all MUST, R17. Owner: Alex (machine timings) + Kiro. playbook
- [ ] **T38 [11/27] Secrets, rules audit, and demo pack** — `check:secrets`, `check:bundle-rhc`, `git log -p | grep` for tokens, verify `.kiro` tracked and not ignored on the remote, license visible in GitHub About, README judge path ≤ 10 steps with the Firebase AI Logic call-site, `docs/PRIOR_ART.md` final. Pack an unpacked demo zip (playbook: 部署演示版). Req: R10, R13, R18.7. playbook
- [ ] **T39 [11/27] Ask Devpost about judge access** — email support@devpost.com or post in the BuildHybridAI Discussions tab: "May the App Check debug token be given in the private testing-instructions field?" Record the answer in `docs/DECISIONS.md`. Owner: Alex. (Rules conflict, see design 9.4.)
- [ ] **T40 [11/27] Optional export (CUT-FIRST)** — only if everything above is green. Req: R16.

## Phase 5 — Video and submission prep (Sat 11/28 – Sun 11/29)

- [ ] **T41 [11/28] Video script and recording** — < 3:00, English subtitles, no copyrighted music. Cover every R18.2 shot: hook with a public-archive PDF; users; Summon and growing network; jump-to-source; ghost explanation with thresholds; offline local run; long public doc with visible cloud switch and redacted payload; `/.kiro` + PBT finding; closing line and link. Optional Remote Config (or Settings) threshold toggle. A BuildHybridAI cut may lengthen the hybrid beat. Record on 11/28; public YouTube upload may wait for T45. Req: R18.1–3. Owner: Alex. playbook
- [ ] **T42 [11/28] English write-ups** — Devpost text for BuildHybridAI (how Firebase AI Logic is used: modes, structured output, `inferenceSource`, App Check, Remote Config or Settings; local vs cloud split; features; value proposition; README call-site) in `docs/DEVPOST_BUILDHYBRIDAI.md`. Use only numbers already in `docs/EVAL.md`. Req: R13.4, R17.4, R18.4.
- [ ] **T43 [11/28] Kiro usage write-up draft** — `docs/KIRO_USAGE.md` answering the Kiroween prompts: IDE/CLI used, custom agents (if any), hooks, spec-driven vs vibe, steering, MCP (or an explicit "not used"), property-based testing and the `docs/PBT_FINDINGS.md` case, powers (if any). Pull real evidence from git history. Owner: Alex. Req: R18.5. playbook
- [ ] **T44 [11/29] Release build and clean-room test** — build zip, install into a fresh Chrome profile following README only. Fix doc gaps. Tag `v0.1.0`.
- [ ] **T45 [11/29] YouTube upload and Devpost drafts** — upload the video to public YouTube if not already public; save drafts on both Devpost forms (BuildHybridAI form fields: platform Web/Chrome, Firebase write-up, testing instructions, video URL). Owner: Alex. Req: R18.1, R18.4, R18.7. playbook

## Phase 6 — Submit (Mon 11/30 and Fri 12/4)

- [ ] **T46 [11/30] Submit #BuildHybridAI by 12:00 pm Chicago** (deadline 4:00 pm Chicago). Select platform **Web (Chrome)**. Include: public GitHub URL (Apache-2.0 visible), YouTube video URL, text description (Firebase AI Logic usage), testing instructions. Owner: Alex — final click is Alex's.
- [ ] **T47 [12/01] Kiroween extras** — blog post (Bonus Blog Prize; must say it is written for Kiroween 2026), social post starting with `#KiroweenHackathon26` (Social Blitz). Both optional (R18.6). Collect Best Student Project details (LinkedIn, student email, year/degree, school). Owner: Alex. Req: R18.5–6.
- [ ] **T48 [12/02] Kiroween video recut (optional)** — same footage, lengthen the Kiro beat (R18.2g, R18.3) and the Resurrection pitch. Keep < 3:00. Req: R18.3.
- [ ] **T49 [12/03] Final Kiro write-up and repo polish** — update `docs/KIRO_USAGE.md`, README badges, confirm `/.kiro` content on GitHub.
- [ ] **T50 [12/04] Submit Kiroween by 12:00 pm Chicago** (deadline 4:00 pm Chicago). Category **Resurrection**; bonus **Best Student Project** (Resurrection). Owner: Alex — final click is Alex's.
