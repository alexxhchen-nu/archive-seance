import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { pairScore, type Candidate } from '../../../src/graph/confidence';
import { cluster, pairKey, type Decision, type ScoredPair } from '../../../src/graph/cluster';
import { DEFAULTS } from '../../../src/config/defaults';
import { numRuns } from '../../helpers/numRuns';
import { candidate, candidates, decision, verdict } from './arbitraries';

const runs = { numRuns: numRuns(200) };

function scoreAll(cs: Candidate[], cfg = DEFAULTS): ScoredPair[] {
  const out: ScoredPair[] = [];
  for (let i = 0; i < cs.length; i++)
    for (let j = i + 1; j < cs.length; j++) {
      const [a, b] = [cs[i] as Candidate, cs[j] as Candidate];
      out.push({ a: a.key, b: b.key, score: pairScore(a, b, cfg) });
    }
  return out;
}

const totalOf = (ps: ScoredPair[], a: string, b: string) =>
  ps.find((p) => pairKey(p.a, p.b) === pairKey(a, b))?.score.total ?? 0;

const allPairs = (keys: string[]) => keys.flatMap((a, i) => keys.slice(i + 1).map((b) => [a, b] as const));

const thresholds = fc.tuple(fc.double({ min: 0.3, max: 0.7, noNaN: true }), fc.double({ min: 0.75, max: 0.99, noNaN: true }));

describe('merge properties (design 7.6, R7.8)', () => {
  it('1. total is in [0,1] and symmetric', () => {
    fc.assert(fc.property(candidate, candidate, verdict, (a, b, v) => {
      const ab = pairScore({ ...a, key: 'a' }, { ...b, key: 'b' }, DEFAULTS, v);
      const ba = pairScore({ ...b, key: 'b' }, { ...a, key: 'a' }, DEFAULTS, v);
      expect(ab.total).toBeGreaterThanOrEqual(0);
      expect(ab.total).toBeLessThanOrEqual(1);
      expect(ba).toEqual(ab);
    }), runs);
  });

  it('2. idempotent: re-clustering the output changes nothing', () => {
    fc.assert(fc.property(candidates, (cs) => {
      const ps = scoreAll(cs);
      const once = cluster(cs, ps, DEFAULTS);
      expect(cluster(cs, ps, DEFAULTS)).toEqual(once);
      for (const c of once) {
        const members = cs.filter((x) => c.keys.includes(x.key));
        expect(cluster(members, ps, DEFAULTS)).toEqual([c]);
      }
    }), runs);
  });

  it('3. no chaining: every pair inside a cluster of size >= 3 is >= mergeGhostThreshold', () => {
    fc.assert(fc.property(candidates, (cs) => {
      const ps = scoreAll(cs);
      for (const c of cluster(cs, ps, DEFAULTS)) {
        if (c.keys.length < 3) continue;
        for (const [a, b] of allPairs(c.keys)) expect(totalOf(ps, a, b)).toBeGreaterThanOrEqual(DEFAULTS.mergeGhostThreshold);
      }
    }), runs);
  });

  it('3a. lowering mergeGhostThreshold never splits an existing cluster', () => {
    fc.assert(fc.property(candidates, thresholds, fc.double({ min: 0, max: 0.2, noNaN: true }), (cs, [ghost, auto], delta) => {
      const ps = scoreAll(cs);
      const high = cluster(cs, ps, { mergeGhostThreshold: ghost, mergeAutoThreshold: auto });
      const low = cluster(cs, ps, { mergeGhostThreshold: ghost - delta, mergeAutoThreshold: auto });
      for (const c of high) {
        const home = low.find((l) => l.keys.includes(c.keys[0] ?? ''));
        for (const k of c.keys) expect(home?.keys).toContain(k);
      }
    }), runs);
  });

  it('4. monotonic thresholds', () => {
    fc.assert(fc.property(candidates, thresholds, fc.double({ min: 0, max: 0.2, noNaN: true }), (cs, [ghost, auto], delta) => {
      const ps = scoreAll(cs);
      const base = cluster(cs, ps, { mergeGhostThreshold: ghost, mergeAutoThreshold: auto });
      const raised = cluster(cs, ps, { mergeGhostThreshold: ghost, mergeAutoThreshold: Math.min(1, auto + delta) });
      for (const c of raised) {
        const before = base.find((b) => b.keys.join() === c.keys.join());
        if (before?.status === 'ghost') expect(c.status).toBe('ghost');
      }
      const lowered = cluster(cs, ps, { mergeGhostThreshold: ghost - delta, mergeAutoThreshold: auto });
      for (const c of base) {
        const home = lowered.find((l) => l.keys.includes(c.keys[0] ?? ''));
        for (const k of c.keys) expect(home?.keys).toContain(k);
      }
    }), runs);
  });

  it('5. different types never share a cluster', () => {
    fc.assert(fc.property(candidates, (cs) => {
      const typeOf = new Map(cs.map((c) => [c.key, c.type]));
      for (const c of cluster(cs, scoreAll(cs), DEFAULTS)) {
        expect(new Set(c.keys.map((k) => typeOf.get(k))).size).toBe(1);
      }
    }), runs);
  });

  it('6. a split decision is honoured for every input order', () => {
    fc.assert(fc.property(
      candidates.chain((cs) => fc.tuple(
        fc.constant(cs),
        fc.array(fc.tuple(fc.nat(cs.length - 1), fc.nat(cs.length - 1), decision), { maxLength: 6 }),
        fc.shuffledSubarray(cs, { minLength: cs.length, maxLength: cs.length }),
      )),
      ([cs, raw, shuffled]) => {
        const ds = new Map<string, Decision>();
        for (const [i, j, d] of raw) if (i !== j) ds.set(pairKey(`k${i}`, `k${j}`), d);
        const ps = scoreAll(cs);
        const result = cluster(cs, ps, DEFAULTS, ds);
        expect(cluster(shuffled, [...ps].reverse(), DEFAULTS, ds)).toEqual(result);
        for (const [k, d] of ds) {
          if (d !== 'split') continue;
          const [a, b] = k.split('\u0000');
          expect(result.some((c) => c.keys.includes(a ?? '') && c.keys.includes(b ?? ''))).toBe(false);
        }
      },
    ), runs);
  });

  it('7. cluster confidence equals the minimum pair total', () => {
    fc.assert(fc.property(candidates, (cs) => {
      const ps = scoreAll(cs);
      for (const c of cluster(cs, ps, DEFAULTS)) {
        const totals = allPairs(c.keys).map(([a, b]) => totalOf(ps, a, b));
        expect(c.confidence).toBe(totals.length === 0 ? 1 : Math.min(...totals));
        expect(c.status).toBe(c.confidence >= DEFAULTS.mergeAutoThreshold ? 'solid' : 'ghost');
      }
    }), runs);
  });

  it('8. the model verdict alone never lifts a pair with name < 0.90 to auto (R7.8)', () => {
    fc.assert(fc.property(candidate, candidate, verdict, thresholds, (a, b, v, [ghost, auto]) => {
      const cfg = { mergeGhostThreshold: ghost, mergeAutoThreshold: auto };
      const s = pairScore({ ...a, key: 'a' }, { ...b, key: 'b' }, cfg, v);
      if (s.name < 0.9) expect(s.total).toBeLessThan(auto);
    }), runs);
  });
});
