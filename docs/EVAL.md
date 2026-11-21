# Evaluation

Status: **not yet measured.** No precision, recall or timing number exists for this project yet,
and none may appear in the README, the video script or the Devpost text until a real run has
filled in this file (R17.2 to R17.4). Task T37 produces the measurements.

What exists: a synthetic labeled fixture, `test/fixtures/eval/` (4 pages, 21 entities, 15
relations, labeled by an AI assistant and not yet reviewed by a human; see its README), and a pure
scorer, `src/eval/score.ts`. A unit test replays the gold labels themselves through the extraction
pipeline and the scorer to check the harness; that is not a measurement of any model.

| Measurement | Value | Fixture | Date | Machine | Git SHA |
|---|---|---|---|---|---|
| Entity precision / recall (local) | not yet measured | | | | |
| Relation precision / recall (local) | not yet measured | | | | |
| Entity and relation precision / recall (cloud-enabled) | not yet measured | | | | |
| Wall-clock, local-only run | not yet measured | | | | |
| Wall-clock, cloud-enabled run | not yet measured | | | | |
