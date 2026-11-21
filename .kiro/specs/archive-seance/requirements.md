# Requirements — Archive Séance (档案通灵板)

> Language note: this spec lives in `/.kiro` and is read by hackathon judges, so it is written in English. The Chinese PRD is `PRD.md` at the repo root of the planning bundle.

## Introduction

Archive Séance is a Chrome (Manifest V3) extension. A researcher opens a **public-archive PDF**; the extension extracts **people and organizations** and the **relations** between them, draws them as a **D3 force-directed network**, shows uncertain entity merges as translucent **ghost nodes**, and lets the user **click any node or edge to jump back to the exact source passage** in the PDF.

All AI calls go through **Firebase AI Logic hybrid inference** (Chrome Prompt API / Gemini Nano on-device, Gemini in the cloud). Sensitive documents are processed on-device only. Long documents and cross-page relation extraction may send **redacted, pseudonymized snippets** to the cloud, only after the user has seen and approved what would leave the device.

Primary users: investigative journalists and archival researchers working on public records. Solo hackathon project. Targets: Kiroween 2026 (Resurrection category, Best Student Project bonus) and #BuildHybridAI 2026 (Web/Chrome platform).

### Glossary

- **Mention**: one occurrence of a person/org name in the PDF, with page and character offsets.
- **Entity**: a cluster of one or more mentions the system believes refer to the same real-world person/org.
- **Ghost node**: an entity whose merge confidence is below the auto-merge threshold but above the separate threshold. Rendered translucent, with a dashed ring.
- **Evidence**: a quoted passage supporting a relation or a merge, anchored to page + offsets.
- **Local route / Cloud route**: inference on Gemini Nano via Chrome Prompt API / inference on a cloud Gemini model, both through Firebase AI Logic.
- **Sensitivity**: per-document setting, `sensitive` (default) or `public`.
- **Hybrid payload**: the exact text that would be sent to the cloud for one request.

### Priority legend

- **MUST**: required for the hackathon submission.
- **BONUS**: only after all MUST items work.
- **CUT-FIRST**: dropped first when time runs out; spec kept so Kiro can build it if time remains.

---

## R1 — Open a public-archive PDF (MUST)

**User story:** As a researcher, I want to open a PDF from a URL or from my disk, so that I can analyze an archive document without uploading it anywhere.

Acceptance criteria:
1. WHEN the user clicks the extension action on a tab whose URL ends in `.pdf` or whose content type is PDF, THE SYSTEM SHALL open the app page with that PDF loaded.
2. WHEN the user chooses "Open local PDF" and selects a file, THE SYSTEM SHALL load it without requesting any host permission.
3. WHEN loading a remote PDF requires a host permission the extension does not hold, THE SYSTEM SHALL request that permission for that origin only, and only from a user click.
4. IF the file is not a valid PDF or exceeds `maxPdfMegabytes` (default 50), THEN THE SYSTEM SHALL show an error naming the cause and SHALL NOT start any inference.
5. THE SYSTEM SHALL parse the PDF entirely inside the extension; the PDF bytes SHALL NOT be sent to any server.

## R2 — Build a page-anchored text index (MUST)

**User story:** As a researcher, I want every extracted fact tied to a page and a position, so that I can verify it.

Acceptance criteria:
1. WHEN a PDF is loaded, THE SYSTEM SHALL extract text per page using pdf.js and store, for each page, the normalized text and a table mapping character offsets to pdf.js text-content item indices.
2. THE SYSTEM SHALL split page text into chunks of at most `routeLocalMaxChunkChars` characters on sentence boundaries, never crossing a page boundary, and SHALL record each chunk's `{page, start, end}`.
3. IF a page yields fewer than `minTextCharsPerPage` (default 40) characters, THEN THE SYSTEM SHALL mark the page `no-text` and show "This page looks scanned (no text layer)". THE SYSTEM SHALL NOT silently skip it.
4. THE SYSTEM SHALL keep the index in memory and in `chrome.storage.local` / IndexedDB, keyed by a SHA-256 of the PDF bytes, and SHALL NOT sync it.

## R3 — Extract people, organizations, and relations locally (MUST)

**User story:** As a researcher with a sensitive document, I want extraction to run on my machine, so that nothing leaves it.

