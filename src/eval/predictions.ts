import { buildEntities } from '../graph/merge';
import type { MergeThresholds } from '../graph/confidence';
import type { ExtractionResult } from '../pipeline/runExtraction';
import type { EntityType, ExtractionRelationLabel } from '../types';
import { scoreEntities, scoreRelations } from './score';
import type { EntityScore, GoldSet, Score } from './score';

/** Export format for one real extension run, scored by `npm run eval -- --predictions` (R17.2, R17.3). */
export const PREDICTIONS_SCHEMA = 'archive-seance/eval-predictions@1';

export type EvalMode = 'local-only' | 'cloud-enabled';
/** `mock` means the run used the scripted Firebase layer (`build:mock`); eval refuses it. */
export type BuildFlavor = 'real' | 'mock';

const MODES: readonly string[] = ['local-only', 'cloud-enabled'];
const TYPES: readonly string[] = ['person', 'org'];
const SOURCES = ['on_device', 'in_cloud', 'failed'] as const;
const LABELS: readonly string[] = ['employed-by', 'member-of', 'family', 'business-partner', 'met-with', 'communicated-with'];

export interface PredictionMention { page: number; quote: string; surface: string }
export interface PredictionEntity { label: string; type: EntityType; mentions: PredictionMention[] }
export interface PredictionRelation { subject: string; object: string; label: ExtractionRelationLabel; page: number; quote: string }

export interface Predictions {
  schema: typeof PREDICTIONS_SCHEMA;
  fixtureId: string;
  mode: EvalMode;
  build: { flavor: BuildFlavor; gitSha: string | null };
  timestamp: string;
  wallClockMs: number | null;
  inferenceSource: Record<(typeof SOURCES)[number], number>;
  entities: PredictionEntity[];
  relations: PredictionRelation[];
}

export interface BuildPredictionsMeta {
  fixtureId: string;
  mode: EvalMode;
  flavor: BuildFlavor;
  gitSha?: string | null;
  timestamp: string;
  wallClockMs?: number | null;
  mergeCfg: MergeThresholds;
}

/** Builds the export payload from pipeline output. Only names, pages and anchored quotes are kept. */
export function buildPredictions(result: Pick<ExtractionResult, 'mentions' | 'relations' | 'log'>, meta: BuildPredictionsMeta): Predictions {
  const byId = new Map(result.mentions.map((m) => [m.id, m]));
  const entities = buildEntities(result.mentions, { cfg: meta.mergeCfg }).map((e) => ({
    label: e.label,
    type: e.type,
    mentions: e.mentionIds.flatMap((id) => {
      const m = byId.get(id);
      return m ? [{ page: m.anchor.page, quote: m.anchor.quote, surface: m.surface }] : [];
    })
  }));
  const inferenceSource = { on_device: 0, in_cloud: 0, failed: 0 };
  for (const l of result.log) inferenceSource[l.inferenceSource]++;
  return {
    schema: PREDICTIONS_SCHEMA,
    fixtureId: meta.fixtureId,
    mode: meta.mode,
    build: { flavor: meta.flavor, gitSha: meta.gitSha ?? null },
    timestamp: meta.timestamp,
    wallClockMs: meta.wallClockMs ?? null,
    inferenceSource,
    entities,
    relations: result.relations.map((r) => ({ subject: r.subject, object: r.object, label: r.label, page: r.anchor.page, quote: r.anchor.quote }))
  };
}

export type ValidationResult = { ok: true; value: Predictions } | { ok: false; error: string; mock?: boolean };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';
const isPage = (v: unknown): boolean => Number.isInteger(v) && (v as number) >= 1;

