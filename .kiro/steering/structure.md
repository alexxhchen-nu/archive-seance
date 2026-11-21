---
inclusion: always
---
# Structure — where things live

```
.kiro/{specs,steering,hooks}   committed, never ignored
docs/                          PRIOR_ART, DEMO_SOURCES, SPIKE_RESULTS, DECISIONS, KIRO_USAGE, PRIVACY, MANUAL_TEST
public/manifest.json           MV3 manifest
src/background/sw.ts           entry points only (toolbar click, context menu)
src/app/                       app page UI: state/, graph/, viewer/, panels/
src/pdf/                       loadPdf, pageIndex, chunker, spanMapper
src/pipeline/                  runExtraction, locateQuote, candidatePairs, runCrossPage
src/ai/                        firebase, models, schemas, prompts, router, availability, call
src/privacy/                   redact, pseudonymize, payload, outboundLog
src/storage/                   IndexedDB `seance` cache (schema, openDb, indexCache)
src/graph/                     similarity, confidence, cluster, merge, toGraph
src/config/                    defaults, remoteConfig, validate
src/types/                     shared types and message types
test/{unit,property,fixtures}  mirrors src/ paths
scripts/                       check-secrets.mjs, check-bundle-rhc.mjs
```

## Conventions
- One exported concept per file; file name = main export. Pure logic has no imports from `src/app/` or the `chrome.*` / `firebase/*` namespaces (inject them), so it can be tested in Node.
- Test file for `src/x/y.ts` is `test/unit/x/y.test.ts`; property tests `test/property/x/y.property.test.ts`.
- IDs: document id = SHA-256 hex of PDF bytes; chunk id `${docId}:${page}:${start}`.
- Offsets are character offsets into the normalized page text, `start` inclusive, `end` exclusive.
- Commit messages: `T##: summary` referencing `tasks.md`. Mark tasks done in `tasks.md` in the same commit.
- The spec is the source of truth: if code and spec disagree, update the spec first, then the code.
