import { describe, expect, it } from 'vitest';
import { cluster, pairKey, type ClusterItem, type Decision, type ScoredPair } from '../../../src/graph/cluster';
import { DEFAULTS } from '../../../src/config/defaults';

const items = (...keys: string[]): ClusterItem[] => keys.map((key) => ({ key, type: key.startsWith('o') ? 'org' : 'person' }));
const pair = (a: string, b: string, total: number): ScoredPair => ({ a, b, score: { name: total, context: 0.5, verdict: null, total } });
const keys = (cs: ReturnType<typeof cluster>) => cs.map((c) => c.keys);

describe('cluster', () => {
  it('singletons are solid with confidence 1', () => {
    expect(cluster(items('a'), [], DEFAULTS)).toEqual([{ keys: ['a'], type: 'person', status: 'solid', confidence: 1 }]);
  });
  it('does not chain (complete linkage)', () => {
    const cs = cluster(items('a', 'b', 'c'), [pair('a', 'b', 0.9), pair('b', 'c', 0.8), pair('a', 'c', 0.3)], DEFAULTS);
    expect(keys(cs)).toEqual([['a', 'b'], ['c']]);
    expect(cs[0]).toMatchObject({ status: 'ghost', confidence: 0.9 });
  });
  it('solid iff all pairs >= auto; confidence is the weakest link', () => {
    const cs = cluster(items('a', 'b', 'c'), [pair('a', 'b', 0.99), pair('b', 'c', 0.95), pair('a', 'c', 0.93)], DEFAULTS);
    expect(cs).toHaveLength(1);
    expect(cs[0]).toMatchObject({ status: 'solid', confidence: 0.93, weakestLink: { a: 'a', b: 'c' } });
  });
  it('honours split and confirmed decisions', () => {
    const ps = [pair('a', 'b', 0.99), pair('a', 'c', 0.1)];
    const d = new Map<string, Decision>([[pairKey('a', 'b'), 'split'], [pairKey('a', 'c'), 'confirmed']]);
    const cs = cluster(items('a', 'b', 'c'), ps, DEFAULTS, d);
    expect(keys(cs)).toEqual([['a', 'c'], ['b']]);
    expect(cs[0]).toMatchObject({ status: 'solid', confidence: 1 });
  });
  it('unsure decisions have no effect', () => {
    const ps = [pair('a', 'b', 0.7)];
    expect(cluster(items('a', 'b'), ps, DEFAULTS, new Map([[pairKey('a', 'b'), 'unsure']]))).toEqual(cluster(items('a', 'b'), ps, DEFAULTS));
  });
  it('never mixes types', () => {
    expect(keys(cluster(items('a', 'o1'), [pair('a', 'o1', 1)], DEFAULTS))).toEqual([['a'], ['o1']]);
  });
  it('is independent of input order', () => {
    const ps = [pair('a', 'b', 0.8), pair('b', 'c', 0.8), pair('a', 'c', 0.5), pair('c', 'd', 0.8)];
    expect(cluster(items('d', 'c', 'b', 'a'), [...ps].reverse(), DEFAULTS)).toEqual(cluster(items('a', 'b', 'c', 'd'), ps, DEFAULTS));
  });

  it('lowering mergeGhostThreshold never splits a cluster (regression: shrunk counterexample, docs/PBT_FINDINGS.md)', () => {
    const ps = [
      pair('k0', 'k1', 0.95), pair('k0', 'k2', 0.14705882352941177), pair('k0', 'k3', 0.5287581699346405),
      pair('k1', 'k2', 0.14705882352941177), pair('k1', 'k3', 0.38169934640522873), pair('k2', 'k3', 0.5078431372549019)
    ];
    const auto = 0.75;
    const at = (ghost: number) => keys(cluster(items('k0', 'k1', 'k2', 'k3'), ps, { mergeGhostThreshold: ghost, mergeAutoThreshold: auto }));
    expect(at(0.3816993464052288)).toEqual([['k0', 'k1'], ['k2', 'k3']]);
    expect(at(0.3816993464052288 - 2.8e-17)).toEqual([['k0', 'k1'], ['k2', 'k3']]);
    expect(at(0.1)).toEqual([['k0', 'k1', 'k2', 'k3']]);
  });

  it('a split pair is cannot-link (linkage -Infinity) even with a high score', () => {
    const ps = [pair('a', 'b', 0.99), pair('a', 'c', 0.99), pair('b', 'c', 0.99)];
    const d = new Map<string, Decision>([[pairKey('a', 'b'), 'split']]);
    expect(keys(cluster(items('a', 'b', 'c'), ps, DEFAULTS, d))).toEqual([['a', 'c'], ['b']]);
  });
  it('equal linkage prefers the merge whose sorted member ids are smaller (design 7.3 tie-break)', () => {
    // a-b and a-c both 0.7; b-c is 0.4, so only one pair can merge at ghost 0.5.
    // [a,b] < [a,c], so the result must be {a,b} {c}, not {a,c} {b}.
    const ps = [pair('a', 'b', 0.7), pair('a', 'c', 0.7), pair('b', 'c', 0.4)];
    const cfg = { mergeGhostThreshold: 0.5, mergeAutoThreshold: 0.92 };
    expect(keys(cluster(items('c', 'b', 'a'), ps, cfg))).toEqual([['a', 'b'], ['c']]);
    expect(keys(cluster(items('a', 'b', 'c'), [...ps].reverse(), cfg))).toEqual([['a', 'b'], ['c']]);
  });
});