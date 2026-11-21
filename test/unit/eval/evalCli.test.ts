import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { dateInChicago, EVAL_ROWS, rewriteEvalRows, rowValues } from '../../../src/eval/evalDoc';
import { PREDICTIONS_SCHEMA } from '../../../src/eval/predictions';
import type { Predictions } from '../../../src/eval/predictions';
import type { Score } from '../../../src/eval/score';

const EVAL_MD = 'docs/EVAL.md';
const GOLD = 'test/fixtures/eval/nhprc-2015-11/gold.json';
const goldFile = JSON.parse(readFileSync(GOLD, 'utf8')) as Record<string, unknown> & { entities: Array<{ name: string; type: 'person' | 'org' }> };

const META = { fixtureId: 'fx', date: '2026-11-21', machine: 'test-box', gitSha: 'abc' };
const sc = (tp: number, fp: number, fn: number): Score => ({ tp, fp, fn, precision: tp / (tp + fp), recall: tp / (tp + fn) });
const scores = { entities: { ...sc(1, 1, 3), mentions: { predicted: 2, matched: 1, unmatched: 1 } }, relations: sc(1, 0, 1) };

function tempCopy(): string {
  const dir = mkdtempSync(join(tmpdir(), 'seance-evalmd-'));
  const path = join(dir, 'EVAL.md');
  copyFileSync(EVAL_MD, path);
  return path;
}

const rowsOf = (md: string) => md.split('\n').filter((l) => l.startsWith('| ') && !l.startsWith('| Measurement'));

describe('dateInChicago', () => {
  it('uses America/Chicago, not the UTC calendar date', () => {
    expect(dateInChicago('2026-11-22T05:30:00.000Z')).toBe('2026-11-21');
    expect(dateInChicago('2026-11-21T12:00:00.000Z')).toBe('2026-11-21');
  });
});

describe('rewriteEvalRows', () => {

  const original = readFileSync(EVAL_MD, 'utf8');

  it('local-only writes the two local rows and the local timing row only', () => {
    const out = rewriteEvalRows(original, rowValues('local-only', scores, 900), META);
    const before = rowsOf(original);
    const after = rowsOf(out);
    expect(after).toHaveLength(before.length);
    const changed = after.filter((l, i) => l !== before[i]);
    expect(changed.map((l) => l.split('|')[1]?.trim())).toEqual([...EVAL_ROWS['local-only'].accuracy, EVAL_ROWS['local-only'].timing]);
    expect(changed[0]).toBe('| Entity precision / recall (local) | P 0.500 / R 0.250 (tp 1, fp 1, fn 3) | fx | 2026-11-21 | test-box | abc |');
    expect(changed[2]).toContain('| 900 ms |');
    // Lines outside the target rows are byte for byte the same.
    const strip = (md: string) => md.split('\n').filter((l) => !changed.some((c) => c.split('|')[1] === l.split('|')[1]));
    expect(strip(out)).toEqual(strip(original));
  });

  it('omits the timing row when wall-clock is absent', () => {
    const out = rewriteEvalRows(original, rowValues('cloud-enabled', scores, null), META);
    const changed = rowsOf(out).filter((l, i) => l !== rowsOf(original)[i]);
    expect(changed).toHaveLength(1);
    expect(changed[0]).toContain('cloud-enabled');
    expect(out).toContain('| Wall-clock, cloud-enabled run | not yet measured |');
  });

  it('is idempotent and replaces (does not duplicate) a mode rewritten twice', () => {
    const once = rewriteEvalRows(original, rowValues('local-only', scores, 900), META);
    expect(rewriteEvalRows(once, rowValues('local-only', scores, 900), META)).toBe(once);
    const again = rewriteEvalRows(once, rowValues('local-only', { ...scores, relations: sc(2, 0, 0) }, 800), { ...META, machine: 'other' });
    expect(rowsOf(again)).toHaveLength(rowsOf(original).length);
    expect(again).toContain('| 800 ms | fx | 2026-11-21 | other | abc |');
    expect(again).not.toContain('900 ms');
  });

  it('leaves the other mode alone', () => {
    const local = rewriteEvalRows(original, rowValues('local-only', scores, 900), META);
    const both = rewriteEvalRows(local, rowValues('cloud-enabled', scores, 1500), META);
    for (const r of [...EVAL_ROWS['local-only'].accuracy, EVAL_ROWS['local-only'].timing]) {
      const pick = (md: string) => md.split('\n').find((l) => l.startsWith(`| ${r} |`));
      expect(pick(both)).toBe(pick(local));
    }
  });

  it('throws instead of appending when a target row is missing', () => {
    expect(() => rewriteEvalRows('# empty\n', rowValues('local-only', scores, null), META)).toThrow(/missing table row/);
  });
});

function runEval(args: string[], env: Record<string, string>): { status: number; stdout: string; stderr: string } {
  try {
    const stdout = execFileSync('node', ['scripts/eval.mjs', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, ...env } });
    return { status: 0, stdout, stderr: '' };
  } catch (e) {
    const err = e as { status?: number | null; stdout?: string; stderr?: string };
    return { status: err.status ?? 1, stdout: err.stdout ?? '', stderr: err.stderr ?? '' };
  }
}

