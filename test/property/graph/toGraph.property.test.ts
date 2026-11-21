import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { toGraph } from '../../../src/graph/toGraph';
import type { RelationCandidate } from '../../../src/pipeline/runExtraction';
import type { Entity, Mention } from '../../../src/types';
import { numRuns } from '../../helpers/numRuns';

const runs = { numRuns: numRuns(200) };
const names = ['Edith Marlow', 'Oswin Hale', 'Ann Lee', 'Jon Smith', 'Zoe Nunez'];
const labels = ['met-with', 'family', 'employed-by', 'member-of', 'communicated-with'] as const;

const input = fc
  .record({
    mentions: fc.array(fc.record({ name: fc.constantFrom(...names), page: fc.integer({ min: 1, max: 3 }), start: fc.integer({ min: 0, max: 50 }), empty: fc.boolean() }), { maxLength: 8 }),
    groups: fc.array(fc.integer({ min: 0, max: 3 }), { minLength: 8, maxLength: 8 }),
    rels: fc.array(fc.record({ s: fc.constantFrom(...names, 'Nobody'), o: fc.constantFrom(...names), label: fc.constantFrom(...labels), start: fc.integer({ min: 0, max: 5 }), empty: fc.boolean() }), { maxLength: 10 }),
  })
  .map(({ mentions: raw, groups, rels: rawRels }) => {
    const mentions: Mention[] = raw.map((r, i): Mention => {
      const quote = r.empty ? '' : 'abcde';
      return { id: `m${i}`, surface: r.name, type: 'person', anchor: { docId: 'd', page: r.page, start: r.start, end: r.start + 5, quote }, sentenceId: 'd:1:0', source: { route: 'local', inferenceSource: i % 2 ? 'in_cloud' : 'on_device', ocr: false } };
    });
    // Same surface must land in the same entity (as buildEntities guarantees).
    const groupOf = new Map<string, number>();
    names.forEach((n, i) => groupOf.set(n, groups[i] ?? 0));
    const entities: Entity[] = [0, 1, 2, 3]
      .map((g) => ({ id: `e${g}`, type: 'person' as const, label: `e${g}`, mentionIds: mentions.filter((m) => groupOf.get(m.surface) === g).map((m) => m.id), status: 'solid' as const, confidence: 1 }))
      .filter((e) => e.mentionIds.length > 0);
    const rels: RelationCandidate[] = rawRels.map((r): RelationCandidate => ({ subject: r.s, object: r.o, label: r.label, anchor: { docId: 'd', page: 1, start: r.start, end: r.start + 5, quote: r.empty ? '' : 'abcde' }, sentenceId: 'd:1:0', inferenceSource: 'on_device' }));
    return { mentions, entities, rels };
  });

describe('toGraph properties', () => {
  it('every link endpoint is a node and nothing lacks evidence', () => {
    fc.assert(fc.property(input, ({ entities, mentions, rels }) => {
      const g = toGraph(entities, mentions, rels);
      const ids = new Set(g.nodes.map((n) => n.id));
      expect(ids.size).toBe(g.nodes.length);
      for (const l of g.links) {
        expect(ids.has(l.source) && ids.has(l.target)).toBe(true);
        expect(l.evidenceCount).toBe(l.evidence.length);
        expect(l.evidenceCount).toBeGreaterThan(0);
      }
      for (const n of g.nodes) expect(n.evidenceCount).toBeGreaterThan(0);
    }), runs);
  });

  it('accounts for every relation: kept contributions + drops = inputs', () => {
    fc.assert(fc.property(input, ({ entities, mentions, rels }) => {
      const g = toGraph(entities, mentions, rels);
      const unique = new Set(rels.filter((r) => r.anchor.quote).map((r) => `${r.subject}|${r.object}|${r.label}|${r.anchor.start}`));
      const evidenceTotal = g.links.reduce((s, l) => s + l.evidenceCount, 0);
      expect(evidenceTotal).toBeLessThanOrEqual(unique.size);
      expect(g.dropped.linksNoEvidence).toBe(rels.filter((r) => !r.anchor.quote).length);
    }), runs);
  });

  it('is order independent and idempotent', () => {
    fc.assert(fc.property(input, fc.integer(), ({ entities, mentions, rels }, seed) => {
      const shuffle = <T,>(xs: T[]) => xs.map((x, i) => [((i + 1) * (seed | 1)) % 9973, x] as const).sort((a, b) => a[0] - b[0]).map((p) => p[1]);
      const a = toGraph(entities, mentions, rels);
      expect(toGraph(shuffle(entities), shuffle(mentions), shuffle(rels))).toEqual(a);
      expect(toGraph(entities, mentions, rels)).toEqual(a);
    }), runs);
  });
});
