# Demo sources (T06)

Two public-archive PDFs for demos, screenshots and the labeled eval fixture (T17a). Alex chose both on 2026-11-21.

Both are English meeting minutes of US federal advisory bodies, with a real text layer, and both name officials only in their official capacity. Neither is a sensitive case.

| | NHPRC | ACHP |
|---|---|---|
| Title | National Historical Publications and Records Commission, Executive Summary Minutes of November 6, 2015 | Advisory Council on Historic Preservation, Minutes, February 2026 Members Meeting (February 12, 2026) |
| PDF | <https://www.archives.gov/files/nhprc/about/meetings/2015-11-minutes.pdf> | <https://www.achp.gov/sites/default/files/2026-04/ACHPFebruary2026BusinessMeetingMinutes.pdf> |
| Source page | <https://www.archives.gov/nhprc/about/meetings> | <https://www.achp.gov/node/11083> |
| Pages | 8 | 15 |
| Language / text layer | English, text layer present on all 8 pages | English, text layer present on all 15 pages |
| Local copy checked (SHA-256) | `ecb7abc7009f6e7fe95187c483c795100dd0fa375a51640c210eedd7c5be2fd9` | `ccbadd14db5d114503628ea2f7f7a9992f5339382bd16407c85992f8786fd9b9` |

The SHA-256 values are of the copies downloaded on 2026-11-21 and are here so that a later download can be compared. The agency may replace the file at the same URL.

## License and terms

Both documents are works of the US federal government, so they are in the public domain in the United States under 17 U.S.C. § 105. There is no copyright to license and no permission is needed to reuse them.

- US government copyright policy: <https://www.usa.gov/government-copyright>
- 17 U.S.C. § 105: <https://www.copyright.gov/title17/92chap1.html#105>

## How they are used

- The official PDFs are **not committed** to this repository. Download them from the URLs above and open them with "Open local PDF", or use the URL flow.
- Automated tests use the synthetic fixtures in `test/fixtures/` (made-up text) as a smoke test. They are not used for numbers in `docs/EVAL.md`.
- The measured eval fixture (T17a / R17.1) is short quotes from **pages 1–2** of the NHPRC minutes, plus this repo’s pdf.js extraction of those two pages, in `test/fixtures/eval/nhprc-2015-11/`. The official PDF is not in the tree. `scripts/verify-nhprc-eval.mjs` fetches the URL (or takes `--pdf`) and checks the SHA-256 above against a fresh extraction. Gold labels are AI-drafted and pending review by Alex (`docs/eval/NHPRC_GOLD_REVIEW.md`); `reviewedBy` and `reviewedAt` stay empty until that review.
