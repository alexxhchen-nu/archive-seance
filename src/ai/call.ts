import type { InferenceSourceTag, Sensitivity } from '../types';

/** Structural subset of GenerativeModel used here, so fakes need no SDK. */
export interface GenerateLike {
  generateContent(prompt: string): Promise<{
    response: { text(): string; inferenceSource?: string };
  }>;
}

export class ModelTimeoutError extends Error {
  override name = 'ModelTimeoutError';
  constructor(readonly timeoutMs: number) {
    super(`Model call timed out after ${timeoutMs} ms`);
  }
}

export class MissingInferenceSourceError extends Error {
  override name = 'MissingInferenceSourceError';
  constructor() {
    super('Response did not report inferenceSource');
  }
}

export class PrivacyInvariantError extends Error {
  override name = 'PrivacyInvariantError';
  constructor() {
    super('Privacy invariant violated: sensitive document was processed in the cloud');
  }
}

export class ModeViolationError extends Error {
  override name = 'ModeViolationError';
  constructor(readonly requested: string, readonly source: string) {
    super(`Mode ${requested} reported inferenceSource ${source}`);
  }
}

export function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new ModelTimeoutError(ms)), ms);
    p.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e: unknown) => { clearTimeout(timer); reject(e); }
    );
  });
}

export interface CallResult {
  source: InferenceSourceTag;
  text: string;
  ms: number;
}

export async function callModel(model: GenerateLike, prompt: string, opts: { timeoutMs: number }): Promise<CallResult> {
  const t0 = performance.now();
  const result = await withTimeout(model.generateContent(prompt), opts.timeoutMs);
  const raw = result.response.inferenceSource;
  if (raw !== 'on_device' && raw !== 'in_cloud') throw new MissingInferenceSourceError();
  const text = result.response.text();
  return { source: raw, text, ms: performance.now() - t0 };
}

export function assertPrivacy(sensitivity: Sensitivity, source: InferenceSourceTag): void {
  if (sensitivity === 'sensitive' && source !== 'on_device') throw new PrivacyInvariantError();
}

/** Fails closed if an "only" mode reports the other path. */
export function assertModeHonored(mode: 'only_on_device' | 'prefer_on_device' | 'only_in_cloud', source: InferenceSourceTag): void {
  if (mode === 'only_on_device' && source !== 'on_device') throw new ModeViolationError(mode, source);
  if (mode === 'only_in_cloud' && source !== 'in_cloud') throw new ModeViolationError(mode, source);
}
