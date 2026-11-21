import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEFAULTS } from '../../../src/config/defaults';
import { buildPredictions, PREDICTIONS_SCHEMA, scorePredictions, validatePredictions } from '../../../src/eval/predictions';
import type { Predictions } from '../../../src/eval/predictions';
import type { GoldSet } from '../../../src/eval/score';
import type { ExtractionResult } from '../../../src/pipeline/runExtraction';
import type { Mention } from '../../../src/types';

const GOLD = JSON.parse(readFileSync('test/fixtures/eval/nhprc-2015-11/gold.json', 'utf8')) as GoldSet & { fixtureId: string };
const FIXTURE = GOLD.fixtureId;

/** Synthetic gold: 2 people, 1 org, 2 relations. Not the NHPRC set. */
const TINY: GoldSet = {
  entities: [
    { id: 'a', name: 'Ada Vole', type: 'person', aliases: ['Ms. Vole'], mentions: [{ page: 1, quote: 'Ada Vole spoke' }] },
    { id: 'b', name: 'Bram Teel', type: 'person', aliases: [], mentions: [{ page: 1, quote: 'Bram Teel spoke' }] },
    { id: 'c', name: 'Kestrel Board', type: 'org', aliases: [], mentions: [{ page: 2, quote: 'the Kestrel Board' }] }
  ],
  relations: [
    { subject: 'a', object: 'c', label: 'member-of', page: 2, quote: 'Ada Vole of the Kestrel Board' },
    { subject: 'a', object: 'b', label: 'met-with', page: 1, quote: 'Ada Vole met Bram Teel' }
  ]
};

function synthetic(over: Partial<Predictions> = {}): Predictions {
  return {
    schema: PREDICTIONS_SCHEMA, fixtureId: FIXTURE, mode: 'local-only',
    build: { flavor: 'real', gitSha: 'abc123' }, timestamp: '2026-11-21T18:00:00.000Z', wallClockMs: 1234,
    inferenceSource: { on_device: 2, in_cloud: 0, failed: 0 },
    entities: [
      { label: 'Ada Vole', type: 'person', mentions: [{ page: 1, quote: 'Ada Vole spoke', surface: 'Ada Vole' }, { page: 2, quote: 'Ms. Vole of', surface: 'Ms. Vole' }] },
      { label: 'Zed Nobody', type: 'person', mentions: [{ page: 1, quote: 'Zed Nobody', surface: 'Zed Nobody' }] },
      { label: 'Kestrel Board', type: 'org', mentions: [{ page: 2, quote: 'the Kestrel Board', surface: 'Kestrel Board' }] }
    ],
    relations: [
      { subject: 'Bram Teel', object: 'Ada Vole', label: 'met-with', page: 1, quote: 'Ada Vole met Bram Teel' },
      { subject: 'Ada Vole', object: 'Zed Nobody', label: 'member-of', page: 1, quote: 'x' }
    ],
    ...over
  };
}

function mention(id: string, surface: string, page: number, quote: string, type: Mention['type'] = 'person'): Mention {
  return {
    id, surface, type, sentenceId: `d:${page}:0`,
    anchor: { docId: 'd', page, start: 0, end: quote.length, quote },
    source: { route: 'local', inferenceSource: 'on_device', ocr: false }
  };
}

