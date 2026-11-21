import type { EntityType, MergeDecision, ScoreBreakdown } from '../types';
import type { MergeThresholds } from './confidence';

export interface ClusterItem {
  key: string;
  type: EntityType;
}

export interface ScoredPair {
  a: string;
  b: string;
  score: ScoreBreakdown;
}

export type Decision = MergeDecision['decision'];

export interface Cluster {
  keys: string[];
  type: EntityType;
  status: 'solid' | 'ghost';
  confidence: number;
  weakestLink?: ScoredPair;
}

export const pairKey = (a: string, b: string): string => (a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`);

const ZERO: ScoreBreakdown = { name: 0, context: 0, verdict: null, total: 0 };

/** Complete-linkage agglomeration (design 7.3, R7.5). Result is independent of input order. */
export function cluster(
  items: readonly ClusterItem[],
  pairs: readonly ScoredPair[],
  cfg: MergeThresholds,
  decisions: ReadonlyMap<string, Decision> = new Map(),
): Cluster[] {
  const typeOf = new Map(items.map((i) => [i.key, i.type]));
  const scores = new Map<string, ScoredPair>();
  for (const p of pairs) {
    if (p.a === p.b || typeOf.get(p.a) === undefined || typeOf.get(p.a) !== typeOf.get(p.b)) continue;
    scores.set(pairKey(p.a, p.b), p);
  }
  const effective = (a: string, b: string): number => {
    const k = pairKey(a, b);
    const d = decisions.get(k);
    if (d === 'split') return -1;
    if (d === 'confirmed') return 1;
    return scores.get(k)?.score.total ?? 0;
  };

  const keys = [...typeOf.keys()].sort();
  const groups: string[][] = keys.map((k) => [k]);
  const n = keys.length;
  const NEVER = -2;
  // link[i][j]: complete linkage (minimum cross pair) between groups i and j, NEVER across types.
  const link: number[][] = keys.map((a) => keys.map((b) => (a === b ? NEVER : typeOf.get(a) === typeOf.get(b) ? effective(a, b) : NEVER)));
  const alive = new Array<boolean>(n).fill(true);

  // The merge sequence does not depend on the thresholds; they only decide where it stops.
  // That makes the result monotone in mergeGhostThreshold (a greedy "pairs sorted by score,
  // join if every cross pair passes" variant is not, see docs/PBT_FINDINGS.md).
  for (;;) {
    let bi = -1;
    let bj = -1;
    let best = -Infinity;
    for (let i = 0; i < n; i++) {
      if (!alive[i]) continue;
      for (let j = i + 1; j < n; j++) {
        if (!alive[j]) continue;
        const l = link[i]?.[j] ?? NEVER;
        if (l > best) { best = l; bi = i; bj = j; }
      }
    }
    if (bi < 0 || best < cfg.mergeGhostThreshold) break;
    const gi = groups[bi] ?? [];
    groups[bi] = [...gi, ...(groups[bj] ?? [])].sort();
    alive[bj] = false;
    for (let x = 0; x < n; x++) {
      if (x === bi || x === bj) continue;
      const m = Math.min(link[bi]?.[x] ?? NEVER, link[bj]?.[x] ?? NEVER);
      (link[bi] as number[])[x] = m;
      (link[x] as number[])[bi] = m;
    }
  }

  const owner = new Map<string, string[]>();
  groups.forEach((g, i) => { if (alive[i]) for (const k of g) owner.set(k, g); });

  const seen = new Set<string[]>();
  const out: Cluster[] = [];
  for (const k of keys) {
    const members = owner.get(k) ?? [k];
    if (seen.has(members)) continue;
    seen.add(members);
    out.push(summarize(members, typeOf.get(k) ?? 'person', effective, scores, cfg));
  }
  return out;
}

function summarize(
  keys: string[],
  type: EntityType,
  effective: (a: string, b: string) => number,
  scores: ReadonlyMap<string, ScoredPair>,
  cfg: MergeThresholds,
): Cluster {
  let confidence = 1;
  let weakestLink: ScoredPair | undefined;
  for (let i = 0; i < keys.length; i++)
    for (let j = i + 1; j < keys.length; j++) {
      const [a, b] = [keys[i] ?? '', keys[j] ?? ''];
      const t = effective(a, b);
      if (weakestLink === undefined || t < confidence) {
        confidence = Math.min(confidence, t);
        const s = scores.get(pairKey(a, b));
        weakestLink = { a, b, score: t === 1 && s === undefined ? { ...ZERO, total: 1 } : (s?.score ?? ZERO) };
      }
    }
  const status = confidence >= cfg.mergeAutoThreshold ? 'solid' : 'ghost';
  return weakestLink === undefined ? { keys, type, status, confidence } : { keys, type, status, confidence, weakestLink };
}