Acceptance criteria:
1. WHEN a chunk is processed on the local route, THE SYSTEM SHALL call Firebase AI Logic with a hybrid model whose mode is `ONLY_ON_DEVICE` or `PREFER_ON_DEVICE` (per R4), with `onDeviceParams.promptOptions.responseConstraint` set to the extraction schema.
2. THE SYSTEM SHALL ask the model for entities (`name`, `type` in `person|org`, `quote`) and relations (`subject`, `object`, `label`, `quote`), where each `quote` is a verbatim span from the chunk.
3. WHEN the model returns output, THE SYSTEM SHALL validate it against the schema in code, and SHALL locate every `quote` in the chunk text by exact match, then by whitespace/case-normalized match.
4. IF a quote cannot be located, THEN THE SYSTEM SHALL discard that item and increment the `droppedUnanchored` counter shown in the run summary.
4a. IF an entity's `name` does not appear inside its located quote (whitespace/case-normalized match), THEN THE SYSTEM SHALL discard that entity and increment `droppedUnanchored`. Relations need only a located quote.
5. THE SYSTEM SHALL NOT use model-supplied character offsets; offsets come only from code.
6. WHILE the on-device model is `downloadable` or `downloading`, THE SYSTEM SHALL show download progress and SHALL call `initializeDeviceModel()` only from a user click.
7. THE SYSTEM SHALL record, for every inference call, the `inferenceSource` returned by the SDK (`on_device` or `in_cloud`).
8. THE SYSTEM SHALL start extraction only after the user clicks a primary action labeled "Summon". That click SHALL also be the user gesture used to call `initializeDeviceModel()` when the on-device model still needs initialization.

## R4 — Hybrid routing (MUST)

**User story:** As a user, I want the app to choose between on-device and cloud by clear rules, so that I can predict where my text goes.

Acceptance criteria:
1. THE SYSTEM SHALL implement routing as one pure function `decideRoute(task, doc, env, config)` returning `local`, `cloud`, or `blocked`, with a human-readable `reason`.
2. IF `doc.sensitivity` is `sensitive`, THEN THE SYSTEM SHALL return `local` when the on-device model is available and `blocked` otherwise. THE SYSTEM SHALL NEVER return `cloud` for a sensitive document.
3. IF `doc.sensitivity` is `public` and the task is chunk extraction, THEN THE SYSTEM SHALL return `local` when the on-device model is `available`, and the chunk is at most `routeLocalMaxChunkChars`, subject to the long-document budget in R4.4; otherwise `cloud`. The local budget applies only to documents with more than `routeLongDocPages` pages.
4. IF `doc.sensitivity` is `public` and the document has more than `routeLongDocPages` pages, THEN chunks beyond the local budget SHALL go to the cloud route.
5. IF the task is cross-page relation extraction and `doc.sensitivity` is `public`, THEN THE SYSTEM SHALL return `cloud` (when `cloudEnabled` is true and the browser is online), otherwise `local`. IF `crossPageMode` is `local_only`, THEN THE SYSTEM SHALL return `local` when the on-device model is available and `blocked` otherwise; it SHALL NOT fall through to `cloud`.
6. WHEN a task is an entity-merge adjudication (short, two contexts), THE SYSTEM SHALL return `local` when available, otherwise `cloud` for public documents.
7. IF `cloudEnabled` is false (kill switch), THEN THE SYSTEM SHALL never return `cloud`.
8. WHEN a local call throws or times out (`localCallTimeoutMs`, default 45000), THE SYSTEM SHALL retry once; IF the document is public, it SHALL then re-route that single chunk to the cloud; IF sensitive, it SHALL mark the chunk `failed` and continue.
9. THE SYSTEM SHALL show, per document, a routing summary: chunks processed on-device, chunks processed in the cloud, chunks failed, and cloud payload count and size.
10. WHEN a public document is first queued for the cloud mid-run (long document, budget exhausted, or chunk too large), THE SYSTEM SHALL change a visible status chip from on-device to cloud at that moment, without waiting for the run to finish.
11. WHEN the browser is offline and the on-device model is `available`, THE SYSTEM SHALL finish every local-route task and render the network. Cloud-route tasks SHALL remain `pending-cloud` and SHALL NOT discard the local result.

## R5 — Redaction, pseudonymization, and consent before any cloud call (MUST)

**User story:** As a journalist, I want to see and approve exactly what leaves my device, so that I stay in control.

