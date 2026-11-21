import { describe, expect, it, vi } from 'vitest';
import {
  MissingInferenceSourceError, ModelTimeoutError, PrivacyInvariantError, assertPrivacy, callModel
} from '../../../src/ai/call';

const fake = (source: string | undefined, text = '{}') => ({
  generateContent: vi.fn(async () => ({ response: { text: () => text, inferenceSource: source } }))
});

describe('callModel', () => {
  it('captures the reported source', async () => {
    const r = await callModel(fake('in_cloud', 'hi'), 'p', { timeoutMs: 1000 });
    expect(r.source).toBe('in_cloud');
    expect(r.text).toBe('hi');
    expect(r.ms).toBeGreaterThanOrEqual(0);
  });

  it('times out', async () => {
    const model = { generateContent: () => new Promise<never>(() => {}) };
    await expect(callModel(model, 'p', { timeoutMs: 10 })).rejects.toBeInstanceOf(ModelTimeoutError);
  });

  it('rejects a missing source', async () => {
    await expect(callModel(fake(undefined), 'p', { timeoutMs: 1000 })).rejects.toBeInstanceOf(MissingInferenceSourceError);
  });

  it('enforces the privacy invariant', () => {
    expect(() => assertPrivacy('sensitive', 'in_cloud')).toThrow(PrivacyInvariantError);
    expect(() => assertPrivacy('sensitive', 'on_device')).not.toThrow();
    expect(() => assertPrivacy('public', 'in_cloud')).not.toThrow();
  });
});
