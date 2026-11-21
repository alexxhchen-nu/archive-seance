#!/usr/bin/env node
// Measured eval entry (R17). While the NHPRC gold is unreviewed, this refuses
// to write accuracy numbers to docs/EVAL.md (R17.1a). The comparison pass
// itself is T37 and is not run here.
import { readFileSync } from 'node:fs';

const GOLD_PATH = 'test/fixtures/eval/nhprc-2015-11/gold.json';

function isGoldReviewed(gold) {
  return typeof gold.reviewedBy === 'string' && gold.reviewedBy.trim() !== '' &&
    typeof gold.reviewedAt === 'string' && gold.reviewedAt.trim() !== '';
}

const gold = JSON.parse(readFileSync(GOLD_PATH, 'utf8'));
if (!isGoldReviewed(gold)) {
  const msg = 'Gold labels have not been reviewed (reviewedBy and reviewedAt are empty). ' +
    'npm run eval will not write accuracy numbers to docs/EVAL.md until the author reviews the fixture (R17.1a). ' +
    'See docs/eval/NHPRC_GOLD_REVIEW.md.';
  console.error(msg);
  process.exit(1);
}

console.error('Gold is marked reviewed, but the measured comparison pass is not wired yet (T37). docs/EVAL.md was not changed and no accuracy numbers were written.');
process.exit(2);
