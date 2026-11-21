/** Fields the measured NHPRC fixture uses to record author review (R17.1, R17.1a). */
export interface ReviewFields {
  reviewedBy?: string | null;
  reviewedAt?: string | null;
}

/** True only when both reviewer and review date are non-empty strings. */
export function isGoldReviewed(gold: ReviewFields): boolean {
  return typeof gold.reviewedBy === 'string' && gold.reviewedBy.trim() !== '' &&
    typeof gold.reviewedAt === 'string' && gold.reviewedAt.trim() !== '';
}

export const UNREVIEWED_REFUSAL =
  'Gold labels have not been reviewed (reviewedBy and reviewedAt are empty). ' +
  'npm run eval will not write accuracy numbers to docs/EVAL.md until the author reviews the fixture (R17.1a). ' +
  'See docs/eval/NHPRC_GOLD_REVIEW.md.';