Acceptance criteria:
1. THE SYSTEM SHALL redact, in code and before any cloud request, these patterns: email addresses, phone numbers, SSN-like and national-ID-like numbers, bank/card-like digit runs, street addresses with house numbers, and dates of birth following the words "born", "DOB", "birth".
2. WHERE entity names are already known from the local pass, THE SYSTEM SHALL replace each person and org name in cloud snippets with a stable placeholder (`PERSON_n`, `ORG_n`) before sending, and SHALL map the placeholders back locally after the response.
3. THE SYSTEM SHALL send the cloud route only snippets (the sentence containing the mention plus at most `snippetContextSentences` neighbors, default 1), never whole pages, for cross-page relation extraction.
4. BEFORE the first cloud request of a session, THE SYSTEM SHALL show a consent dialog listing: what is sent, the redaction rules applied, the number of snippets, and a scrollable preview of the exact payload. THE SYSTEM SHALL send nothing until the user clicks "Send redacted snippets".
5. THE SYSTEM SHALL keep a local "Outbound log" (timestamp, request kind, payload size, SHA-256 of payload, route) that the user can open and clear.
6. IF a redaction function throws, THEN THE SYSTEM SHALL abort that cloud request and SHALL NOT send an unredacted fallback.
7. THE SYSTEM SHALL state in the UI and README that redaction is best-effort and cannot guarantee anonymity.
8. THE SYSTEM SHALL keep the last user-approved cloud payload in memory for the session (cleared when the session ends or the user clears the outbound log) and SHALL let the user re-open it, together with the redaction rules and counts, from the Outbound log or the Consent panel. THE SYSTEM SHALL NOT write that payload text to disk.

## R6 — Cross-page relation extraction (MUST)

**User story:** As a researcher, I want relations that appear across different pages to be linked, so that I see the network the document implies.

Acceptance criteria:
1. WHEN entity extraction has finished, THE SYSTEM SHALL compute in code the candidate entity pairs that co-occur within the same sentence, or on two pages within `crossPageWindow` (default 5) pages, with at least `minPairSupport` (default 2) co-occurrences.
2. THE SYSTEM SHALL build one batch request per group of at most `crossPageBatchPairs` (default 12) candidate pairs, each with its evidence snippets.
3. THE SYSTEM SHALL ask the model only to label each pair's relation from a closed set (`employed-by`, `member-of`, `family`, `business-partner`, `met-with`, `communicated-with`, `mentioned-together`, `none`) and to cite the snippet id supporting it.
4. IF a returned snippet id does not exist in the request, THEN THE SYSTEM SHALL discard that label.
5. THE SYSTEM SHALL store the relation's evidence list with page and offsets, and the route used.

## R7 — Entity merging and ghost nodes (MUST)

**User story:** As a researcher, I want name variants merged, but I want to see which merges are uncertain, so that I do not trust a guess.

Acceptance criteria:
1. THE SYSTEM SHALL compute merge confidence in code from name similarity, shared-neighbor overlap, and, optionally, a local-model verdict, using the formula in `design.md` (section "Entity merge and ghost-node confidence").
2. IF two candidates have different types, THEN THE SYSTEM SHALL NOT merge them.
3. IF the confidence of every pair in a cluster is at least `mergeAutoThreshold` (default 0.92), THEN THE SYSTEM SHALL render the merged entity as a solid node.
4. IF the confidence of every pair in a cluster is at least `mergeGhostThreshold` (default 0.60) and at least one pair is below `mergeAutoThreshold`, THEN THE SYSTEM SHALL render one ghost node with opacity derived from the weakest pair, and a dashed ring.
5. IF any pair is below `mergeGhostThreshold`, THEN THE SYSTEM SHALL keep the two entities separate (complete-linkage clustering; no chaining).
6. WHEN the user clicks a ghost node, THE SYSTEM SHALL show the member names, the weakest link, the score breakdown, evidence quotes, and buttons "Confirm same", "Split", and "Not sure".
7. WHEN the user confirms or splits, THE SYSTEM SHALL persist the decision, and THE SYSTEM SHALL honor it on every re-run for the same PDF hash.
8. THE SYSTEM SHALL NOT let the model alone decide a merge; the model verdict is an input to the code formula, capped to a 0.15 weight.
9. THE GHOST detail card SHALL show the current `mergeGhostThreshold` and `mergeAutoThreshold` values and their source (`live` Remote Config, local Settings override, or compiled defaults).

## R8 — Network visualization (MUST)

**User story:** As a researcher, I want to see the people and organizations as a network, so that I can spot structure quickly.