/** Synthetic predictions: two real gold names plus one invented name; no relations. */
function preds(over: Partial<Predictions> = {}): Predictions {
  const person = goldFile.entities.find((e) => e.type === 'person') as { name: string };
  const org = goldFile.entities.find((e) => e.type === 'org') as { name: string };
  return {
    schema: PREDICTIONS_SCHEMA, fixtureId: goldFile.fixtureId as string, mode: 'local-only',
    build: { flavor: 'real', gitSha: 'feedface' }, timestamp: '2026-11-21T12:00:00.000Z', wallClockMs: 4321,
    inferenceSource: { on_device: 1, in_cloud: 0, failed: 0 },
    entities: [
      { label: person.name, type: 'person', mentions: [{ page: 1, quote: person.name, surface: person.name }] },
      { label: org.name, type: 'org', mentions: [{ page: 1, quote: org.name, surface: org.name }] },
      { label: 'Zed Nobody', type: 'person', mentions: [{ page: 1, quote: 'Zed Nobody', surface: 'Zed Nobody' }] }
    ],
    relations: [],
    ...over
  };
}

function writeTemp(name: string, data: unknown): string {
  const path = join(mkdtempSync(join(tmpdir(), 'seance-pred-')), name);
  writeFileSync(path, typeof data === 'string' ? data : JSON.stringify(data));
  return path;
}

describe('npm run eval --predictions (R17.2 / R17.3), always on a temp EVAL.md', () => {
  const committed = readFileSync(EVAL_MD, 'utf8');

  it('scores a valid synthetic file and rewrites only the local-only rows', () => {
    const md = tempCopy();
    const r = runEval(['--predictions', writeTemp('p.json', preds()), '--machine', 'ci box'], { EVAL_MD_PATH: md });
    expect(r.status, r.stderr).toBe(0);
    const n = (goldFile.entities as unknown[]).length;
    const out = readFileSync(md, 'utf8');
    expect(out).toContain(`| Entity precision / recall (local) | P ${(2 / 3).toFixed(3)} / R ${(2 / n).toFixed(3)} (tp 2, fp 1, fn ${n - 2}) | nhprc-2015-11-p1-p2 | 2026-11-21 | ci box | feedface |`);
    expect(out).toContain('| Relation precision / recall (local) | P n/a / R 0.000');
    expect(out).toContain('| Wall-clock, local-only run | 4321 ms |');
    expect(out).toContain('| Entity and relation precision / recall (cloud-enabled) | not yet measured |');
    expect(out).toContain('| Wall-clock, cloud-enabled run | not yet measured |');
    // Rerun is idempotent.
    expect(runEval(['--predictions', writeTemp('p.json', preds()), '--machine', 'ci box'], { EVAL_MD_PATH: md }).status).toBe(0);
    expect(readFileSync(md, 'utf8')).toBe(out);
    expect(readFileSync(EVAL_MD, 'utf8')).toBe(committed);
  });

  const refusals: Array<[string, () => { args: string[]; env: Record<string, string> }, number, string]> = [
    ['unreviewed gold (R17.1a first, even with predictions)', () => {
      const gold = writeTemp('gold.json', { ...goldFile, reviewedBy: null, reviewedAt: null });
      return { args: ['--predictions', writeTemp('p.json', preds())], env: { EVAL_GOLD_PATH: gold } };
    }, 1, 'R17.1a'],
    ['missing --predictions', () => ({ args: [], env: {} }), 2, 'No predictions file given'],
    ['mock-build predictions', () => ({ args: ['--predictions', writeTemp('p.json', preds({ build: { flavor: 'mock', gitSha: null } }))], env: {} }), 4, 'MOCK build'],
    ['fixtureId mismatch', () => ({ args: ['--predictions', writeTemp('p.json', preds({ fixtureId: 'harbor' }))], env: {} }), 3, 'does not match gold'],
    ['schema error', () => ({ args: ['--predictions', writeTemp('p.json', { ...preds(), mode: 'hybrid' })], env: {} }), 3, 'mode must be'],
    ['unparseable file', () => ({ args: ['--predictions', writeTemp('p.json', '{nope')], env: {} }), 3, 'Could not read predictions file']
  ];

  for (const [name, setup, code, text] of refusals) {
    it(`refuses: ${name} (exit ${code}, EVAL.md untouched)`, () => {
      const md = tempCopy();
      const before = readFileSync(md, 'utf8');
      const mtime = statSync(md).mtimeMs;
      const { args, env } = setup();
      const r = runEval(args, { ...env, EVAL_MD_PATH: md });
      expect(r.status).toBe(code);
      expect(r.stderr).toContain(text);
      expect(readFileSync(md, 'utf8')).toBe(before);
      expect(statSync(md).mtimeMs).toBe(mtime);
      expect(readFileSync(EVAL_MD, 'utf8')).toBe(committed);
    });
  }
});
