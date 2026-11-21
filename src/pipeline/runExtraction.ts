import type { Config } from '../config/defaults';
import { assertModeHonored, assertPrivacy, callModel, ModeViolationError, PrivacyInvariantError } from '../ai/call';
import type { GenerateLike } from '../ai/call';
import { buildExtractionPrompt, buildRetryPrompt } from '../ai/prompts';
import { decideRoute } from '../ai/router';
import type { Env, RouterConfig } from '../ai/router';
import { validateExtraction } from '../ai/validators';
import { normalizeName } from '../graph/similarity';
import { sentenceStart } from '../pdf/sentenceStart';
import type {
  Anchor, Chunk, EntityType, ExtractionOutput, ExtractionRelationLabel, InferenceLogEntry,
  InferenceSourceTag, Mention, PageText, Sensitivity
} from '../types';
import { locateQuote } from './locateQuote';

export interface ExtractionInput {
  docId: string;
  sensitivity: Sensitivity;
  pages: PageText[];
  chunks: Chunk[];
}

export interface MentionSink {
  putMentions(docId: string, mentions: Mention[]): Promise<void>;
}

export type ChunkStatus = 'local' | 'pending-cloud' | 'failed';

export interface ExtractionProgress {
  done: number;
  total: number;
  chunkId: string;
  status: ChunkStatus;
}

export interface ExtractionDeps {
  cfg: RouterConfig & Pick<Config, 'localCallTimeoutMs'>;
  /** On-device model built with mode only_on_device. */
  model: GenerateLike;
  /** Read before every chunk; localChunksUsed is added to by the pipeline's own count. */
  env: () => Env;
  store?: MentionSink;
  onProgress?: (p: ExtractionProgress) => void;
  /** Receives every log entry as it is made, including the one for a call that aborts the run. */
  onLog?: (e: InferenceLogEntry) => void;
  signal?: AbortSignal;
  now?: () => Date;
  newId?: () => string;
  sha256?: (s: string) => Promise<string>;
}

export interface RelationCandidate {
  subject: string;
  object: string;
  label: ExtractionRelationLabel;
  anchor: Anchor;
  sentenceId: string;
  inferenceSource: InferenceSourceTag;
}

export interface ExtractionResult {
  mentions: Mention[];
  relations: RelationCandidate[];
  chunks: { total: number; local: number; pendingCloud: number; failed: number };
  pendingCloudChunkIds: string[];
  droppedUnanchored: number;
  /** Entities that produced a mention id already kept (same span, type and name). */
  duplicateMentions: number;
  log: InferenceLogEntry[];
  aborted: boolean;
  failures: Array<{ chunkId: string; reason: string }>;
}

async function subtleSha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

const errMsg = (e: unknown): string => (e instanceof Error ? e.message : String(e));
const isFatal = (e: unknown): boolean => e instanceof PrivacyInvariantError || e instanceof ModeViolationError;

export function nameKey(name: string, type: EntityType): string {
  return normalizeName(name, type).tokens.join(' ');
}

type Attempt = { ok: true; value: ExtractionOutput; source: InferenceSourceTag } | { ok: false; error: string };

