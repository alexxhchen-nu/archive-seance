import { normalizeName } from '../graph/similarity';
import type { EntityType, ExtractionRelationLabel } from '../types';

export interface GoldEntity {
  id: string;
  name: string;
  type: EntityType;
  aliases: string[];
  mentions: Array<{ page: number; quote: string }>;
}

export interface GoldRelation {
  subject: string;
  object: string;
  label: ExtractionRelationLabel;
  page: number;
  quote: string;
}

export interface GoldSet {
  entities: GoldEntity[];
  relations: GoldRelation[];
}

export interface Score {
  tp: number;
  fp: number;
  fn: number;
  /** null when nothing was predicted. */
  precision: number | null;
  /** null when the gold set is empty. */
  recall: number | null;
}

export interface EntityScore extends Score {
  mentions: { predicted: number; matched: number; unmatched: number };
}

export const SYMMETRIC_LABELS: ReadonlySet<ExtractionRelationLabel> = new Set(['met-with', 'communicated-with', 'family', 'business-partner']);

const ratio = (num: number, den: number): number | null => (den === 0 ? null : num / den);

function key(s: string, type: EntityType): string {
  const n = normalizeName(s, type);
  return [...n.tokens, ...(n.suffix ? [n.suffix] : [])].join(' ');
}

/** Gold entity ids whose name or alias normalizes like `surface` (restricted to `type` when given). */
export function resolveGold(gold: GoldSet, surface: string, type?: EntityType): string[] {
  return gold.entities
    .filter((e) => (type === undefined || e.type === type))
    .filter((e) => {
      const k = key(surface, e.type);
      return k.length > 0 && [e.name, ...e.aliases].some((a) => key(a, e.type) === k);
    })
    .map((e) => e.id);
}

export function scoreEntities(gold: GoldSet, predicted: ReadonlyArray<{ surface: string; type: EntityType }>): EntityScore {
  const surfaces = new Map<string, string[]>();
  let matchedMentions = 0;
  for (const p of predicted) {
    const ids = resolveGold(gold, p.surface, p.type);
    if (ids.length > 0) matchedMentions++;
    surfaces.set(`${p.type}\u0000${key(p.surface, p.type)}`, ids);
  }
  const hit = new Set<string>();
  let tpSurfaces = 0;
  for (const ids of surfaces.values()) {
    if (ids.length > 0) tpSurfaces++;
    for (const id of ids) hit.add(id);
  }
  const fp = surfaces.size - tpSurfaces;
  const tp = hit.size;
  return {
    tp, fp, fn: gold.entities.length - tp,
    precision: ratio(tpSurfaces, surfaces.size),
    recall: ratio(tp, gold.entities.length),
    mentions: { predicted: predicted.length, matched: matchedMentions, unmatched: predicted.length - matchedMentions }
  };
}

export function scoreRelations(gold: GoldSet, predicted: ReadonlyArray<{ subject: string; object: string; label: ExtractionRelationLabel }>): Score {
  const matches = (g: GoldRelation, subj: string[], obj: string[]): boolean =>
    (subj.includes(g.subject) && obj.includes(g.object)) ||
    (SYMMETRIC_LABELS.has(g.label) && subj.includes(g.object) && obj.includes(g.subject));
  const unique = new Map<string, { subj: string[]; obj: string[]; label: ExtractionRelationLabel }>();
  for (const p of predicted) {
    const subj = resolveGold(gold, p.subject);
    const obj = resolveGold(gold, p.object);
    unique.set(`${key(p.subject, 'person')}\u0000${key(p.object, 'person')}\u0000${p.label}`, { subj, obj, label: p.label });
  }
  const hit = new Set<number>();
  let tpPred = 0;
  for (const u of unique.values()) {
    let any = false;
    gold.relations.forEach((g, i) => {
      if (g.label === u.label && matches(g, u.subj, u.obj)) { hit.add(i); any = true; }
    });
    if (any) tpPred++;
  }
  return {
    tp: hit.size, fp: unique.size - tpPred, fn: gold.relations.length - hit.size,
    precision: ratio(tpPred, unique.size),
    recall: ratio(hit.size, gold.relations.length)
  };
}
