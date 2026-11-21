import { describe, expect, it } from 'vitest';
import { decideRoute, type RouterConfig, type Task } from '../../../src/ai/router';
import type { DeviceAvailability, Sensitivity } from '../../../src/types';

const AVAIL: DeviceAvailability[] = ['available', 'downloadable', 'downloading', 'unavailable', 'api-missing'];
const BASE: RouterConfig = {
  routeLocalMaxChunkChars: 6000,
  routeLocalChunkBudget: 60,
  routeLongDocPages: 30,
  crossPageMode: 'cloud_first',
  cloudEnabled: true,
};

type TaskCase = 'extract-small' | 'extract-large' | 'cross-page' | 'adjudicate';

interface Case {
  sensitivity: Sensitivity;
  task: TaskCase;
  avail: DeviceAvailability;
  online: boolean;
  cloudEnabled: boolean;
  crossPageMode: RouterConfig['crossPageMode'];
  budgetLeft: boolean;
  longDoc: boolean;
}

/** Written from requirements R4.2-R4.7 (with the design 5.2 reading of R4.3/R4.4 and "best effort" fallbacks). */
function expected(c: Case): 'local' | 'cloud' | 'blocked' {
  const device = c.avail === 'available';
  const cloud = c.cloudEnabled && c.online;
  if (c.sensitivity === 'sensitive') return device ? 'local' : 'blocked';
  const fallback = cloud ? 'cloud' : device ? 'local' : 'blocked';
  if (c.task === 'adjudicate') return device ? 'local' : cloud ? 'cloud' : 'blocked';
  if (c.task === 'cross-page') {
    if (c.crossPageMode === 'local_only') return device ? 'local' : 'blocked';
    return fallback;
  }
  const small = c.task === 'extract-small';
  const budgetApplies = c.longDoc && !c.budgetLeft;
  if (device && small && !budgetApplies) return 'local';
  return fallback;
}

function cases(): Case[] {
  const out: Case[] = [];
  for (const sensitivity of ['sensitive', 'public'] as const)
    for (const task of ['extract-small', 'extract-large', 'cross-page', 'adjudicate'] as const)
      for (const avail of AVAIL)
        for (const online of [true, false])
          for (const cloudEnabled of [true, false])
            for (const crossPageMode of task === 'cross-page' ? (['cloud_first', 'local_only'] as const) : (['cloud_first'] as const))
              for (const budgetLeft of task.startsWith('extract') ? [true, false] : [true])
                for (const longDoc of task.startsWith('extract') ? [true, false] : [false])
                  out.push({ sensitivity, task, avail, online, cloudEnabled, crossPageMode, budgetLeft, longDoc });
  return out;
}

function run(c: Case) {
  const task: Task =
    c.task === 'extract-small' ? { kind: 'extract', chunkChars: 6000 }
      : c.task === 'extract-large' ? { kind: 'extract', chunkChars: 6001 }
        : { kind: c.task };
  return decideRoute(
    task,
    { sensitivity: c.sensitivity, pages: c.longDoc ? 31 : 30 },
    { localAvailability: c.avail, online: c.online, localChunksUsed: c.budgetLeft ? 59 : 60 },
    { ...BASE, cloudEnabled: c.cloudEnabled, crossPageMode: c.crossPageMode },
  );
}

describe('decideRoute exhaustive table', () => {
  const all = cases();
  it('covers the full cross product', () => {
    // 2 sens x (2 extract x 5 x 2 x 2 x 2 x 2 + cross 5x2x2x2 + adj 5x2x2)
    expect(all.length).toBe(2 * (2 * 80 + 40 + 20));
  });
  it.each(all.map((c) => [JSON.stringify(c), c] as const))('%s', (_name, c) => {
    const d = run(c);
    expect(d.route).toBe(expected(c));
    expect(d.reason.length).toBeGreaterThan(0);
  });
});

describe('decideRoute named cases', () => {
  const pub = { sensitivity: 'public' as const, pages: 10 };
  const env = { localAvailability: 'available' as const, online: true, localChunksUsed: 0 };

  it('R4.2 sensitive never goes to cloud even if device missing', () => {
    expect(decideRoute({ kind: 'cross-page' }, { sensitivity: 'sensitive', pages: 100 }, { ...env, localAvailability: 'api-missing' }, BASE).route).toBe('blocked');
    expect(decideRoute({ kind: 'extract', chunkChars: 99999 }, { sensitivity: 'sensitive', pages: 100 }, env, BASE).route).toBe('local');
  });
  it('R4.3 small public chunk goes local, oversized chunk goes cloud', () => {
    expect(decideRoute({ kind: 'extract', chunkChars: 100 }, pub, env, BASE).route).toBe('local');
    const d = decideRoute({ kind: 'extract', chunkChars: 7000 }, pub, env, BASE);
    expect(d).toEqual({ route: 'cloud', reason: 'chunk too large for device' });
  });
  it('R4.4 budget only applies to long documents', () => {
    const spent = { ...env, localChunksUsed: 60 };
    expect(decideRoute({ kind: 'extract', chunkChars: 100 }, pub, spent, BASE).route).toBe('local');
    expect(decideRoute({ kind: 'extract', chunkChars: 100 }, { ...pub, pages: 31 }, spent, BASE).route).toBe('cloud');
  });
  it('R4.5 cross-page prefers cloud, falls back to local offline; local_only never falls through to cloud', () => {
    expect(decideRoute({ kind: 'cross-page' }, pub, env, BASE).route).toBe('cloud');
    expect(decideRoute({ kind: 'cross-page' }, pub, { ...env, online: false }, BASE).route).toBe('local');
    const only = { ...BASE, crossPageMode: 'local_only' as const };
    expect(decideRoute({ kind: 'cross-page' }, pub, env, only).route).toBe('local');
    expect(decideRoute({ kind: 'cross-page' }, pub, { ...env, localAvailability: 'unavailable' }, only).route).toBe('blocked');
  });
  it('R4.6 adjudication is local when available, else cloud', () => {
    expect(decideRoute({ kind: 'adjudicate' }, pub, env, BASE).route).toBe('local');
    expect(decideRoute({ kind: 'adjudicate' }, pub, { ...env, localAvailability: 'downloading' }, BASE).route).toBe('cloud');
  });
  it('R4.7 kill switch never yields cloud', () => {
    const off = { ...BASE, cloudEnabled: false };
    expect(decideRoute({ kind: 'extract', chunkChars: 7000 }, pub, env, off).route).toBe('local');
    expect(decideRoute({ kind: 'adjudicate' }, pub, { ...env, localAvailability: 'unavailable' }, off).route).toBe('blocked');
  });
});
