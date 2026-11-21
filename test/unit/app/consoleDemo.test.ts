import { describe, expect, it } from 'vitest';
import { buildDemoPayload, DEMO_SCHEMA, runConsoleDemo } from '../../../src/app/consoleDemo';
import { demoExtractionText, DEMO_SCRIPT } from '../../../src/ai/mock/mockFirebase';
import { DEFAULTS } from '../../../src/config/defaults';
import { buildPageIndex } from '../../../src/pdf/pageIndex';
import { chunkPages } from '../../../src/pdf/chunker';
import type { Mention } from '../../../src/types';
import { fakeModel } from '../../helpers/fakeModel';
import { openFixture } from '../../helpers/fixtures';

let n = 0;
const mention = (surface: string, sentence: string, page = 1): Mention => ({
  id: `m${n++}`, surface, type: 'person',
  anchor: { docId: 'd', page, start: 0, end: surface.length, quote: `${surface} spoke` },
  sentenceId: `d:${page}:${sentence}`,
  source: { route: 'local', inferenceSource: 'on_device', ocr: false }
});
const chunks = { total: 1, local: 1, pendingCloud: 0, failed: 0 };

describe('buildDemoPayload', () => {
  it('maps buildEntities status to solid/ghost with opacity, evidence and thresholds', () => {
    const ms = [mention('John Smith', '0'), mention('John Smith', '9', 2), mention('J. Brown', '20'), mention('Jane Brown', '30')];
    const p = buildDemoPayload('d', { mentions: ms, relations: [], chunks, droppedUnanchored: 0 }, DEFAULTS);
    expect(p.schema).toBe(DEMO_SCHEMA);
    expect(p.thresholds).toEqual({ mergeAutoThreshold: 0.92, mergeGhostThreshold: 0.6, source: 'defaults' });
    const smith = p.entities.find((e) => e.label === 'John Smith');
    expect(smith).toMatchObject({ status: 'solid', opacity: 1, evidence: [{ page: 1, quote: 'John Smith spoke' }, { page: 2, quote: 'John Smith spoke' }] });
    const brown = p.entities.find((e) => e.members.includes('J. Brown'));
    expect(brown?.status).toBe('ghost');
    expect(brown?.confidence).toBeGreaterThanOrEqual(0.6);
    expect(brown?.confidence).toBeLessThan(0.92);
    expect(brown?.opacity).toBeGreaterThanOrEqual(0.25);
    expect(brown?.opacity).toBeLessThanOrEqual(0.75);
    expect(brown?.weakestLink?.score.name).toBe(0.88);
    expect(Object.keys(smith ?? {}).sort()).toEqual(['confidence', 'evidence', 'id', 'label', 'members', 'opacity', 'status', 'type']);
  });
});

describe('console demo on harbor-eval-minutes.pdf with the mock demo script', () => {
  it('every scripted quote is anchored and the merge yields solid and ghost entities', async () => {
    const doc = await openFixture('eval/harbor-eval-minutes.pdf');
    const pageTexts = await buildPageIndex(doc, 'doc', DEFAULTS);
    await doc.destroy();
    const chunkList = chunkPages(pageTexts, DEFAULTS.routeLocalMaxChunkChars);
    const model = fakeModel((prompt) => ({ text: demoExtractionText(prompt), source: 'on_device' }));
    const p = await runConsoleDemo({ docId: 'doc', pageTexts, chunkList }, {
      cfg: DEFAULTS, model, env: () => ({ localAvailability: 'available', online: false, localChunksUsed: 0 })
    });
    expect(p.droppedUnanchored).toBe(0);
    expect(p.entities.flatMap((e) => e.evidence)).toHaveLength(DEMO_SCRIPT.entities.length);
    expect(p.relations).toHaveLength(1);
    const marlow = p.entities.find((e) => e.members.includes('E. Marlow'));
    expect(marlow).toMatchObject({ status: 'ghost', type: 'person' });
    expect(marlow?.members.sort()).toEqual(['E. Marlow', 'Edith Marlow']);
    const hale = p.entities.find((e) => e.label === 'Dr. Oswin Hale');
    expect(hale).toMatchObject({ status: 'solid', confidence: 1 });
    expect(hale?.evidence.map((e) => e.page)).toEqual([1, 3]);
  });
});
