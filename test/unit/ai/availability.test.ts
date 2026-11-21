import { describe, expect, it, vi } from 'vitest';
import { probeOnDevice } from '../../../src/ai/availability';

describe('probeOnDevice', () => {
  it('api-missing without the global', async () => {
    expect((await probeOnDevice({})).availability).toBe('api-missing');
  });

  it('passes through availability with the expected options', async () => {
    const availability = vi.fn(async () => 'available');
    expect((await probeOnDevice({ LanguageModel: { availability } })).availability).toBe('available');
    expect(availability).toHaveBeenCalledWith({
      expectedInputs: [{ type: 'text', languages: ['en'] }],
      expectedOutputs: [{ type: 'text', languages: ['en'] }]
    });
    const r = await probeOnDevice({ LanguageModel: { availability: async () => 'downloadable' } });
    expect(r.availability).toBe('downloadable');
    expect(r.hint).not.toBe('');
  });

  it('unavailable when it throws', async () => {
    const r = await probeOnDevice({ LanguageModel: { availability: async () => { throw new Error('x'); } } });
    expect(r.availability).toBe('unavailable');
  });
});
