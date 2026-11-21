import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { isGoldReviewed, UNREVIEWED_REFUSAL } from '../../../src/eval/reviewGate';

const EVAL_MD = 'docs/EVAL.md';
const GOLD = 'test/fixtures/eval/nhprc-2015-11/gold.json';

describe('isGoldReviewed (R17.1 / R17.1a)', () => {
  it('rejects missing, null, or blank reviewer fields', () => {
    expect(isGoldReviewed({})).toBe(false);
    expect(isGoldReviewed({ reviewedBy: null, reviewedAt: null })).toBe(false);
    expect(isGoldReviewed({ reviewedBy: 'Alex Chen', reviewedAt: null })).toBe(false);
    expect(isGoldReviewed({ reviewedBy: null, reviewedAt: '2026-11-21' })).toBe(false);
    expect(isGoldReviewed({ reviewedBy: '  ', reviewedAt: '2026-11-21' })).toBe(false);
    expect(isGoldReviewed({ reviewedBy: 'Alex Chen', reviewedAt: '' })).toBe(false);
  });
  it('accepts non-empty reviewer and date strings', () => {
    expect(isGoldReviewed({ reviewedBy: 'Alex Chen', reviewedAt: '2026-11-21' })).toBe(true);
  });
});

describe('npm run eval (R17.1a)', () => {
  it('refuses to write accuracy numbers while the committed gold is unreviewed', () => {
    const gold = JSON.parse(readFileSync(GOLD, 'utf8')) as { reviewedBy: string | null; reviewedAt: string | null };
    expect(gold.reviewedBy).toBeNull();
    expect(gold.reviewedAt).toBeNull();
    expect(isGoldReviewed(gold)).toBe(false);

    const before = readFileSync(EVAL_MD, 'utf8');
    const mtime = statSync(EVAL_MD).mtimeMs;
    let status = 0;
    let stderr = '';
    try {
      execFileSync('npm', ['run', 'eval'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) {
      const err = e as { status?: number | null; stderr?: string };
      status = err.status ?? 1;
      stderr = err.stderr ?? '';
    }
    expect(status).toBe(1);
    expect(stderr).toContain('will not write accuracy numbers');
    expect(stderr).toContain('R17.1a');
    expect(stderr).toContain(UNREVIEWED_REFUSAL.slice(0, 40));
    expect(readFileSync(EVAL_MD, 'utf8')).toBe(before);
    expect(statSync(EVAL_MD).mtimeMs).toBe(mtime);
    expect(before).toMatch(/not yet measured/i);
    expect(before).not.toMatch(/\bprecision\b[^\n]*\b0\.\d+/i);
  });
});
