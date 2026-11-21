import type { Entity, MergeDecision, Mention } from '../types';
import { cluster, pairKey, type Decision, type ScoredPair } from './cluster';
import { pairScore, type Candidate, type MergeThresholds, type Verdict } from './confidence';
import { normalizeName } from './similarity';

export interface BuildEntitiesOptions {
  cfg: MergeThresholds;
  /** Keyed by `pairKey(aKey, bKey)` of candidate keys. */
  verdicts?: ReadonlyMap<string, Verdict>;
  decisions?: readonly MergeDecision[];
}

export function candidateKey(m: Pick<Mention, 'surface' | 'type'>): string {
  const n = normalizeName(m.surface, m.type);
  return `${m.type}:${[...n.tokens, ...(n.suffix === undefined ? [] : [n.suffix])].join(' ')}`;
}

function chooseLabel(surfaces: string[]): string {
  const counts = new Map<string, number>();
  for (const s of surfaces) counts.set(s, (counts.get(s) ?? 0) + 1);
  return [...counts].sort((x, y) => y[1] - x[1] || y[0].length - x[0].length || (x[0] < y[0] ? -1 : 1))[0]?.[0] ?? '';
}

export function buildEntities(mentions: readonly Mention[], opts: BuildEntitiesOptions): Entity[] {
  const byKey = new Map<string, Mention[]>();
  for (const m of mentions) {
    const k = candidateKey(m);
    byKey.set(k, [...(byKey.get(k) ?? []), m]);
  }
  const bySentence = new Map<string, Set<string>>();
  for (const m of mentions) {
    const s = bySentence.get(m.sentenceId) ?? new Set<string>();
    s.add(candidateKey(m));
    bySentence.set(m.sentenceId, s);
  }
  const candidates: Candidate[] = [...byKey].map(([key, ms]) => {
    const neighbours = new Set<string>();
    for (const m of ms) for (const k of bySentence.get(m.sentenceId) ?? []) if (k !== key) neighbours.add(k);
    const first = ms[0] as Mention;
    return { key, type: first.type, name: normalizeName(first.surface, first.type), neighbours };
  });

  const pairs: ScoredPair[] = [];
  for (let i = 0; i < candidates.length; i++)
    for (let j = i + 1; j < candidates.length; j++) {
      const [a, b] = [candidates[i] as Candidate, candidates[j] as Candidate];
      if (a.type !== b.type) continue;
      pairs.push({ a: a.key, b: b.key, score: pairScore(a, b, opts.cfg, opts.verdicts?.get(pairKey(a.key, b.key))) });
    }
  const decisions = new Map<string, Decision>();
  for (const d of opts.decisions ?? []) decisions.set(pairKey(d.aMentionKey, d.bMentionKey), d.decision);

  return cluster(candidates, pairs, opts.cfg, decisions).map((c) => {
    const ms = c.keys.flatMap((k) => byKey.get(k) ?? []);
    const firstOf = (k: string) => byKey.get(k)?.[0]?.id ?? '';
    const entity: Entity = {
      id: c.keys[0] ?? '',
      type: c.type,
      label: chooseLabel(ms.map((m) => m.surface)),
      mentionIds: ms.map((m) => m.id),
      status: c.status,
      confidence: c.confidence,
    };
    if (c.weakestLink !== undefined) {
      entity.weakestLink = { aMentionId: firstOf(c.weakestLink.a), bMentionId: firstOf(c.weakestLink.b), score: c.weakestLink.score };
    }
    return entity;
  });
}
