import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AI } from 'firebase/ai';

const { getGenerativeModel } = vi.hoisted(() => ({
  getGenerativeModel: vi.fn((_ai: unknown, _p: unknown) => ({ id: Math.random() }))
}));
vi.mock('firebase/ai', () => ({ getGenerativeModel }));

const { makeModel, clearModelCache } = await import('../../../src/ai/models');
const { EXTRACTION_SCHEMA } = await import('../../../src/ai/schemas');
const { DEFAULTS } = await import('../../../src/config/defaults');

const ai = {} as AI;

interface Params {
  mode: string;
  onDeviceParams: { createOptions: unknown; promptOptions: { responseConstraint: unknown } };
  inCloudParams: { model: string; generationConfig: { responseSchema: unknown; responseMimeType: string; temperature: number } };
}

describe('makeModel', () => {
  beforeEach(() => { clearModelCache(); getGenerativeModel.mockClear(); });

  it('builds hybrid params sharing one schema object', () => {
    makeModel(ai, 'extract', 'only_on_device', DEFAULTS);
    const p = getGenerativeModel.mock.calls[0]?.[1] as Params;
    expect(p.mode).toBe('only_on_device');
    expect(p.onDeviceParams.promptOptions.responseConstraint).toBe(EXTRACTION_SCHEMA);
    expect(p.inCloudParams.generationConfig.responseSchema).toBe(p.onDeviceParams.promptOptions.responseConstraint);
    expect(p.inCloudParams.model).toBe('gemini-3.5-flash-lite');
    expect(p.inCloudParams.generationConfig).toMatchObject({ responseMimeType: 'application/json', temperature: 0 });
    expect(p.onDeviceParams.createOptions).toEqual({
      expectedInputs: [{ type: 'text', languages: ['en'] }],
      expectedOutputs: [{ type: 'text', languages: ['en'] }]
    });
  });

  it('caches per kind|mode|cloudModel', () => {
    const a = makeModel(ai, 'extract', 'only_on_device', DEFAULTS);
    expect(makeModel(ai, 'extract', 'only_on_device', DEFAULTS)).toBe(a);
    expect(makeModel(ai, 'extract', 'only_in_cloud', DEFAULTS)).not.toBe(a);
    expect(makeModel(ai, 'extract', 'only_on_device', { ...DEFAULTS, cloudModel: 'x' })).not.toBe(a);
    expect(getGenerativeModel).toHaveBeenCalledTimes(3);
  });
});
