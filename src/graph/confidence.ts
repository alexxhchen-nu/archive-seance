import type { Config } from '../config/defaults';
import type { EntityType, ScoreBreakdown, VerdictOutput } from '../types';
import { contextScore, nameScore, type NormalizedName } from './similarity';

export type MergeThresholds = Pick<Config, 'mergeAutoThreshold' | 'mergeGhostThreshold'>;
export type Verdict = VerdictOutput['verdict'];

export interface Candidate {
  key: string;
  type: EntityType;
  name: NormalizedName;
  neighbours: ReadonlySet<string>;
}

const VERDICT_VALUE: Record<Verdict, number> = { same: 1, unsure: 0.5, different: 0 };

export function combineScore(name: number, context: number, verdict: number | null): number {
  return verdict === null ? (0.6 * name + 0.25 * context) / 0.85 : 0.6 * name + 0.25 * context + 0.15 * verdict;
}

function suffixConflict(a: Candidate, b: Candidate): boolean {
  return a.type === 'person' && a.name.suffix !== undefined && b.name.suffix !== undefined && a.name.suffix !== b.name.suffix;
}

function initialConflict(a: NormalizedName, b: NormalizedName): boolean {
  const [ta, tb] = [a.tokens, b.tokens];
  if (ta.length < 3 || tb.length < 3) return false;
  if (ta[ta.length - 1] !== tb[tb.length - 1]) return false;
  const ma = ta.slice(1, -1).map((t) => t[0]).join('');
  const mb = tb.slice(1, -1).map((t) => t[0]).join('');
  return ma !== mb;
}

export function pairScore(a: Candidate, b: Candidate, cfg: MergeThresholds, verdict?: Verdict): ScoreBreakdown {
  const context = contextScore(a.neighbours, b.neighbours);
  const v = verdict === undefined ? null : VERDICT_VALUE[verdict];
  if (a.type !== b.type) return { name: 0, context, verdict: v, capped: 'type-mismatch', total: 0 };
  const name = nameScore(a.name, b.name, a.type);
  let total = combineScore(name, context, v);
  let capped: ScoreBreakdown['capped'];
  if (a.name.tokens.join(' ') === b.name.tokens.join(' ')) total = Math.max(total, 0.95);
  if (suffixConflict(a, b) && total > 0.5) [total, capped] = [0.5, 'suffix-conflict'];
  if (a.type === 'person' && initialConflict(a.name, b.name) && total > 0.5) [total, capped] = [0.5, 'initial-conflict'];
  if (verdict === 'different' && total > 0.55) [total, capped] = [0.55, 'verdict-different'];
  if (total >= cfg.mergeAutoThreshold && name < 0.9) [total, capped] = [cfg.mergeAutoThreshold - 0.01, 'auto-needs-name>=0.90'];
  total = Math.min(1, Math.max(0, total));
  return capped === undefined ? { name, context, verdict: v, total } : { name, context, verdict: v, capped, total };
}

export function ghostOpacity(confidence: number, cfg: MergeThresholds): number {
  const span = cfg.mergeAutoThreshold - cfg.mergeGhostThreshold;
  const raw = span > 0 ? 0.25 + (0.5 * (confidence - cfg.mergeGhostThreshold)) / span : 0.75;
  return Math.min(0.75, Math.max(0.25, raw));
}