Acceptance criteria:
1. THE SYSTEM SHALL render entities as nodes and relations as edges using D3 force simulation in an SVG (or canvas when nodes exceed `svgMaxNodes`, default 400).
2. THE SYSTEM SHALL encode type by shape (circle = person, square = org), mention count by node size, and relation label by edge style, and SHALL provide a legend.
3. THE SYSTEM SHALL support zoom, pan, drag, search-by-name, and filter by type and by minimum mention count.
4. THE SYSTEM SHALL never render a node or edge that has no stored evidence.
5. THE SYSTEM SHALL show on each node and edge a small badge `on-device` or `cloud` showing the route that produced it (mixed shows both).
6. THE SYSTEM SHALL remain interactive (frames under 100 ms for input) with up to 400 nodes and 1,000 edges.
7. As extraction proceeds, THE SYSTEM SHALL add nodes and edges to the graph incrementally (the network grows), not only at the end of the run.
8. THE SYSTEM SHALL use the séance / Halloween visual language in `design.md` §11 (parchment background, planchette selection ring, breathing ghosts, encodings that are not color-only).

## R9 — Jump back to the source passage (MUST)

**User story:** As a journalist, I want one click from a node to the original sentence, so that I can verify before I publish.

Acceptance criteria:
1. WHEN the user clicks a node, THE SYSTEM SHALL open the evidence list for that entity and navigate the embedded PDF viewer to the first evidence page, highlighting the quoted span.
2. WHEN the user clicks an edge, THE SYSTEM SHALL do the same for its first evidence passage.
3. WHEN the user clicks an evidence item, THE SYSTEM SHALL scroll to its page and highlight its span.
4. THE SYSTEM SHALL render the PDF with pdf.js in an extension page and highlight by mapping stored offsets to text-content items.
5. IF the highlight cannot be mapped (for example, the text layer differs), THEN THE SYSTEM SHALL still navigate to the page and show the quote in a banner.
6. WHEN the user selects text in the PDF viewer that matches a known mention, THE SYSTEM SHALL highlight the corresponding node in the graph.

## R10 — App Check and secrets (MUST)

**User story:** As the developer, I want the Gemini API protected by App Check without leaking secrets, so that the repo is safe to publish.

Acceptance criteria:
1. THE SYSTEM SHALL initialize Firebase App Check before creating any `GenerativeModel`.
2. THE SYSTEM SHALL use the App Check debug provider in development builds and SHALL read the debug token from `VITE_APPCHECK_DEBUG_TOKEN` at build time from an untracked env file, never from a committed file.
3. THE REPOSITORY SHALL contain `.env.example` with empty values and SHALL list `.env*` (except `.env.example`) in `.gitignore`. THE REPOSITORY SHALL NOT list `.kiro` or any child path in `.gitignore`.
4. THE CI check `npm run check:secrets` SHALL fail the build if the working tree or git history contains a UUID-shaped debug token, a string starting with `AIza` outside `.env*`, or `FIREBASE_APPCHECK_DEBUG_TOKEN = "` followed by a literal.
5. THE SYSTEM SHALL NOT bundle the reCAPTCHA App Check provider, because Chrome Web Store Manifest V3 forbids remotely hosted code. A production attestation path is out of scope for the hackathon and is documented in README under "Limits".
6. THE SYSTEM SHALL show an "App Check: active (debug)" status chip, and a clear error when a cloud call fails with an App Check rejection.

## R11 — Remote Config thresholds (BONUS)

**User story:** As the developer, I want to change routing thresholds without republishing, so that I can tune the local/cloud split live in the demo.

Acceptance criteria:
1. WHERE Remote Config is supported in the extension page (`isSupported()` returns true), THE SYSTEM SHALL fetch and activate the parameters listed in `design.md` at startup and at most once per `rcMinFetchIntervalSeconds`.
2. IF Remote Config is unsupported, fails, or times out in 3 seconds, THEN THE SYSTEM SHALL use compiled defaults and show "Config: defaults".
3. THE SYSTEM SHALL validate every fetched value (type and range) and ignore invalid values individually.
4. THE SYSTEM SHALL show "Config: live (fetched hh:mm)" when values were fetched successfully.
5. Independently of Remote Config, THE SYSTEM SHALL offer a Settings panel that edits the same parameter keys listed in `design.md` §9.3, persisted in `chrome.storage.local`. A user-set local override wins until the user chooses "Use live config". IF Remote Config is unavailable, Settings alone SHALL be enough to change merge and routing thresholds in the demo.

