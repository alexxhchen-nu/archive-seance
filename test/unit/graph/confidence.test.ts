import { describe, expect, it } from 'vitest';
import { combineScore, ghostOpacity, pairScore, type Candidate, type Verdict } from '../../../src/graph/confidence';
import { nameScore, normalizeName } from '../../../src/graph/similarity';
import { DEFAULTS } from '../../../src/config/defaults';
import type { EntityType } from '../../../src/types';

const cand = (s: string, neighbours: string[] = [], type: EntityType = 'person'): Candidate =>
  ({ key: `${type}:${s}`, type, name: normalizeName(s, type), neighbours: new Set(neighbours) });

describe('worked examples (design 7.5)', () => {
  const rows: Array<[string, string, number, number, Verdict | undefined, number, 'solid' | 'ghost' | 'separate']> = [
    ['john smith', 'john smith', 1.0, 0.5, undefined, 0.95, 'solid'],
    ['j smith', 'john smith', 0.88, 0.4, undefined, 0.739, 'ghost'],
    ['jon smith', 'john smith', 0.97, 0.6, undefined, 0.864, 'ghost'],
    ['john smith', 'james smith', 0.35, 0.3, undefined, 0.335, 'separate'],
    ['smith', 'john smith', 0.62, 0.5, undefined, 0.585, 'separate'],
    ['j smith', 'john smith', 0.88, 0.4, 'same', 0.778, 'ghost'],
    ['j smith', 'john smith', 0.88, 0.4, 'different', 0.55, 'separate'],
  ];
  it.each(rows)('%s / %s (%s, %s, %s) -> %s', (a, b, name, ctx, verdict, total, result) => {
    const v = verdict === undefined ? null : { same: 1, unsure: 0.5, different: 0 }[verdict];
    expect(nameScore(normalizeName(a), normalizeName(b), 'person')).toBeCloseTo(name, 2);
    const actualName = nameScore(normalizeName(a), normalizeName(b), 'person');
    let t = combineScore(actualName, ctx, v);
    if (a === b) t = Math.max(t, 0.95);
    if (verdict === 'different') t = Math.min(t, 0.55);
    expect(Math.abs(t - total)).toBeLessThan(0.005);
    const got = t >= DEFAULTS.mergeAutoThreshold ? 'solid' : t >= DEFAULTS.mergeGhostThreshold ? 'ghost' : 'separate';
    expect(got).toBe(result);
  });
  it('pairScore reproduces a row with real neighbour sets (ctx 0.4 = 2/5)', () => {
    const s = pairScore(cand('J. Smith', ['a', 'b', 'c']), cand('John Smith', ['a', 'b', 'd', 'e']), DEFAULTS, 'different');
    expect(s.context).toBeCloseTo(0.4);
    expect(s).toMatchObject({ name: 0.88, verdict: 0, capped: 'verdict-different', total: 0.55 });
  });
});

describe('pairScore hard rules', () => {
  it('equal names score at least 0.95', () => {
    expect(pairScore(cand('Mr. John Smith'), cand('john smith'), DEFAULTS).total).toBeGreaterThanOrEqual(0.95);
  });
  it('caps suffix conflicts', () => {
    expect(pairScore(cand('John Smith Jr.'), cand('John Smith Sr.'), DEFAULTS)).toMatchObject({ total: 0.5, capped: 'suffix-conflict' });
  });
  it('caps conflicting middle initials', () => {
    expect(pairScore(cand('John A. Smith'), cand('John B. Smith'), DEFAULTS)).toMatchObject({ total: 0.5, capped: 'initial-conflict' });
  });
  it('needs name >= 0.90 for auto', () => {
    const s = pairScore(cand('J. Smith', ['x']), cand('John Smith', ['x']), DEFAULTS, 'same');
    expect(s).toMatchObject({ total: DEFAULTS.mergeAutoThreshold - 0.01, capped: 'auto-needs-name>=0.90' });
  });
  it('never merges different types', () => {
    expect(pairScore(cand('Acme'), cand('Acme', [], 'org'), DEFAULTS)).toMatchObject({ total: 0, capped: 'type-mismatch' });
  });
});

describe('ghostOpacity (design 7.4)', () => {
  it('maps thresholds to 0.25..0.75', () => {
    expect(ghostOpacity(0.6, DEFAULTS)).toBeCloseTo(0.25);
    expect(ghostOpacity(0.75, DEFAULTS)).toBeCloseTo(0.484, 2);
    expect(ghostOpacity(0.92, DEFAULTS)).toBeCloseTo(0.75);
    expect(ghostOpacity(0.1, DEFAULTS)).toBe(0.25);
    expect(ghostOpacity(1, DEFAULTS)).toBe(0.75);
  });
});
