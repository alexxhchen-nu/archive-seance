import type { Anchor, Entity, EntityType, InferenceSourceTag, Mention, RelationLabel } from '../types';
import type { RelationCandidate } from '../pipeline/runExtraction';
import { SYMMETRIC_LABELS } from '../eval/score';
import { candidateKey } from './merge';

export type RouteBadge = InferenceSourceTag | 'mixed';

export interface EvidenceRef {
  docId: string;
  page: number;
  start: number;
  end: number;
  quote: string;
}

export interface GraphNode {
  /** `n:${min candidate key of the member mentions}`; see graphNodeId. */
  id: string;
  entityId: string;
  type: EntityType;
  label: string;
  /** Number of member mentions with stored evidence (drives node size). */
  mentions: number;
  status: 'solid' | 'ghost';
  confidence: number;
  evidence: EvidenceRef[];
  evidenceCount: number;
  routes: InferenceSourceTag[];
  route: RouteBadge;
}

export interface GraphLink {
  /** Directed: `l:${label}:${source}>${target}`; symmetric: `l:${label}:${min}|${max}`. */
  id: string;
  source: string;
  target: string;
  label: RelationLabel;
  directed: boolean;
  evidence: EvidenceRef[];
  evidenceCount: number;
  routes: InferenceSourceTag[];
  route: RouteBadge;
}

export interface Graph {
  nodes: GraphNode[];
  links: GraphLink[];
  dropped: { nodesNoEvidence: number; linksNoEvidence: number; linksDangling: number };
}

const hasEvidence = (a: Anchor | undefined): a is Anchor =>
  a !== undefined && typeof a.quote === 'string' && a.quote.trim().length > 0 && a.end > a.start;

const anchorKey = (a: Anchor) => `${a.docId}\u0000${a.page}\u0000${a.start}\u0000${a.end}`;

function sortedEvidence(anchors: Iterable<Anchor>): EvidenceRef[] {
  const byKey = new Map<string, EvidenceRef>();
  for (const a of anchors) {
    const k = anchorKey(a);
    if (!byKey.has(k)) byKey.set(k, { docId: a.docId, page: a.page, start: a.start, end: a.end, quote: a.quote });
  }
  return [...byKey.values()].sort(
    (x, y) => (x.docId < y.docId ? -1 : x.docId > y.docId ? 1 : x.page - y.page || x.start - y.start || x.end - y.end),
  );
}

function routeInfo(tags: Iterable<InferenceSourceTag>): { routes: InferenceSourceTag[]; route: RouteBadge } {
  const routes = [...new Set(tags)].sort();
  return { routes, route: routes.length > 1 ? 'mixed' : (routes[0] ?? 'on_device') };
}

/**
 * Graph node id rule: the lexicographically smallest candidate key among the entity's evidenced member
 * mentions. Independent of input order. It is stable while a cluster grows, unless a newly absorbed
 * member has a smaller key than all existing members (documented limitation, see WORKLOG T21).
 */
export function graphNodeId(memberKeys: Iterable<string>): string {
  const min = [...memberKeys].sort()[0];
  return min === undefined ? '' : `n:${min}`;
}

export function graphLinkId(label: RelationLabel, source: string, target: string): string {
  if (SYMMETRIC_LABELS.has(label as never)) {
    const [a, b] = source <= target ? [source, target] : [target, source];
    return `l:${label}:${a}|${b}`;
  }
  return `l:${label}:${source}>${target}`;
}

/**
 * Pure: merged entities + extraction relations -> renderable graph (R8.4: nothing without stored evidence).
 * Evidence is deduplicated by (docId, page, start, end); evidenceCount = number of distinct anchors.
 */
export function toGraph(
  entities: readonly Entity[],
  mentions: readonly Mention[],
  relations: readonly RelationCandidate[],
): Graph {
  const mentionById = new Map(mentions.map((m) => [m.id, m]));
  const dropped = { nodesNoEvidence: 0, linksNoEvidence: 0, linksDangling: 0 };

  const nodes: GraphNode[] = [];
  // candidateKey -> node ids (a key belongs to one entity in practice; a set guards against ambiguity).
  const nodesByKey = new Map<string, Set<string>>();
  for (const e of entities) {
    const ms = e.mentionIds.map((id) => mentionById.get(id)).filter((m): m is Mention => m !== undefined && hasEvidence(m.anchor));
    if (ms.length === 0) {
      dropped.nodesNoEvidence++;
      continue;
    }
    const keys = new Set(ms.map((m) => candidateKey(m)));
    const id = graphNodeId(keys);
    const evidence = sortedEvidence(ms.map((m) => m.anchor));
    nodes.push({
      id,
      entityId: e.id,
      type: e.type,
      label: e.label,
      mentions: new Set(ms.map((m) => m.id)).size,
      status: e.status,
      confidence: e.confidence,
      evidence,
      evidenceCount: evidence.length,
      ...routeInfo(ms.map((m) => m.source.inferenceSource)),
    });
    for (const k of keys) nodesByKey.set(k, (nodesByKey.get(k) ?? new Set<string>()).add(id));
  }
  nodes.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const resolve = (name: string): string | undefined => {
    const hits = new Set<string>();
    for (const type of ['person', 'org'] as const) for (const id of nodesByKey.get(candidateKey({ surface: name, type })) ?? []) hits.add(id);
    return hits.size === 1 ? [...hits][0] : undefined;
  };

  const acc = new Map<string, { source: string; target: string; label: RelationLabel; directed: boolean; anchors: Anchor[]; tags: InferenceSourceTag[] }>();
  for (const r of relations) {
    if (!hasEvidence(r.anchor)) {
      dropped.linksNoEvidence++;
      continue;
    }
    const s = resolve(r.subject);
    const t = resolve(r.object);
    if (s === undefined || t === undefined || s === t) {
      dropped.linksDangling++;
      continue;
    }
    const directed = !SYMMETRIC_LABELS.has(r.label);
    const [source, target] = directed || s <= t ? [s, t] : [t, s];
    const id = graphLinkId(r.label, source, target);
    const cur = acc.get(id) ?? { source, target, label: r.label, directed, anchors: [], tags: [] };
    cur.anchors.push(r.anchor);
    cur.tags.push(r.inferenceSource);
    acc.set(id, cur);
  }
  const links: GraphLink[] = [...acc]
    .map(([id, l]) => {
      const evidence = sortedEvidence(l.anchors);
      return { id, source: l.source, target: l.target, label: l.label, directed: l.directed, evidence, evidenceCount: evidence.length, ...routeInfo(l.tags) };
    })
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  return { nodes, links, dropped };
}
