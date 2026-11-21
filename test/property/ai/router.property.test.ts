import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { decideRoute, type DocInfo, type Env, type RouterConfig, type Task } from '../../../src/ai/router';
import { numRuns } from '../../helpers/numRuns';

const task: fc.Arbitrary<Task> = fc.oneof(
  fc.integer({ min: 0, max: 20000 }).map((chunkChars): Task => ({ kind: 'extract', chunkChars })),
  fc.constant<Task>({ kind: 'cross-page' }),
  fc.constant<Task>({ kind: 'adjudicate' }),
);
const doc: fc.Arbitrary<DocInfo> = fc.record({
  sensitivity: fc.constantFrom('sensitive', 'public'),
  pages: fc.integer({ min: 1, max: 1000 }),
});
const env: fc.Arbitrary<Env> = fc.record({
  localAvailability: fc.constantFrom('available', 'downloadable', 'downloading', 'unavailable', 'api-missing'),
  online: fc.boolean(),
  localChunksUsed: fc.integer({ min: 0, max: 200 }),
});
const cfg: fc.Arbitrary<RouterConfig> = fc.record({
  routeLocalMaxChunkChars: fc.integer({ min: 0, max: 20000 }),
  routeLocalChunkBudget: fc.integer({ min: 0, max: 200 }),
  routeLongDocPages: fc.integer({ min: 0, max: 1000 }),
  crossPageMode: fc.constantFrom('cloud_first', 'local_only'),
  cloudEnabled: fc.boolean(),
});

const runs = { numRuns: numRuns(200) };

describe('decideRoute properties', () => {
  it('sensitive never cloud (R4.2)', () => {
    fc.assert(fc.property(task, doc, env, cfg, (t, d, e, c) => {
      expect(decideRoute(t, { ...d, sensitivity: 'sensitive' }, e, c).route).not.toBe('cloud');
    }), runs);
  });
  it('cloudEnabled=false never cloud (R4.7)', () => {
    fc.assert(fc.property(task, doc, env, cfg, (t, d, e, c) => {
      expect(decideRoute(t, d, e, { ...c, cloudEnabled: false }).route).not.toBe('cloud');
    }), runs);
  });
  it('local only when the device model is available', () => {
    fc.assert(fc.property(task, doc, env, cfg, (t, d, e, c) => {
      if (e.localAvailability !== 'available') expect(decideRoute(t, d, e, c).route).not.toBe('local');
    }), runs);
  });
  it('is total and deterministic with a non-empty reason', () => {
    fc.assert(fc.property(task, doc, env, cfg, (t, d, e, c) => {
      const a = decideRoute(t, d, e, c);
      expect(decideRoute(t, d, e, c)).toEqual(a);
      expect(['local', 'cloud', 'blocked']).toContain(a.route);
      expect(a.reason.trim().length).toBeGreaterThan(0);
    }), runs);
  });
});