## R12 — Transparency and failure handling (MUST)

**User story:** As a user, I want clear messages when something is unavailable, so that I know what to do next.

Acceptance criteria:
1. WHEN `LanguageModel` is missing, or `availability()` is `unavailable`, THE SYSTEM SHALL show the reason class (browser too old, hardware, storage, policy) when known, and the next step, and THE SYSTEM SHALL route per R4. IF the document is `public`, THE SYSTEM SHALL offer to continue on the cloud route (the consent flow of R5 still applies). The "no on-device model" demonstration SHALL use a `public` document; a `sensitive` document remains blocked per R4.2.
2. WHEN a document is `sensitive` and the on-device model is unavailable, THE SYSTEM SHALL show "Blocked: this document is set to stay on this device" with a button to switch the document to `public` (which requires the consent flow of R5).
3. WHEN the browser is offline and the on-device model is `available`, THE SYSTEM SHALL finish local-route extraction and render the network, and SHALL queue any cloud-route tasks as `pending-cloud` (see also R4.11).
4. WHEN the cloud returns quota, App Check, or network errors, THE SYSTEM SHALL back off with exponential delay (max 3 attempts), then mark the task `failed` without blocking others.
5. THE SYSTEM SHALL display a persistent run summary with counts of: chunks, entities, relations, ghost nodes, dropped-unanchored items, tasks failed.
6. THE SYSTEM SHALL label all outputs as "machine-extracted; verify against source".

## R13 — Repository, license, and disclosure compliance (MUST)

**User story:** As the entrant, I want the submission to meet both hackathon rule sets, so that it is not disqualified.

Acceptance criteria:
1. THE REPOSITORY SHALL be public on GitHub, include an `LICENSE` file with Apache-2.0 detectable by GitHub, and contain `/.kiro` at its root with specs, steering and hooks committed.
2. THE REPOSITORY SHALL contain `docs/PRIOR_ART.md` stating: all code was written on or after 2026-10-30; the project reuses no code from the author's earlier work, with no exceptions; no external papers, preprints, or projects were used as references; the author's own Zenodo preprint (DOI 10.5281/zenodo.23962378) is not used as a reference or a source of ideas; and listing the third-party libraries.
3. THE REPOSITORY SHALL contain `NOTICE`/`THIRD_PARTY.md` listing third-party libraries and licenses.
4. THE REPOSITORY SHALL demonstrate Firebase AI Logic being imported and called at runtime (`src/ai/firebase.ts`, `src/ai/models.ts`). The README SHALL name the file and function of the runtime call, not only the directory.
5. THE DEMO fixtures SHALL be neutral public archives with no sensitive cases and no personal data of private individuals, with source URLs recorded in `docs/DEMO_SOURCES.md`.
6. THE README SHALL describe install and run steps for a judge in English, in at most 10 steps, and SHALL state what runs without a Firebase project and what needs one.

## R14 — Scanned-PDF OCR (CUT-FIRST)

Acceptance criteria:
1. WHERE a page is `no-text` and the user clicks "Recognize this page", THE SYSTEM SHALL render the page to a PNG and send it to the model through the same router as text, using an image part.
2. THE SYSTEM SHALL treat OCR output as lower-trust, mark every item from it `ocr: true`, and halve its contribution to merge confidence.
3. IF the route is `local`, THE SYSTEM SHALL use a PNG or JPEG image only, and SHALL not retry with other formats.
4. THE SYSTEM SHALL only start this work after the MUST items pass their tests, and no earlier than 2026-11-26.

## R15 — Multiple documents in one board (CUT-FIRST)

Acceptance criteria:
1. WHEN the user adds a second PDF, THE SYSTEM SHALL keep a separate page index per document and merge entities across documents using R7 with a `crossDocPenalty` of 0.05.
2. THE SYSTEM SHALL tag every evidence item with its document.

## R16 — Export (CUT-FIRST)

Acceptance criteria:
1. WHEN the user clicks "Export", THE SYSTEM SHALL write a JSON file (schema in design.md) and a CSV of edges, including evidence quotes, page numbers, route, and ghost status.
2. THE EXPORT SHALL contain a field `machineExtracted: true` and the tool version.

---

## R17 — Measured evaluation and recorded findings (MUST)

**User story:** As the entrant, I want precision, recall, timings, and property-test findings from real runs, so that judge answers use only measured numbers.

