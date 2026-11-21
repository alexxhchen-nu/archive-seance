import type { GenerateLike } from '../ai/call';
import type { Env } from '../ai/router';
import type { Config } from '../config/defaults';
import { ghostOpacity } from '../graph/confidence';
import type { MergeThresholds } from '../graph/confidence';
import { buildEntities } from '../graph/merge';
import { runExtraction } from '../pipeline/runExtraction';
import type { ExtractionResult } from '../pipeline/runExtraction';
import type { Chunk, EntityType, ExtractionRelationLabel, PageText, ScoreBreakdown } from '../types';

/** T20 console demo dump: entities after T17 extraction + T18 merge. Only names, pages and anchored quotes. */
export const DEMO_SCHEMA = 'archive-seance/console-demo@1';

export interface DemoEvidence { page: number; quote: string }
export interface DemoEntity {
  id: string;
  label: string;
  type: EntityType;
  status: 'solid' | 'ghost';
  confidence: number;
  /** Design 7.4 ghost opacity; 1 for solid entities. */
  opacity: number;
  /** Distinct surfaces of the merged mentions. */
  members: string[];
  evidence: DemoEvidence[];
  weakestLink?: { a: string; b: string; score: ScoreBreakdown };
}
export interface DemoRelation { subject: string; object: string; label: ExtractionRelationLabel; page: number; quote: string }

export interface DemoPayload {
  schema: typeof DEMO_SCHEMA;
  docId: string;
  thresholds: MergeThresholds & { source: 'defaults' };
  chunks: ExtractionResult['chunks'];
  droppedUnanchored: number;
  entities: DemoEntity[];
  relations: DemoRelation[];
}

/** Pure view-model: buildEntities over the pipeline's mentions, solid/ghost from the design thresholds. */
export function buildDemoPayload(
  docId: string, result: Pick<ExtractionResult, 'mentions' | 'relations' | 'chunks' | 'droppedUnanchored'>, cfg: MergeThresholds
): DemoPayload {
  const byId = new Map(result.mentions.map((m) => [m.id, m]));
  const entities = buildEntities(result.mentions, { cfg }).map((e): DemoEntity => {
    const ms = e.mentionIds.flatMap((id) => byId.get(id) ?? []);
    const out: DemoEntity = {
      id: e.id, label: e.label, type: e.type, status: e.status, confidence: e.confidence,
      opacity: e.status === 'ghost' ? ghostOpacity(e.confidence, cfg) : 1,
      members: [...new Set(ms.map((m) => m.surface))],
      evidence: ms.map((m) => ({ page: m.anchor.page, quote: m.anchor.quote }))
    };
    if (e.weakestLink) {
      const { aMentionId, bMentionId, score } = e.weakestLink;
      out.weakestLink = { a: byId.get(aMentionId)?.surface ?? '', b: byId.get(bMentionId)?.surface ?? '', score };
    }
    return out;
  });
  return {
    schema: DEMO_SCHEMA,
    docId,
    thresholds: { mergeAutoThreshold: cfg.mergeAutoThreshold, mergeGhostThreshold: cfg.mergeGhostThreshold, source: 'defaults' },
    chunks: { ...result.chunks },
    droppedUnanchored: result.droppedUnanchored,
    entities,
    relations: result.relations.map((r) => ({ subject: r.subject, object: r.object, label: r.label, page: r.anchor.page, quote: r.anchor.quote }))
  };
}

export interface DemoRunDeps {
  cfg: Config;
  /** On-device model (only_on_device). */
  model: GenerateLike;
  env: () => Env;
}

/** Runs runExtraction (local route only, cloud disabled) on an indexed document, then builds the payload. */
export async function runConsoleDemo(doc: { docId: string; pageTexts: PageText[]; chunkList: Chunk[] }, deps: DemoRunDeps): Promise<DemoPayload> {
  const cfg = { ...deps.cfg, cloudEnabled: false };
  const result = await runExtraction(
    { docId: doc.docId, sensitivity: 'public', pages: doc.pageTexts, chunks: doc.chunkList },
    { cfg, model: deps.model, env: deps.env }
  );
  return buildDemoPayload(doc.docId, result, cfg);
}

/** Saves the demo payload as a JSON download. */
export function downloadDemoPayload(p: DemoPayload, doc: Document = document): void {
  const blob = new Blob([JSON.stringify(p, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = doc.createElement('a');
  a.href = url;
  a.download = `console-demo-${p.docId.slice(0, 12)}.json`;
  doc.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
