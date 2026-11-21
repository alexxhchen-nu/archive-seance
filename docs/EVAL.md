# Evaluation

Status: **not yet measured.** No precision, recall or timing number exists for this project yet,
and none may appear in the README, the video script or the Devpost text until a real run has
filled in this file (R17.2 to R17.4). Task T37 produces the measurements, and only after the
NHPRC gold set has been reviewed (R17.1a).

## Fixtures

- **Measured gold (reviewed):** short quotes from pages 1–2 of the NHPRC Executive Summary
  Minutes of 6 November 2015, in `test/fixtures/eval/nhprc-2015-11/`. AI-drafted on 2026-11-21.
  Reviewed by Alex Chen on 2026-11-21 (all items kept, no edits). Review sheet:
  `docs/eval/NHPRC_GOLD_REVIEW.md`. `npm run eval` refuses to write accuracy numbers for any
  gold whose `reviewedBy` / `reviewedAt` are empty.
- **Smoke test only:** the synthetic fixture `test/fixtures/eval/` (4 pages, 21 entities, 15
  relations). A unit test replays those gold labels through the pipeline and scorer to check
  the harness. That fixture is **not** used for numbers in this file.

## Author review (R17.1 / R17.1a)

- [x] Alex has reviewed `docs/eval/NHPRC_GOLD_REVIEW.md` (2026-11-21: all items kept).
- [x] Fixes from the review are in `test/fixtures/eval/nhprc-2015-11/gold.json` (none needed).
- [x] `reviewedBy` and `reviewedAt` are set in that file.
- [ ] Only then may T37 run `npm run eval` and write real numbers below.

| Measurement | Value | Fixture | Date | Machine | Git SHA |
|---|---|---|---|---|---|
| Entity precision / recall (local) | not yet measured | | | | |
| Relation precision / recall (local) | not yet measured | | | | |
| Entity and relation precision / recall (cloud-enabled) | not yet measured | | | | |
| Wall-clock, local-only run | not yet measured | | | | |
| Wall-clock, cloud-enabled run | not yet measured | | | | |

## How to measure (R17.2, R17.3)

The model runs only inside Chrome, so `npm run eval` scores a predictions file exported from a
real extension run. It never calls a model itself.

1. Build the real extension (not `build:mock`): `npm run build`, then load `dist/` in Chrome
   with `.env.local` filled in. Exports from the mock build are refused.
2. Open the official NHPRC PDF (see `docs/DEMO_SOURCES.md`; the extension refuses to export if
   the file's SHA-256 does not match) in the extension page.
3. In the probe panel click **Export eval run (local-only)**. For the cloud-enabled row, click
   **Export eval run (cloud-enabled)**. Each click runs the extraction pipeline on pages 1–2 and
   downloads a JSON file (fixture id, mode, inference-source counts, entities with page and
   quote, relations, wall-clock ms, timestamp, build flavor, git SHA). The cloud extraction path
   is not built yet, so a cloud-enabled export only scores chunks the router sent locally;
   cloud-routed chunks stay pending-cloud and are omitted.
4. Score each file:
   `npm run eval -- --predictions <downloaded-file>.json --machine "<machine name>"`
5. The command rewrites only the rows for that mode in the table above (plus the wall-clock row),
   with fixture, date, machine and git SHA. Rerunning the same mode replaces its rows.

Exit codes: 1 gold unreviewed (R17.1a), 2 no `--predictions`, 3 invalid file or fixture
mismatch, 4 mock-build run. On any non-zero exit this file is not changed.

