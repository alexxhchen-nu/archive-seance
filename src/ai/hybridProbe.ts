import type { AI, InferenceMode } from 'firebase/ai';
import type { Config } from '../config/defaults';
import type { HybridModeName, InferenceLogEntry, InferenceSourceTag } from '../types';
import { assertModeHonored, callModel } from './call';
import type { GenerateLike } from './call';
import { makeModel as realMakeModel } from './models';
import { buildExtractionPrompt } from './prompts';

export const SAMPLE_TEXT =
  'On 4 May 1952 the Harbor Commission chaired by Edith Marlow met with representatives of the Lantern Trading Company.';

export interface ProbeEntity { name: string; type: 'person' | 'org'; quote: string }
export interface ProbeRelation { subject: string; object: string; label: string; quote: string }

export interface HybridProbeResult {
  requestedMode: HybridModeName;
  source: InferenceSourceTag;
  ms: number;
  entities: ProbeEntity[];
  relations: ProbeRelation[];
  rawText: string;
  log: InferenceLogEntry;
}

export class ModelOutputParseError extends Error {
  override name = 'ModelOutputParseError';
  constructor(message: string, readonly rawText: string, readonly source: InferenceSourceTag) {
    super(message);
  }
}

export type MakeModelFn = (ai: AI, kind: 'extract' | 'probe', mode: InferenceMode, cfg: Config) => GenerateLike;

export interface HybridProbeDeps {
  ai: AI;
  cfg: Config;
  makeModel?: MakeModelFn;
}

export const MODE_MAP: Record<HybridModeName, InferenceMode> = {
  only_on_device: 'only_on_device',
  prefer_on_device: 'prefer_on_device',
  only_in_cloud: 'only_in_cloud'
};

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string';

export function parseExtraction(rawText: string, source: InferenceSourceTag): { entities: ProbeEntity[]; relations: ProbeRelation[] } {
  let data: unknown;
  try {
    data = JSON.parse(rawText);
  } catch {
    throw new ModelOutputParseError('Model returned invalid JSON', rawText, source);
  }
  if (!isObj(data) || !Array.isArray(data.entities) || !Array.isArray(data.relations)) {
    throw new ModelOutputParseError('Model JSON does not match the extraction schema', rawText, source);
  }
  const entities: ProbeEntity[] = [];
  for (const e of data.entities as unknown[]) {
    if (!isObj(e) || !isStr(e.name) || (e.type !== 'person' && e.type !== 'org') || !isStr(e.quote)) {
      throw new ModelOutputParseError('Entity item does not match the schema', rawText, source);
    }
    entities.push({ name: e.name, type: e.type, quote: e.quote });
  }
  const relations: ProbeRelation[] = [];
  for (const r of data.relations as unknown[]) {
    if (!isObj(r) || !isStr(r.subject) || !isStr(r.object) || !isStr(r.label) || !isStr(r.quote)) {
      throw new ModelOutputParseError('Relation item does not match the schema', rawText, source);
    }
    relations.push({ subject: r.subject, object: r.object, label: r.label, quote: r.quote });
  }
  return { entities, relations };
}

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function runHybridProbe(deps: HybridProbeDeps, mode: HybridModeName): Promise<HybridProbeResult> {
  const make: MakeModelFn = deps.makeModel ?? realMakeModel;
  const model = make(deps.ai, 'extract', MODE_MAP[mode], deps.cfg);
  const prompt = buildExtractionPrompt(SAMPLE_TEXT);
  const call = await callModel(model, prompt, { timeoutMs: deps.cfg.localCallTimeoutMs });
  assertModeHonored(mode, call.source);
  const parsed = parseExtraction(call.text, call.source);
  const log: InferenceLogEntry = {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    kind: 'extract',
    requestedRoute: mode === 'only_in_cloud' ? 'cloud' : 'local',
    inferenceSource: call.source,
    payloadChars: prompt.length,
    payloadSha256: await sha256Hex(prompt),
    ms: Math.round(call.ms)
  };
  return { requestedMode: mode, source: call.source, ms: call.ms, ...parsed, rawText: call.text, log };
}

export interface DeviceInitLike {
  initializeDeviceModel(onProgress?: (p: number) => void): Promise<void>;
}

/** Must be called only from a click handler (user gesture required by Chrome). */
export function initDeviceModel(model: DeviceInitLike, onProgress: (p: number) => void): Promise<void> {
  return model.initializeDeviceModel(onProgress);
}