/** Schema check, mock-build refusal and fixture match. The mock check runs before the rest of the schema. */
export function validatePredictions(raw: unknown, goldFixtureId: string): ValidationResult {
  if (!isObj(raw)) return { ok: false, error: 'predictions file is not a JSON object' };
  const build = raw.build;
  if (!isObj(build) || (build.flavor !== 'real' && build.flavor !== 'mock')) return { ok: false, error: 'build.flavor must be "real" or "mock"' };
  if (build.flavor === 'mock') {
    return { ok: false, mock: true, error: 'predictions came from the MOCK build (scripted Firebase, build:mock); eval refuses mock runs. Export from a real build instead' };
  }
  if (raw.schema !== PREDICTIONS_SCHEMA) return { ok: false, error: `schema must be "${PREDICTIONS_SCHEMA}"` };
  if (!isStr(raw.fixtureId)) return { ok: false, error: 'fixtureId is missing' };
  if (raw.fixtureId !== goldFixtureId) return { ok: false, error: `fixtureId "${raw.fixtureId}" does not match gold "${goldFixtureId}"` };
  if (typeof raw.mode !== 'string' || !MODES.includes(raw.mode)) return { ok: false, error: 'mode must be "local-only" or "cloud-enabled"' };
  if (build.gitSha !== null && build.gitSha !== undefined && typeof build.gitSha !== 'string') return { ok: false, error: 'build.gitSha must be a string or null' };
  if (!isStr(raw.timestamp) || Number.isNaN(Date.parse(raw.timestamp))) return { ok: false, error: 'timestamp must be an ISO date string' };
  if (raw.wallClockMs !== null && raw.wallClockMs !== undefined &&
    !(typeof raw.wallClockMs === 'number' && Number.isFinite(raw.wallClockMs) && raw.wallClockMs >= 0)) {
    return { ok: false, error: 'wallClockMs must be a non-negative number or null' };
  }
  const src = raw.inferenceSource;
  if (!isObj(src) || !SOURCES.every((k) => Number.isInteger(src[k]) && (src[k] as number) >= 0)) {
    return { ok: false, error: 'inferenceSource must have integer counts for on_device, in_cloud, failed' };
  }
  if ((src.on_device as number) + (src.in_cloud as number) < 1) {
    return { ok: false, error: 'predictions have no on_device or in_cloud model calls; refusing to score a run that did not infer' };
  }
  if (!Array.isArray(raw.entities)) return { ok: false, error: 'entities must be an array' };
  for (const [i, e] of raw.entities.entries()) {
    if (!isObj(e) || !isStr(e.label) || typeof e.type !== 'string' || !TYPES.includes(e.type) || !Array.isArray(e.mentions)) {
      return { ok: false, error: `entities[${i}] needs label, type (person|org) and mentions` };
    }
    for (const m of e.mentions as unknown[]) {
      if (!isObj(m) || !isPage(m.page) || !isStr(m.quote) || !isStr(m.surface)) return { ok: false, error: `entities[${i}].mentions need page, quote, surface` };
    }
  }
  if (!Array.isArray(raw.relations)) return { ok: false, error: 'relations must be an array' };
  for (const [i, r] of raw.relations.entries()) {
    if (!isObj(r) || !isStr(r.subject) || !isStr(r.object) || typeof r.label !== 'string' || !LABELS.includes(r.label) || !isPage(r.page) || !isStr(r.quote)) {
      return { ok: false, error: `relations[${i}] needs subject, object, label, page, quote` };
    }
  }
  const value = { ...raw, wallClockMs: raw.wallClockMs ?? null, build: { flavor: 'real', gitSha: build.gitSha ?? null } } as unknown as Predictions;
  return { ok: true, value };
}

/** Scores with score.ts: every exported mention surface is a predicted entity mention. */
export function scorePredictions(gold: GoldSet, p: Predictions): { entities: EntityScore; relations: Score } {
  const mentions = p.entities.flatMap((e) => e.mentions.map((m) => ({ surface: m.surface, type: e.type })));
  return { entities: scoreEntities(gold, mentions), relations: scoreRelations(gold, p.relations) };
}
