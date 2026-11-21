# NHPRC eval fixture (pages 1–2)

Measured gold set for R17, built from short quotes on pages 1 and 2 of the
NHPRC Executive Summary Minutes of 6 November 2015 (a US federal work, public
domain under 17 U.S.C. § 105).

- Source PDF (not committed): <https://www.archives.gov/files/nhprc/about/meetings/2015-11-minutes.pdf>
- `gold.json`: entities, relations, and capitalized non-entities, with verbatim
  quotes and page numbers. `reviewedBy` and `reviewedAt` are `null` until Alex
  reviews the set (`docs/eval/NHPRC_GOLD_REVIEW.md`).
- `pages.json`: this repository’s pdf.js extraction of those two pages only, so
  tests can locate quotes without downloading the official PDF. Public domain.
- `npm run verify:nhprc-eval` fetches (or takes `--pdf`) the official file,
  checks the SHA-256 in `docs/DEMO_SOURCES.md`, and compares the extraction
  to `pages.json`.

The labels were drafted by an AI assistant on 2026-11-21 and are **not yet
reviewed**. `npm run eval` will refuse to write accuracy numbers until the
review fields are set. The synthetic fixture in `test/fixtures/eval/` remains a
smoke test and is not used for EVAL numbers.
