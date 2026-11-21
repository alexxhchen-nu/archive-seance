import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
  function runEval(env: Record<string, string> = {}): { status: number; stderr: string } {
    try {
      execFileSync('npm', ['run', 'eval'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, ...env } });
      return { status: 0, stderr: '' };
    } catch (e) {
      const err = e as { status?: number | null; stderr?: string };
      return { status: err.status ?? 1, stderr: err.stderr ?? '' };
    }
  }

  it('refuses to write accuracy numbers while the gold is unreviewed', () => {
    const gold = JSON.parse(readFileSync(GOLD, 'utf8')) as Record<string, unknown>;
    const unreviewed = { ...gold, reviewedBy: null, reviewedAt: null };
    expect(isGoldReviewed(unreviewed)).toBe(false);
    const dir = mkdtempSync(join(tmpdir(), 'seance-eval-'));
    const path = join(dir, 'gold.json');
    writeFileSync(path, JSON.stringify(unreviewed));

    const before = readFileSync(EVAL_MD, 'utf8');
    const mtime = statSync(EVAL_MD).mtimeMs;
    const { status, stderr } = runEval({ EVAL_GOLD_PATH: path });
    expect(status).toBe(1);
    expect(stderr).toContain('will not write accuracy numbers');
    expect(stderr).toContain('R17.1a');
    expect(stderr).toContain(UNREVIEWED_REFUSAL.slice(0, 40));
    expect(readFileSync(EVAL_MD, 'utf8')).toBe(before);
    expect(statSync(EVAL_MD).mtimeMs).toBe(mtime);
  });

  it('with the committed (reviewed) gold and no --predictions, exits 2 and writes no numbers', () => {
    const gold = JSON.parse(readFileSync(GOLD, 'utf8')) as Record<string, unknown>;
    expect(isGoldReviewed(gold)).toBe(true);
    const before = readFileSync(EVAL_MD, 'utf8');
    const mtime = statSync(EVAL_MD).mtimeMs;
    const { status, stderr } = runEval();
    expect(status).toBe(2);
    expect(stderr).toContain('No predictions file given');
    expect(stderr).toContain('Export eval run');
    expect(stderr).toContain('--predictions');
    expect(readFileSync(EVAL_MD, 'utf8')).toBe(before);
    expect(statSync(EVAL_MD).mtimeMs).toBe(mtime);
    expect(before).toMatch(/not yet measured/i);
    expect(before).not.toMatch(/\bprecision\b[^\n]*\b0\.\d+/i);
  });
});
