# NHPRC gold review (pages 1–2)

Please review this gold set before any measured run (T37 / R17). Budget **20–30 minutes**.

**Source:** [NHPRC Executive Summary Minutes, 6 November 2015](https://www.archives.gov/files/nhprc/about/meetings/2015-11-minutes.pdf), pages 1–2. US federal work, public domain under 17 U.S.C. § 105.

**Status:** AI-drafted on 2026-11-21. `reviewedBy` and `reviewedAt` in `test/fixtures/eval/nhprc-2015-11/gold.json` are `null` until you finish.

## How to mark the tables

For each row, tick **one** of Keep, Fix, or Drop. Use the Notes column for a corrected name, alias, quote, label, or a reason to drop.

- **Keep** if the item is right as written.
- **Fix** if the identity is right but the quote, alias, or relation label should change. R3.4a: an entity’s name or an alias must appear in its quote after whitespace and case normalization.
- **Drop** if it should not be in the gold set.

Attendance-list people (Commission members and NHPRC staff on page 1) can be reviewed as a block: if the list is complete and correctly affiliated, tick Keep on those rows together.

Items flagged “please confirm” are the most interpretive. Look at those first.

When you are done, set in `gold.json`:

```json
{ "reviewedBy": "Alex Chen", "reviewedAt": "2026-11-XX" }
```

and tell the assistant so `npm run eval` can be allowed to write accuracy numbers in T37. Until then, `npm run eval` will refuse and `docs/EVAL.md` stays “not yet measured.”

The quotes are verbatim spans of this repository’s pdf.js page text (see `pages.json`), which may differ slightly from a visual reading of the PDF (headers and line breaks are flattened; hyphenation can appear as `re- branding`).

## People

25 entities. One row per entity; all mention quotes are listed.

| # | Name (aliases) | Mentions (page: quote) | Keep | Fix | Drop | Notes |
|---|---|---|:---:|:---:|:---:|---|
| 1 | David S. Ferriero<br>aliases: Mr. Ferriero, David S. Ferriero, chairman, David S. Ferriero, Chairperson | p1: “The meeting was called to order by David S. Ferriero, chairman”<br>p1: “Commission Members present: David S. Ferriero, Chairperson”<br>p1: “Mr. Ferriero welcomed everyone to the meeting”<br>p2: “Mr. Ferriero called for adoption of the agenda”<br>p2: “Mr. Ferriero said the plan was an opportunity to codify his belief”<br>p2: “Mr. Ferriero pointed to the President’s Open Government initiatives” | ☐ | ☐ | ☐ | |
| 2 | W. Eric Emerson<br>aliases: Mr. Emerson | p1: “W. Eric Emerson”<br>p2: “Ms. Mahan and Mr. Emerson expressed some concern” | ☐ | ☐ | ☐ | |
| 3 | Peter Gottlieb<br>aliases: Mr. Gottlieb | p1: “Peter Gottlieb”<br>p2: “The plan, Mr. Gottlieb said, indicates that this is not business as usual”<br>p2: “Mr. Gottlieb said that this adds a layer of context and background to the plan” | ☐ | ☐ | ☐ | |
| 4 | Karen Jefferson<br>aliases: Ms. Jefferson | p1: “Karen Jefferson”<br>p2: “Ms. Jefferson liked the new mission and vision” | ☐ | ☐ | ☐ | |
| 5 | Erin Mahan<br>aliases: Ms. Mahan | p1: “Erin Mahan”<br>p2: “as Ms. Mahan offered, we are not substituting the work of volunteers”<br>p2: “Ms. Mahan and Mr. Emerson expressed some concern” | ☐ | ☐ | ☐ | |
| 6 | Kaye Lanning Minchew | p1: “Kaye Lanning Minchew” | ☐ | ☐ | ☐ | |
| 7 | Naomi Nelson<br>aliases: Ms. Nelson | p1: “Naomi Nelson”<br>p2: “Ms. Nelson pointed to the importance of collaboration with other funders” | ☐ | ☐ | ☐ | |
| 8 | Stephen P. Randolph<br>aliases: Stephen Randolph, Mr. Randolph | p1: “Stephen P. Randolph”<br>p2: “a memo on a proposed “Course of Action” by Stephen Randolph”<br>p2: “Mr. Randolph stated that this plan moves the Commission to a more proactive role” | ☐ | ☐ | ☐ | |
| 9 | Raymond Smock<br>aliases: Mr. Smock | p1: “Raymond Smock”<br>p2: “Mr. Smock agreed that leadership was important”<br>p2: “Mr. Smock asked where the new money would come from”<br>p2: “Mr. Smock agreed, saying that certain aspects of professional work can only be done by professionals” | ☐ | ☐ | ☐ | |
| 10 | George Miles | p1: “Via teleconference George Miles” | ☐ | ☐ | ☐ | |
| 11 | William G. Thomas, III<br>aliases: Mr. Thomas, William G. Thomas III | p1: “William G. Thomas, III”<br>p2: “Mr. Thomas expressed his enthusiasm for the new plan”<br>p2: “Mr. Thomas suggested that we emphasize greater public participation in archives” | ☐ | ☐ | ☐ | |
| 12 | Kathleen Williams<br>aliases: Ms. Williams | p1: “Kathleen Williams, Executive Director”<br>p2: “Ms. Williams agreed that we have to be creative in finding additional resources”<br>p2: “Ms. Williams said that we will need three things to make it work” | ☐ | ☐ | ☐ | |
| 13 | Lucy Barber | p1: “Lucy Barber” | ☐ | ☐ | ☐ | |
| 14 | Keith Donohue | p1: “Keith Donohue” | ☐ | ☐ | ☐ | |
| 15 | Alexander Lorch | p1: “Alexander Lorch” | ☐ | ☐ | ☐ | |
| 16 | Darrell Meadows | p1: “Darrell Meadows” | ☐ | ☐ | ☐ | |
| 17 | Nancy Melley | p1: “Nancy Melley” | ☐ | ☐ | ☐ | |
| 18 | Daniel A. Stokes | p1: “Daniel A. Stokes” | ☐ | ☐ | ☐ | |
| 19 | Robyn Engibous | p1: “Robyn Engibous, for Senator Daniel Sullivan” | ☐ | ☐ | ☐ | |
| 20 | Daniel Sullivan<br>aliases: Senator Daniel Sullivan | p1: “for Senator Daniel Sullivan” | ☐ | ☐ | ☐ | |
| 21 | Christopher Brick | p1: “Christopher Brick, Editor, the Eleanor Roosevelt Papers” | ☐ | ☐ | ☐ | |
| 22 | Barbara Teague | p1: “Barbara Teague, Library of Virginia” | ☐ | ☐ | ☐ | |
| 23 | Lee White | p1: “Lee White, National Coalition for History” | ☐ | ☐ | ☐ | |
| 24 | Meg Phillips | p1: “Meg Phillips, NARA External Affairs” | ☐ | ☐ | ☐ | |
| 25 | Shawn Morton | p1: “Shawn Morton, NARA Congressional Affairs” | ☐ | ☐ | ☐ | |

## Organizations

9 entities. One row per entity; all mention quotes are listed.

| # | Name (aliases) | Mentions (page: quote) | Keep | Fix | Drop | Notes |
|---|---|---|:---:|:---:|:---:|---|
| 1 | National Historical Publications and Records Commission<br>aliases: NHPRC, the Commission | p1: “National Historical Publications and Records Commission”<br>p1: “NHPRC staff present”<br>p1: “efforts from the House Oversight Committee to use NHPRC funds”<br>p1: “brought the Commission up to date”<br>p2: “the relationship between the National Archives and NHPRC has to be preserved”<br>p2: “the Commission is separate and independent from the National Archives”<br>p2: ““re- branding” the work of the Commission”<br>p2: “expanding the role of the NHPRC without expanding resources” | ☐ | ☐ | ☐ | |
| 2 | National Archives<br>aliases: the National Archives | p1: “in the Archivist’s Board Room of the National Archives in Washington, DC”<br>p2: “the relationship between the National Archives and NHPRC has to be preserved”<br>p2: “the Commission is separate and independent from the National Archives”<br>p2: “plays an important role in what the National Archives does” | ☐ | ☐ | ☐ | |
| 3 | House Oversight Committee | p1: “efforts from the House Oversight Committee to use NHPRC funds” | ☐ | ☐ | ☐ | |
| 4 | Eleanor Roosevelt Papers<br>aliases: the Eleanor Roosevelt Papers | p1: “Christopher Brick, Editor, the Eleanor Roosevelt Papers” | ☐ | ☐ | ☐ | |
| 5 | Library of Virginia | p1: “Barbara Teague, Library of Virginia” | ☐ | ☐ | ☐ | |
| 6 | National Coalition for History | p1: “Lee White, National Coalition for History” | ☐ | ☐ | ☐ | |
| 7 | NARA External Affairs | p1: “Meg Phillips, NARA External Affairs” | ☐ | ☐ | ☐ | |
| 8 | NARA Congressional Affairs | p1: “Shawn Morton, NARA Congressional Affairs” | ☐ | ☐ | ☐ | |
| 9 | Strategic Planning Committee<br>aliases: the Strategic Planning Committee, the Planning Committee, Planning Committee | p2: “On behalf of the Strategic Planning Committee”<br>p2: “the work of the Planning Committee in revising the document” | ☐ | ☐ | ☐ | |

## Relations

25 relations. Labels are from the closed set: employed-by, member-of, family, business-partner, met-with, communicated-with.

| # | Subject | Object | Label | Page | Quote | Keep | Fix | Drop | Notes |
|---|---|---|---|:---:|---|:---:|:---:|:---:|---|
| 1 | Raymond Smock | National Historical Publications and Records Commission | member-of | 1 | “Commission Members present: David S. Ferriero, Chairperson W. Eric Emerson Peter Gottlieb Karen Jefferson Erin Mahan Kaye Lanning Minchew Naomi Nelson Stephen P. Randolph Raymond Smock” | ☐ | ☐ | ☐ |  |
| 2 | Stephen P. Randolph | National Historical Publications and Records Commission | member-of | 1 | “Commission Members present: David S. Ferriero, Chairperson W. Eric Emerson Peter Gottlieb Karen Jefferson Erin Mahan Kaye Lanning Minchew Naomi Nelson Stephen P. Randolph” | ☐ | ☐ | ☐ |  |
| 3 | Naomi Nelson | National Historical Publications and Records Commission | member-of | 1 | “Commission Members present: David S. Ferriero, Chairperson W. Eric Emerson Peter Gottlieb Karen Jefferson Erin Mahan Kaye Lanning Minchew Naomi Nelson” | ☐ | ☐ | ☐ |  |
| 4 | Kaye Lanning Minchew | National Historical Publications and Records Commission | member-of | 1 | “Commission Members present: David S. Ferriero, Chairperson W. Eric Emerson Peter Gottlieb Karen Jefferson Erin Mahan Kaye Lanning Minchew” | ☐ | ☐ | ☐ |  |
| 5 | Erin Mahan | National Historical Publications and Records Commission | member-of | 1 | “Commission Members present: David S. Ferriero, Chairperson W. Eric Emerson Peter Gottlieb Karen Jefferson Erin Mahan” | ☐ | ☐ | ☐ |  |
| 6 | Karen Jefferson | National Historical Publications and Records Commission | member-of | 1 | “Commission Members present: David S. Ferriero, Chairperson W. Eric Emerson Peter Gottlieb Karen Jefferson” | ☐ | ☐ | ☐ |  |
| 7 | Peter Gottlieb | National Historical Publications and Records Commission | member-of | 1 | “Commission Members present: David S. Ferriero, Chairperson W. Eric Emerson Peter Gottlieb” | ☐ | ☐ | ☐ |  |
| 8 | W. Eric Emerson | National Historical Publications and Records Commission | member-of | 1 | “Commission Members present: David S. Ferriero, Chairperson W. Eric Emerson” | ☐ | ☐ | ☐ |  |
| 9 | David S. Ferriero | National Historical Publications and Records Commission | member-of | 1 | “Commission Members present: David S. Ferriero” | ☐ | ☐ | ☐ |  |
| 10 | Christopher Brick | Eleanor Roosevelt Papers | employed-by | 1 | “Christopher Brick, Editor, the Eleanor Roosevelt Papers” | ☐ | ☐ | ☐ |  |
| 11 | Barbara Teague | Library of Virginia | employed-by | 1 | “Barbara Teague, Library of Virginia” | ☐ | ☐ | ☐ |  |
| 12 | Lee White | National Coalition for History | member-of | 1 | “Lee White, National Coalition for History” | ☐ | ☐ | ☐ | Please confirm: apposition labeled member-of rather than employed-by. |
| 13 | Meg Phillips | NARA External Affairs | employed-by | 1 | “Meg Phillips, NARA External Affairs” | ☐ | ☐ | ☐ |  |
| 14 | Shawn Morton | NARA Congressional Affairs | employed-by | 1 | “Shawn Morton, NARA Congressional Affairs” | ☐ | ☐ | ☐ |  |
| 15 | Robyn Engibous | Daniel Sullivan | communicated-with | 1 | “Robyn Engibous, for Senator Daniel Sullivan” | ☐ | ☐ | ☐ | Please confirm: “for Senator Daniel Sullivan” is labeled communicated-with (attended on his behalf). Drop or change the label if you disagree. |
| 16 | Stephen P. Randolph | Strategic Planning Committee | member-of | 2 | “by Stephen Randolph. On behalf of the Strategic Planning Committee” | ☐ | ☐ | ☐ |  |
| 17 | George Miles | National Historical Publications and Records Commission | member-of | 1 | “Via teleconference George Miles William G. Thomas, III” | ☐ | ☐ | ☐ |  |
| 18 | William G. Thomas, III | National Historical Publications and Records Commission | member-of | 1 | “Via teleconference George Miles William G. Thomas, III” | ☐ | ☐ | ☐ |  |
| 19 | Kathleen Williams | National Historical Publications and Records Commission | employed-by | 1 | “NHPRC staff present: Kathleen Williams” | ☐ | ☐ | ☐ |  |
| 20 | Lucy Barber | National Historical Publications and Records Commission | employed-by | 1 | “NHPRC staff present: Kathleen Williams, Executive Director Lucy Barber” | ☐ | ☐ | ☐ |  |
| 21 | Keith Donohue | National Historical Publications and Records Commission | employed-by | 1 | “NHPRC staff present: Kathleen Williams, Executive Director Lucy Barber Keith Donohue” | ☐ | ☐ | ☐ |  |
| 22 | Alexander Lorch | National Historical Publications and Records Commission | employed-by | 1 | “NHPRC staff present: Kathleen Williams, Executive Director Lucy Barber Keith Donohue Alexander Lorch” | ☐ | ☐ | ☐ |  |
| 23 | Darrell Meadows | National Historical Publications and Records Commission | employed-by | 1 | “NHPRC staff present: Kathleen Williams, Executive Director Lucy Barber Keith Donohue Alexander Lorch Darrell Meadows” | ☐ | ☐ | ☐ |  |
| 24 | Nancy Melley | National Historical Publications and Records Commission | employed-by | 1 | “NHPRC staff present: Kathleen Williams, Executive Director Lucy Barber Keith Donohue Alexander Lorch Darrell Meadows Nancy Melley” | ☐ | ☐ | ☐ |  |
| 25 | Daniel A. Stokes | National Historical Publications and Records Commission | employed-by | 1 | “NHPRC staff present: Kathleen Williams, Executive Director Lucy Barber Keith Donohue Alexander Lorch Darrell Meadows Nancy Melley Daniel A. Stokes” | ☐ | ☐ | ☐ |  |

## Capitalized non-entities

These strings appear on pages 1–2 and should **not** be labeled as a person or organization. Tick Drop only if you think one of them *is* an entity and should be added above.

| # | String | Keep (not an entity) | Is an entity (add it) | Notes |
|---|---|:---:|:---:|---|
| 1 | November | ☐ | ☐ | |
| 2 | November 6, 2015 | ☐ | ☐ | |
| 3 | November 2015 | ☐ | ☐ | |
| 4 | Washington, DC | ☐ | ☐ | |
| 5 | Archivist’s Board Room | ☐ | ☐ | |
| 6 | Continuing Resolution | ☐ | ☐ | |
| 7 | FY 2016 | ☐ | ☐ | |
| 8 | December 11 | ☐ | ☐ | |
| 9 | Strategic Planning Framework | ☐ | ☐ | |
| 10 | Course of Action | ☐ | ☐ | |
| 11 | Open Government | ☐ | ☐ | |
| 12 | Federal Government | ☐ | ☐ | |
| 13 | May 2015 | ☐ | ☐ | |
| 14 | Executive Summary Minutes | ☐ | ☐ | |

## Review sign-off

- [ ] I have reviewed every entity, relation, and non-entity row.
- [ ] Fixes I marked are written in the Notes column (or in `gold.json` directly).
- [ ] I set `reviewedBy` and `reviewedAt` in `test/fixtures/eval/nhprc-2015-11/gold.json`.

Reviewer: ____________________  Date: ____________________
