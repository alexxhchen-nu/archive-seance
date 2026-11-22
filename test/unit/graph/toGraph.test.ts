import { describe, expect, it } from 'vitest';
import { toGraph, graphLinkId, graphNodeId } from '../../../src/graph/toGraph';
import { candidateKey } from '../../../src/graph/merge';
import type { RelationCandidate } from '../../../src/pipeline/runExtraction';
import type { Anchor, Entity, EntityType, InferenceSourceTag, Mention } from '../../../src/types';

const anchor = (page: number, start: number, quote = 'q'.repeat(5)): Anchor => ({ docId: 'd', page, start, end: start + quote.length, quote });
const mention = (id: string, surface: string, type: EntityType = 'person', a: Anchor = anchor(1, 0), src: InferenceSourceTag = 'on_device'): Mention => ({
  id, surface, type, anchor: a, sentenceId: `d:${a.page}:0`, source: { route: 'local', inferenceSource: src, ocr: false },
});
const entity = (id: string, mentionIds: string[], over: Partial<Entity> = {}): Entity => ({
  id, type: 'person', label: id, mentionIds, status: 'solid', confidence: 1, ...over,
});
const rel = (subject: string, object: string, label: RelationCandidate['label'], a: Anchor = anchor(1, 10), src: InferenceSourceTag = 'on_device'): RelationCandidate => ({
  subject, object, label, anchor: a, sentenceId: 'd:1:0', inferenceSource: src,
});

const mentions = [
  mention('m1', 'Edith Marlow', 'person', anchor(1, 0)),
  mention('m2', 'E. Marlow', 'person', anchor(2, 5), 'in_cloud'),
  mention('m3', 'Oswin Hale', 'person', anchor(1, 20)),
  mention('m4', 'Acme', 'org', anchor(3, 0)),
];
const entities = [
  entity('person:edith marlow', ['m1', 'm2'], { status: 'ghost', confidence: 0.77 }),
  entity('person:oswin hale', ['m3']),
  entity('org:acme', ['m4'], { type: 'org' }),
];

describe('toGraph', () => {
  it('builds nodes with mention counts, status, confidence, evidence and routes', () => {
    const g = toGraph(entities, mentions, []);
    const marlow = g.nodes.find((n) => n.entityId === 'person:edith marlow');
    expect(marlow?.id).toBe(graphNodeId([candidateKey(mentions[0] as Mention), candidateKey(mentions[1] as Mention)]));
    expect(marlow).toMatchObject({ mentions: 2, status: 'ghost', confidence: 0.77, evidenceCount: 2, route: 'mixed' });
    expect(marlow?.evidence[0]).toEqual({ docId: 'd', page: 1, start: 0, end: 5, quote: 'qqqqq' });
    expect(g.nodes.find((n) => n.entityId === 'org:acme')).toMatchObject({ type: 'org', route: 'on_device' });
  });

  it('drops entities without evidence (R8.4)', () => {
    const g = toGraph([...entities, entity('person:ghost', ['missing']), entity('person:empty', ['m5'])], [...mentions, mention('m5', 'X Y', 'person', { ...anchor(1, 0), quote: '' })], []);
    expect(g.nodes).toHaveLength(3);
    expect(g.dropped.nodesNoEvidence).toBe(2);
  });

  it('remaps merged surfaces to the canonical node', () => {
    const g = toGraph(entities, mentions, [rel('E. Marlow', 'Acme', 'employed-by')]);
    expect(g.links).toHaveLength(1);
    expect(g.links[0]).toMatchObject({ source: 'n:person:e marlow', target: 'n:org:acme', directed: true, evidenceCount: 1 });
  });

  it('drops dangling and no-evidence relations', () => {
    const g = toGraph(entities, mentions, [rel('Nobody', 'Acme', 'member-of'), rel('Oswin Hale', 'Acme', 'member-of', { ...anchor(1, 0), quote: '' })]);
    expect(g.links).toHaveLength(0);
    expect(g.dropped).toMatchObject({ linksDangling: 1, linksNoEvidence: 1 });
  });

  it('dedupes symmetric labels and merges evidence; keeps directed labels directed', () => {
    const g = toGraph(entities, mentions, [
      rel('Oswin Hale', 'Edith Marlow', 'met-with', anchor(1, 30)),
      rel('E. Marlow', 'Oswin Hale', 'met-with', anchor(2, 40), 'in_cloud'),
      rel('Oswin Hale', 'Edith Marlow', 'met-with', anchor(1, 30)),
      rel('Oswin Hale', 'Acme', 'employed-by'),
      rel('Acme', 'Oswin Hale', 'employed-by', anchor(3, 9)),
    ]);
    const met = g.links.filter((l) => l.label === 'met-with');
    expect(met).toHaveLength(1);
    expect(met[0]).toMatchObject({ directed: false, evidenceCount: 2, route: 'mixed' });
    expect(g.links.filter((l) => l.label === 'employed-by')).toHaveLength(2);
    expect(graphLinkId('met-with', 'b', 'a')).toBe(graphLinkId('met-with', 'a', 'b'));
    expect(graphLinkId('employed-by', 'b', 'a')).not.toBe(graphLinkId('employed-by', 'a', 'b'));
  });

  it('is order independent and keeps node id when a cluster absorbs a larger-key member', () => {
    const rs = [rel('Oswin Hale', 'Edith Marlow', 'met-with'), rel('Oswin Hale', 'Acme', 'employed-by')];
    const a = toGraph(entities, mentions, rs);
    const b = toGraph([...entities].reverse(), [...mentions].reverse(), [...rs].reverse());
    expect(b).toEqual(a);
    const before = toGraph([entity('x', ['m3'])], mentions, []);
    const after = toGraph([entity('y', ['m3', 'm1'])], mentions, []);
    expect(after.nodes[0]?.id).not.toBe(before.nodes[0]?.id); // 'person:edith marlow' < 'person:oswin hale': documented limitation
    const grown = toGraph([entity('y', ['m1', 'm3'])], mentions, []);
    expect(grown.nodes[0]?.id).toBe(toGraph([entity('z', ['m1'])], mentions, []).nodes[0]?.id);
  });
});