describe('buildPredictions (R17.2 export payload)', () => {
  const result: Pick<ExtractionResult, 'mentions' | 'relations' | 'log'> = {
    mentions: [mention('m1', 'Ada Vole', 1, 'Ada Vole spoke'), mention('m2', 'Ada Vole', 2, 'Ada Vole of the Kestrel Board'),
      mention('m3', 'Kestrel Board', 2, 'Ada Vole of the Kestrel Board', 'org')],
    relations: [{ subject: 'Ada Vole', object: 'Kestrel Board', label: 'member-of', sentenceId: 'd:2:0', inferenceSource: 'on_device',
      anchor: { docId: 'd', page: 2, start: 0, end: 29, quote: 'Ada Vole of the Kestrel Board' } }],
    log: [
      { id: '1', at: 'a', kind: 'extract', requestedRoute: 'local', inferenceSource: 'on_device', payloadChars: 1, payloadSha256: 'x', ms: 1 },
      { id: '2', at: 'a', kind: 'extract', requestedRoute: 'local', inferenceSource: 'failed', payloadChars: 1, payloadSha256: 'x', ms: 1 }
    ]
  };
  const p = buildPredictions(result, {
    fixtureId: FIXTURE, mode: 'cloud-enabled', flavor: 'real', gitSha: 'deadbeef',
    timestamp: '2026-11-21T00:00:00.000Z', wallClockMs: 42, mergeCfg: DEFAULTS
  });

  it('carries the required metadata and merged entities with page/quote mentions', () => {
    expect(p).toMatchObject({
      schema: PREDICTIONS_SCHEMA, fixtureId: FIXTURE, mode: 'cloud-enabled', build: { flavor: 'real', gitSha: 'deadbeef' },
      wallClockMs: 42, timestamp: '2026-11-21T00:00:00.000Z', inferenceSource: { on_device: 1, in_cloud: 0, failed: 1 }
    });
    expect(p.entities).toHaveLength(2);
    const ada = p.entities.find((e) => e.label === 'Ada Vole');
    expect(ada?.mentions.map((m) => m.page)).toEqual([1, 2]);
    expect(p.relations).toEqual([{ subject: 'Ada Vole', object: 'Kestrel Board', label: 'member-of', page: 2, quote: 'Ada Vole of the Kestrel Board' }]);
  });

  it('keeps no document text beyond anchored quotes (no offsets, doc ids or page text)', () => {
    const json = JSON.stringify(p);
    expect(json).not.toContain('"start"');
    expect(json).not.toContain('"docId"');
    expect(json).not.toContain('sentenceId');
  });

  it('round-trips through the validator and marks mock builds', () => {
    expect(validatePredictions(JSON.parse(JSON.stringify(p)), FIXTURE).ok).toBe(true);
    const mock = buildPredictions(result, { fixtureId: FIXTURE, mode: 'local-only', flavor: 'mock', timestamp: 't', mergeCfg: DEFAULTS });
    expect(mock.build).toEqual({ flavor: 'mock', gitSha: null });
    expect(mock.wallClockMs).toBeNull();
  });
});

describe('validatePredictions', () => {
  it('accepts a valid synthetic file', () => {
    expect(validatePredictions(synthetic(), FIXTURE)).toMatchObject({ ok: true });
  });
  it('rejects a fixtureId mismatch', () => {
    const v = validatePredictions(synthetic({ fixtureId: 'other' }), FIXTURE);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.error).toContain('does not match gold');
  });
  it('refuses mock-build runs, flagged as mock', () => {
    const v = validatePredictions(synthetic({ build: { flavor: 'mock', gitSha: null } }), FIXTURE);
    expect(v).toMatchObject({ ok: false, mock: true });
  });
  it('rejects schema errors', () => {
    const bad: unknown[] = [
      null, [], { ...synthetic(), schema: 'x' }, { ...synthetic(), build: undefined }, { ...synthetic(), mode: 'hybrid' },
      { ...synthetic(), timestamp: 'nope' }, { ...synthetic(), wallClockMs: -1 }, { ...synthetic(), inferenceSource: { on_device: 1 } },
      { ...synthetic(), entities: [{ label: 'A', type: 'place', mentions: [] }] },
      { ...synthetic(), entities: [{ label: 'A', type: 'person', mentions: [{ page: 0, quote: 'q', surface: 'A' }] }] },
      { ...synthetic(), relations: [{ subject: 'A', object: 'B', label: 'met-with', page: 1 }] },
      { ...synthetic(), relations: [{ subject: 'A', object: 'B', label: 'mentioned-together', page: 1, quote: 'q' }] }
    ];
    for (const b of bad) expect(validatePredictions(b, FIXTURE).ok, JSON.stringify(b)).toBe(false);
  });
});

describe('scorePredictions (wired to score.ts)', () => {
  it('produces the expected P/R on synthetic predictions vs a synthetic gold', () => {
    const s = scorePredictions(TINY, synthetic());
    // Surfaces: Ada Vole, Ms. Vole (both -> a), Zed Nobody (fp), Kestrel Board (c).
    expect(s.entities).toMatchObject({ tp: 2, fp: 1, fn: 1, precision: 3 / 4, recall: 2 / 3 });
    // met-with is symmetric -> hit; member-of with unknown object -> fp.
    expect(s.relations).toMatchObject({ tp: 1, fp: 1, fn: 1, precision: 1 / 2, recall: 1 / 2 });
  });
  it('null precision when nothing is predicted against the committed gold', () => {
    const s = scorePredictions(GOLD, synthetic({ entities: [], relations: [] }));
    expect(s.entities.precision).toBeNull();
    expect(s.entities.recall).toBe(0);
    expect(s.relations.precision).toBeNull();
  });
});
