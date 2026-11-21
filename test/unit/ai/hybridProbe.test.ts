import { describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';
import type { AI } from 'firebase/ai';

vi.mock('firebase/ai', () => ({ getGenerativeModel: vi.fn() }));

const { runHybridProbe, ModelOutputParseError, initDeviceModel } = await import('../../../src/ai/hybridProbe');
const { DEFAULTS } = await import('../../../src/config/defaults');

const GOOD = JSON.stringify({
  entities: [{ name: 'Edith Marlow', type: 'person', quote: 'chaired by Edith Marlow' }],
  relations: []
});

function deps(behave: (mode: string) => Promise<{ text: string; source?: string }>) {
  const generate = vi.fn();
  const modes: string[] = [];
  const makeModel = vi.fn((_ai: AI, _k: string, mode: string) => {
    modes.push(mode);
    return {
      generateContent: generate.mockImplementation(async () => {
        const r = await behave(mode);
        return { response: { text: () => r.text, inferenceSource: r.source } };
      })
    };
  });
  return { d: { ai: {} as AI, cfg: DEFAULTS, makeModel }, generate, modes };
}

describe('runHybridProbe', () => {
  it('on-device path', async () => {
    const { d, modes } = deps(async () => ({ text: GOOD, source: 'on_device' }));
    const r = await runHybridProbe(d, 'only_on_device');
    expect(modes).toEqual(['only_on_device']);
    expect(r.source).toBe('on_device');
    expect(r.requestedMode).toBe('only_on_device');
    expect(r.entities[0]?.name).toBe('Edith Marlow');
    expect(r.log.inferenceSource).toBe('on_device');
    expect(r.log.payloadSha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('cloud path and hybrid fallback report what the SDK said', async () => {
    const { d } = deps(async () => ({ text: GOOD, source: 'in_cloud' }));
    expect((await runHybridProbe(d, 'only_in_cloud')).source).toBe('in_cloud');
    const r = await runHybridProbe(d, 'prefer_on_device');
    expect(r.source).toBe('in_cloud');
    expect(r.requestedMode).toBe('prefer_on_device');
  });

  it('invalid JSON -> typed error', async () => {
    const { d } = deps(async () => ({ text: 'not json', source: 'on_device' }));
    await expect(runHybridProbe(d, 'only_on_device')).rejects.toBeInstanceOf(ModelOutputParseError);
  });

  it('ONLY_ON_DEVICE error surfaces without cloud fallback, single call', async () => {
    const { d, generate, modes } = deps(async () => { throw new Error('on-device model unavailable'); });
    await expect(runHybridProbe(d, 'only_on_device')).rejects.toThrow('on-device model unavailable');
    expect(generate).toHaveBeenCalledTimes(1);
    expect(modes).toEqual(['only_on_device']);
  });

  it('initDeviceModel forwards progress', async () => {
    const seen: number[] = [];
    await initDeviceModel({ initializeDeviceModel: async (cb) => { cb?.(0.5); } }, (p) => seen.push(p));
    expect(seen).toEqual([0.5]);
  });

  it('property: non-conforming text always rejects with the typed parse error', async () => {
    const nonConforming = fc.oneof(
      fc.string().filter((s) => { try { JSON.parse(s); return false; } catch { return true; } }),
      fc.jsonValue().filter((v) => typeof v !== 'object' || v === null || Array.isArray(v) ||
        !Array.isArray((v as Record<string, unknown>).entities) || !Array.isArray((v as Record<string, unknown>).relations))
        .map((v) => JSON.stringify(v)),
      fc.record({ entities: fc.array(fc.oneof(fc.integer(), fc.constant(null), fc.record({ name: fc.integer() })), { minLength: 1 }), relations: fc.constant([]) })
        .map((v) => JSON.stringify(v))
    );
    await fc.assert(fc.asyncProperty(nonConforming, async (text) => {
      const { d } = deps(async () => ({ text, source: 'in_cloud' }));
      const err = await runHybridProbe(d, 'only_in_cloud').then(() => null, (e: unknown) => e);
      expect(err).toBeInstanceOf(ModelOutputParseError);
    }), { numRuns: 200 });
  });
});

describe('runHybridProbe mode guard', () => {
  it('rejects an only_on_device run that the SDK reports as in_cloud', async () => {
    const { ModeViolationError } = await import('../../../src/ai/call');
    const { d } = deps(async () => ({ text: GOOD, source: 'in_cloud' }));
    await expect(runHybridProbe(d, 'only_on_device')).rejects.toBeInstanceOf(ModeViolationError);
  });
});