export async function runExtraction(input: ExtractionInput, deps: ExtractionDeps): Promise<ExtractionResult> {
  const now = deps.now ?? (() => new Date());
  const newId = deps.newId ?? (() => crypto.randomUUID());
  const sha256 = deps.sha256 ?? subtleSha256;
  const { docId, sensitivity } = input;
  const pageText = new Map(input.pages.map((p) => [p.page, p.text]));

  const result: ExtractionResult = {
    mentions: [], relations: [],
    chunks: { total: input.chunks.length, local: 0, pendingCloud: 0, failed: 0 },
    pendingCloudChunkIds: [], droppedUnanchored: 0, duplicateMentions: 0, log: [], aborted: false, failures: []
  };
  const seen = new Set<string>();
  let localUsed = 0;
  let done = 0;

  const record = (e: InferenceLogEntry): void => {
    result.log.push(e);
    deps.onLog?.(e);
  };

  const attempt = async (prompt: string): Promise<Attempt> => {
    const t0 = performance.now();
    const base = {
      id: newId(), at: now().toISOString(), kind: 'extract' as const, requestedRoute: 'local' as const,
      payloadChars: prompt.length, payloadSha256: await sha256(prompt)
    };
    let source: InferenceSourceTag | undefined;
    try {
      const call = await callModel(deps.model, prompt, { timeoutMs: deps.cfg.localCallTimeoutMs });
      source = call.source;
      // Privacy is checked first so a sensitive document always reports the privacy violation.
      assertPrivacy(sensitivity, call.source);
      assertModeHonored('only_on_device', call.source);
      const v = validateExtraction(call.text);
      if (!v.ok) {
        record({ ...base, inferenceSource: call.source, ms: Math.round(performance.now() - t0), error: v.error });
        return { ok: false, error: v.error };
      }
      record({ ...base, inferenceSource: call.source, ms: Math.round(performance.now() - t0) });
      return { ok: true, value: v.value, source: call.source };
    } catch (e) {
      record({ ...base, inferenceSource: isFatal(e) ? 'failed' : (source ?? 'failed'), ms: Math.round(performance.now() - t0), error: errMsg(e) });
      if (isFatal(e)) throw e;
      return { ok: false, error: errMsg(e) };
    }
  };

  const finish = (chunk: Chunk, status: ChunkStatus, reason?: string): void => {
    if (status === 'local') result.chunks.local++;
    else if (status === 'pending-cloud') {
      result.chunks.pendingCloud++;
      result.pendingCloudChunkIds.push(chunk.id);
    } else {
      result.chunks.failed++;
      result.failures.push({ chunkId: chunk.id, reason: reason ?? 'failed' });
    }
    done++;
    deps.onProgress?.({ done, total: input.chunks.length, chunkId: chunk.id, status });
  };

  const collect = async (chunk: Chunk, text: string, chunkText: string, out: ExtractionOutput, source: InferenceSourceTag): Promise<void> => {
    const anchorOf = (quote: string): { anchor: Anchor; sentenceId: string } | null => {
      const span = locateQuote(chunkText, chunk.start, quote);
      if (!span) return null;
      const anchor: Anchor = { docId, page: chunk.page, start: span.start, end: span.end, quote: text.slice(span.start, span.end) };
      return { anchor, sentenceId: `${docId}:${chunk.page}:${sentenceStart(text, span.start)}` };
    };
    for (const ent of out.entities) {
      const a = anchorOf(ent.quote);
      if (!a) { result.droppedUnanchored++; continue; }
      const { start, end } = a.anchor;
      const id = await sha256(JSON.stringify([docId, chunk.page, start, end, ent.type, nameKey(ent.name, ent.type)]));
      if (seen.has(id)) { result.duplicateMentions++; continue; }
      seen.add(id);
      result.mentions.push({ id, surface: ent.name, type: ent.type, ...a, source: { route: 'local', inferenceSource: source, ocr: false } });
    }
    const known = (name: string): boolean => out.entities.some((e) => {
      const k = nameKey(e.name, e.type);
      return k.length > 0 && nameKey(name, e.type) === k;
    });
    for (const rel of out.relations) {
      const a = known(rel.subject) && known(rel.object) ? anchorOf(rel.quote) : null;
      if (!a) { result.droppedUnanchored++; continue; }
      result.relations.push({ subject: rel.subject, object: rel.object, label: rel.label, ...a, inferenceSource: source });
    }
  };

  for (const chunk of input.chunks) {
    if (deps.signal?.aborted) { result.aborted = true; break; }
    const text = pageText.get(chunk.page);
    if (text === undefined) { finish(chunk, 'failed', 'page text missing'); continue; }
    const chunkText = text.slice(chunk.start, chunk.end);
    const env = deps.env();
    const decision = decideRoute(
      { kind: 'extract', chunkChars: chunkText.length },
      { sensitivity, pages: input.pages.length },
      { ...env, localChunksUsed: env.localChunksUsed + localUsed },
      deps.cfg
    );
    if (decision.route === 'cloud') { finish(chunk, 'pending-cloud'); continue; }
    if (decision.route === 'blocked') { finish(chunk, 'failed', decision.reason); continue; }

    localUsed++;
    let r = await attempt(buildExtractionPrompt(chunkText));
    if (!r.ok) r = await attempt(buildRetryPrompt(chunkText));
    if (!r.ok) {
      if (sensitivity === 'sensitive') finish(chunk, 'failed', r.error);
      else finish(chunk, 'pending-cloud');
      continue;
    }
    await collect(chunk, text, chunkText, r.value, r.source);
    finish(chunk, 'local');
  }

  if (deps.store) await deps.store.putMentions(docId, result.mentions);
  return result;
}