Acceptance criteria:
1. THE REPOSITORY SHALL contain an eval fixture under `test/fixtures/eval/` built from short quotes taken from 1–2 pages of the NHPRC public-domain PDF listed in `docs/DEMO_SOURCES.md`, with gold mentions and relations. The gold labels MAY be drafted by AI but SHALL be reviewed by the author before any measured run; the fixture SHALL record the reviewer and review date. The synthetic fixture SHALL remain as a smoke test only and SHALL NOT be used for numbers in `docs/EVAL.md`.
1a. IF the gold labels have not been reviewed, THEN `npm run eval` SHALL refuse to write accuracy numbers to `docs/EVAL.md`.
2. `npm run eval` SHALL compare pipeline output to the gold labels and write precision and recall for entities and for relations to `docs/EVAL.md`, including the fixture id, the date, the machine, and the git SHA. THE FILE SHALL NOT contain placeholder or invented numbers.
3. THE SAME evaluation pass (or `npm run eval:timing`) SHALL record wall-clock time for a local-only run and a cloud-enabled run of the same document, on a named machine, in `docs/EVAL.md`.
4. IF a measurement has not yet been run, THE FILE SHALL say "not yet measured", and no numeric accuracy or timing claim SHALL appear in the README, the video script, or the Devpost text.
5. Property-based tests SHALL cover the seven merge properties in `design.md` §7.6. WHEN a property test finds a real defect, THE REPOSITORY SHALL record the failing input, the incorrect behavior, and the fix in `docs/PBT_FINDINGS.md`. Invented findings are not allowed; if none has been found yet, the file SHALL say so.

## R18 — Demo video and submission packets (MUST)

**User story:** As the entrant, I want the video and both Devpost packets to cover the contest playbook storyboard and checklists, so that nothing required is missing on submission day.

Acceptance criteria:
1. THE VIDEO SHALL be at most three minutes, uploaded to public YouTube, with English subtitles, and SHALL NOT use copyrighted music.
2. THE VIDEO SHALL include these shots, in some order: (a) a public-archive PDF opened in the extension; (b) the user clicking Summon and the network growing; (c) a node click jumping to the highlighted source sentence; (d) a ghost node opened with its score explanation; (e) a local extraction completing with the network disabled (DevTools offline or airplane mode); (f) a longer public document whose UI shows a switch to the cloud route and the consent / last-approved redacted payload; (g) a brief view of `/.kiro` specs, hooks, or steering, plus the documented property-test finding from `docs/PBT_FINDINGS.md` (or an honest "not yet found" if that is the state); (h) the closing line and the project link.
3. A #BuildHybridAI cut MAY lengthen shot (f); a Kiroween cut MAY lengthen shot (g). Both cuts must stay under three minutes.
4. THE DEVPOST TEXT for #BuildHybridAI SHALL select platform Web/Chrome, describe how Firebase AI Logic is used and how local versus cloud work is split, and point to the README call-site required by R13.4.
5. THE DEVPOST TEXT for Kiroween SHALL select the Resurrection category, include Best Student Project fields when applying, and include or link `docs/KIRO_USAGE.md` covering spec-driven development, hooks, steering, MCP (or an explicit "not used"), and property-based testing, with examples from this repository's history.
6. Optional: a social post whose first characters are `#KiroweenHackathon26`; a public blog post that states it is written as part of Kiroween 2026.
7. Testing access SHALL be a README path to load the unpacked extension, or a hosted demo page, with no secrets in the instructions (see `design.md` §9.4).

## Non-functional requirements

- **NFR1 Privacy by default:** documents default to `sensitive`; the cloud path is opt-in per document.
- **NFR2 Honesty:** every cloud call and every dropped item is visible to the user.
- **NFR3 Performance:** a 30-page text PDF finishes extraction in under 5 minutes on a supported laptop on the local route, and under 2 minutes with the cloud route enabled.
- **NFR4 Accessibility:** keyboard-navigable node list as an alternative to the canvas; color is never the only encoding.
- **NFR5 Testability:** the router, redaction, merge, quote-locator, and span-mapper are pure functions with unit and property-based tests. Merge properties and their recorded findings are also R17.5.
- **NFR6 Supported platform:** Chrome desktop 139+ for on-device inference (Firebase AI Logic hybrid requirement); cloud-only mode works on any Chromium that can load the extension. Hardware needed for Gemini Nano is documented in README.
