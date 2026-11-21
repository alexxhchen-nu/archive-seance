import { describe, expect, it } from 'vitest';
import { NHPRC_FIXTURE_ID, NHPRC_PDF_SHA256, runEvalExport } from '../../../src/app/evalExport';
import type { GenerateLike } from '../../../src/ai/call';
import { DEFAULTS } from '../../../src/config/defaults';
import { validatePredictions } from '../../../src/eval/predictions';
import type { Chunk, PageText } from '../../../src/types';

const page = (n: number, text: string, docId = NHPRC_PDF_SHA256): PageText => ({ docId, page: n, text, itemOffsets: [0], status: 'ok' });
const chunk = (p: PageText): Chunk => ({ id: `d:${p.page}:0`, docId: 'd', page: p.page, start: 0, end: p.text.length });

const model: GenerateLike = {
  async generateContent() {
    const text = JSON.stringify({ entities: [{ name: 'Ada Vole', type: 'person', quote: 'Ada Vole spoke' }], relations: [] });
    return { response: { text: () => text, inferenceSource: 'on_device' } };
  }
} as unknown as GenerateLike;

describe('runEvalExport', () => {
  const pages = [page(1, 'Ada Vole spoke.'), page(2, 'Nothing here.'), page(3, 'Ada Vole spoke again.')];
  const doc = { pageTexts: pages, chunkList: pages.map(chunk) };
  let t = 0;
  const deps = {
    cfg: DEFAULTS, model, flavor: 'real' as const, gitSha: 'abc',
    env: () => ({ localAvailability: 'available' as const, online: true, localChunksUsed: 0 }),
    now: () => new Date('2026-11-21T00:00:00Z'), clock: () => (t += 50)
  };

  it('runs pages 1–2 only and returns a valid payload with wall-clock', async () => {
    const p = await runEvalExport(doc, 'local-only', deps);
    expect(validatePredictions(p, NHPRC_FIXTURE_ID).ok).toBe(true);
    expect(p.wallClockMs).toBe(50);
    expect(p.entities.flatMap((e) => e.mentions.map((m) => m.page))).toEqual([1]);
    expect(p.inferenceSource.on_device).toBe(2);
  });

  it('refuses when pages 1–2 are not indexed', async () => {
    await expect(runEvalExport({ pageTexts: [pages[2] as PageText], chunkList: [] }, 'local-only', deps)).rejects.toThrow(/pages 1–2 must be indexed/);
  });

  it('refuses when the open PDF SHA-256 is not the NHPRC minutes', async () => {
    const other = [page(1, 'Ada Vole spoke.', 'abcd'), page(2, 'Nothing here.', 'abcd')];
    await expect(runEvalExport({ pageTexts: other, chunkList: other.map(chunk) }, 'local-only', deps)).rejects.toThrow(/SHA-256 mismatch/);
  });
});
