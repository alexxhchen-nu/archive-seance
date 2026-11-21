import { describe, expect, it } from 'vitest';
import { buildEntities, candidateKey } from '../../../src/graph/merge';
import { pairKey } from '../../../src/graph/cluster';
import { DEFAULTS } from '../../../src/config/defaults';
import type { EntityType, Mention } from '../../../src/types';

let n = 0;
const mention = (surface: string, sentence: string, type: EntityType = 'person'): Mention => ({
  id: `m${n++}`,
  surface,
  type,
  anchor: { docId: 'd', page: 1, start: 0, end: surface.length, quote: surface },
  sentenceId: `d:1:${sentence}`,
  source: { route: 'local', inferenceSource: 'on_device', ocr: false },
});

describe('buildEntities', () => {
  it('merges identical names into one solid entity and picks the most frequent label', () => {
    const ms = [mention('John Smith', '0'), mention('Mr. John Smith', '10'), mention('John Smith', '20')];
    const es = buildEntities(ms, { cfg: DEFAULTS });
    expect(es).toHaveLength(1);
    expect(es[0]).toMatchObject({ label: 'John Smith', status: 'solid', mentionIds: ms.map((m) => m.id) });
  });
  it('makes a ghost for an initial variant and keeps different types apart', () => {
    const ms = [mention('J. Smith', '0'), mention('John Smith', '10'), mention('Smith', '20', 'org')];
    const es = buildEntities(ms, { cfg: DEFAULTS });
    expect(es).toHaveLength(2);
    const person = es.find((e) => e.type === 'person');
    expect(person).toMatchObject({ status: 'ghost', label: 'John Smith' });
    expect(person?.confidence).toBeCloseTo((0.6 * 0.88 + 0.25 * 0.5) / 0.85, 6);
    expect(person?.weakestLink?.score.name).toBe(0.88);
  });
  it('applies verdicts and split decisions', () => {
    const ms = [mention('J. Smith', '0'), mention('John Smith', '10')];
    const [a, b] = [candidateKey(ms[0] as Mention), candidateKey(ms[1] as Mention)];
    expect(buildEntities(ms, { cfg: DEFAULTS, verdicts: new Map([[pairKey(a, b), 'different']]) })).toHaveLength(2);
    const split = { docId: 'd', aMentionKey: a, bMentionKey: b, decision: 'split' as const, at: '2026-11-21T00:00:00Z' };
    expect(buildEntities(ms, { cfg: DEFAULTS, decisions: [split] })).toHaveLength(2);
  });
});
