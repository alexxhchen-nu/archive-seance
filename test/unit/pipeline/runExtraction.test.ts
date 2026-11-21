import 'fake-indexeddb/auto';
import { beforeAll, describe, expect, it } from 'vitest';
import { ModeViolationError, PrivacyInvariantError } from '../../../src/ai/call';
import { buildExtractionPrompt, RETRY_INSTRUCTION } from '../../../src/ai/prompts';
import type { Env } from '../../../src/ai/router';
import { DEFAULTS } from '../../../src/config/defaults';
import { chunkPages } from '../../../src/pdf/chunker';
import { buildPageIndex } from '../../../src/pdf/pageIndex';
import { runExtraction } from '../../../src/pipeline/runExtraction';
import type { ExtractionDeps, ExtractionInput } from '../../../src/pipeline/runExtraction';
import { getMentions, putMentions } from '../../../src/storage/mentionStore';
import type { Chunk, Mention, PageText, Sensitivity } from '../../../src/types';
import { chunkOf, fakeModel } from '../../helpers/fakeModel';
import type { FakeScript, FakeStep } from '../../helpers/fakeModel';
import { openFixture } from '../../helpers/fixtures';

const ENV: Env = { localAvailability: 'available', online: true, localChunksUsed: 0 };
const json = (entities: unknown[], relations: unknown[] = []): string => JSON.stringify({ entities, relations });
const ok = (text: string): FakeStep => ({ text, source: 'on_device' });

let harbor: { pages: PageText[]; chunks: Chunk[] };
beforeAll(async () => {
  const doc = await openFixture('harbor-lantern-minutes.pdf');
  const pages = await buildPageIndex(doc, 'harbor', DEFAULTS);
  await doc.destroy();
  harbor = { pages, chunks: chunkPages(pages, DEFAULTS.routeLocalMaxChunkChars) };
});

function input(sensitivity: Sensitivity = 'sensitive', over: Partial<ExtractionInput> = {}): ExtractionInput {
  return { docId: 'harbor', sensitivity, pages: harbor.pages, chunks: harbor.chunks, ...over };
}

function deps(script: FakeScript, over: Partial<ExtractionDeps> = {}) {
  const model = fakeModel(script);
  let n = 0;
  const d: ExtractionDeps = {
    cfg: DEFAULTS, model, env: () => ENV,
    newId: () => `log-${n++}`, now: () => new Date('2026-11-21T00:00:00Z'), ...over
  };
  return { d, model };
}

/** Synthetic single-page doc. */
function tiny(texts: string[], docId = 'tiny'): ExtractionInput {
  const pages: PageText[] = texts.map((text, i) => ({ docId, page: i + 1, text, itemOffsets: [0], status: 'ok' }));
  return { docId, sensitivity: 'sensitive', pages, chunks: chunkPages(pages, DEFAULTS.routeLocalMaxChunkChars) };
}

describe('runExtraction (local route)', () => {
  it('happy path on harbor-lantern-minutes: anchors equal page text slices', async () => {
    const { d, model } = deps((prompt) => {
      const c = chunkOf(prompt);
      const ents = [];
      if (c.includes('Marta Quill')) ents.push({ name: 'Marta Quill', type: 'person', quote: 'Marta Quill' });
      if (c.includes('Northgate Rope Company')) ents.push({ name: 'Northgate Rope Company', type: 'org', quote: 'the Northgate Rope Company' });
      if (c.includes('Tobias Wren')) ents.push({ name: 'Tobias Wren', type: 'person', quote: 'Mr. Tobias Wren offered to print notices' });
      return ok(json(ents));
    });
    const r = await runExtraction(input(), d);
    expect(model.prompts).toHaveLength(harbor.chunks.length);
    expect(r.chunks).toEqual({ total: harbor.chunks.length, local: harbor.chunks.length, pendingCloud: 0, failed: 0 });
    expect(r.aborted).toBe(false);
    const surfaces = r.mentions.map((m) => `${m.anchor.page}:${m.surface}`);
    expect(surfaces).toEqual(['1:Marta Quill', '1:Northgate Rope Company', '2:Marta Quill', '2:Northgate Rope Company', '3:Tobias Wren']);
    for (const m of r.mentions) {
      const text = harbor.pages[m.anchor.page - 1]?.text ?? '';
      expect(m.anchor.quote).toBe(text.slice(m.anchor.start, m.anchor.end));
      expect(m.source).toEqual({ route: 'local', inferenceSource: 'on_device', ocr: false });
      expect(m.sentenceId.startsWith(`harbor:${m.anchor.page}:`)).toBe(true);
      const ss = Number(m.sentenceId.split(':')[2]);
      expect(ss).toBeLessThanOrEqual(m.anchor.start);
    }
    const p1 = harbor.pages[0]?.text ?? '';
    expect(r.mentions[0]?.anchor.start).toBe(p1.indexOf('Marta Quill'));
    // The heading has no full stop, so Intl.Segmenter keeps it in the first sentence.
    expect(r.mentions[0]?.sentenceId).toBe('harbor:1:0');
    const tobias = r.mentions.find((m) => m.surface === 'Tobias Wren');
    const p3 = harbor.pages[2]?.text ?? '';
    expect(tobias?.sentenceId).toBe(`harbor:3:${p3.indexOf('Mr. Tobias Wren')}`);
    expect(r.log).toHaveLength(harbor.chunks.length);
    expect(r.log[0]).toMatchObject({ kind: 'extract', requestedRoute: 'local', inferenceSource: 'on_device' });
    expect(r.log[0]?.payloadSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(r.log)).not.toContain('Marta');
  });

  it('mention ids are deterministic and duplicates are removed', async () => {
    const out = ok(json([
      { name: 'Marta Quill', type: 'person', quote: 'Marta Quill' },
      { name: 'marta quill', type: 'person', quote: 'Marta Quill' }
    ]));
    const a = await runExtraction(tiny(['Marta Quill spoke.']), deps([out]).d);
    const b = await runExtraction(tiny(['Marta Quill spoke.']), deps([out]).d);
    expect(a.mentions).toHaveLength(1);
    expect(a.duplicateMentions).toBe(1);
    expect(a.mentions[0]?.id).toBe(b.mentions[0]?.id);
  });

  it('drops quotes not found and locates whitespace/case variants', async () => {
    const { d } = deps([ok(json([
      { name: 'Edith Marlow', type: 'person', quote: 'Edith Marlow chaired' },
      { name: 'Marta Quill', type: 'person', quote: 'called  by\nMARTA quill' }
    ]))]);
    const r = await runExtraction(tiny(['The meeting was called by Marta Quill.']), d);
    expect(r.droppedUnanchored).toBe(1);
    expect(r.mentions.map((m) => m.anchor.quote)).toEqual(['called by Marta Quill']);
  });

  it('invalid JSON -> retry once with the retry prompt -> success, two log entries', async () => {
    const { d, model } = deps([ok('not json'), ok(json([{ name: 'Marta Quill', type: 'person', quote: 'Marta Quill' }]))]);
    const r = await runExtraction(tiny(['Marta Quill spoke.']), d);
    expect(model.prompts).toHaveLength(2);
    expect(model.prompts[1]?.endsWith(RETRY_INSTRUCTION)).toBe(true);
    expect(r.log).toHaveLength(2);
    expect(r.log[0]?.error).toMatch(/JSON/);
    expect(r.log[1]?.error).toBeUndefined();
    expect(r.mentions).toHaveLength(1);
    expect(r.chunks.local).toBe(1);
  });

  it('schema-invalid twice on a sensitive doc -> chunk failed, run continues', async () => {
    const { d, model } = deps((_p, n) => (n < 2 ? ok('{"entities":[{"name":1}]}') : ok(json([{ name: 'Tobias Wren', type: 'person', quote: 'Tobias Wren' }]))));
    const doc = tiny(['Marta Quill spoke.', 'Tobias Wren printed notices.']);
    const r = await runExtraction(doc, d);
    expect(model.prompts).toHaveLength(3);
    expect(r.chunks).toEqual({ total: 2, local: 1, pendingCloud: 0, failed: 1 });
    expect(r.failures[0]?.chunkId).toBe('tiny:1:0');
    expect(r.mentions.map((m) => m.surface)).toEqual(['Tobias Wren']);
  });

  it('twice failing on a public doc -> pending-cloud', async () => {
    const { d } = deps([{ error: new Error('boom') }]);
    const r = await runExtraction({ ...tiny(['Marta Quill spoke.']), sensitivity: 'public' }, d);
    expect(r.chunks.pendingCloud).toBe(1);
    expect(r.pendingCloudChunkIds).toEqual(['tiny:1:0']);
    expect(r.log.map((l) => l.inferenceSource)).toEqual(['failed', 'failed']);
  });

  it('times out a never-resolving model, retries once, then fails the chunk', async () => {
    const { d, model } = deps([{ hang: true }], { cfg: { ...DEFAULTS, localCallTimeoutMs: 5 } });
    const r = await runExtraction(tiny(['Marta Quill spoke.']), d);
    expect(model.prompts).toHaveLength(2);
    expect(r.chunks.failed).toBe(1);
    expect(r.log[0]?.error).toMatch(/timed out/);
  });

  it('sensitive doc with an in_cloud response -> PrivacyInvariantError, no retry, nothing stored', async () => {
    const stored: Mention[][] = [];
    const logs: string[] = [];
    const { d, model } = deps((_p, n) => (n === 0 ? ok(json([{ name: 'Marta Quill', type: 'person', quote: 'Marta Quill' }])) : { text: json([]), source: 'in_cloud' }), {
      store: { putMentions: async (_id, ms) => { stored.push(ms); } },
      onLog: (e) => logs.push(e.inferenceSource)
    });
    await expect(runExtraction(tiny(['Marta Quill spoke.', 'Tobias Wren printed.']), d)).rejects.toBeInstanceOf(PrivacyInvariantError);
    expect(model.prompts).toHaveLength(2);
    expect(stored).toEqual([]);
    expect(logs).toEqual(['on_device', 'failed']);
  });

  it('public doc with an in_cloud response on the local route -> ModeViolationError', async () => {
    const { d, model } = deps([{ text: json([]), source: 'in_cloud' }]);
    await expect(runExtraction({ ...tiny(['Marta Quill spoke.']), sensitivity: 'public' }, d)).rejects.toBeInstanceOf(ModeViolationError);
    expect(model.prompts).toHaveLength(1);
  });

  it('public doc, chunk too large for device -> pending-cloud, model never called', async () => {
    const { d, model } = deps([ok(json([]))], { cfg: { ...DEFAULTS, routeLocalMaxChunkChars: 5 } });
    const r = await runExtraction({ ...tiny(['Marta Quill spoke.']), sensitivity: 'public' }, d);
    expect(model.prompts).toHaveLength(0);
    expect(r.chunks.pendingCloud).toBe(1);
  });

  it('sensitive doc with a downloadable model -> blocked/failed, model never called', async () => {
    const { d, model } = deps([ok(json([]))], { env: () => ({ ...ENV, localAvailability: 'downloadable' }) });
    const r = await runExtraction(tiny(['Marta Quill spoke.']), d);
    expect(model.prompts).toHaveLength(0);
    expect(r.chunks.failed).toBe(1);
    expect(r.failures[0]?.reason).toMatch(/downloadable/);
  });

  it('local budget on a >30-page public doc: later chunks become pending-cloud', async () => {
    const texts = Array.from({ length: 35 }, (_, i) => `Page ${i + 1} mentions Marta Quill.`);
    const { d, model } = deps([ok(json([]))], { cfg: { ...DEFAULTS, routeLocalChunkBudget: 10 } });
    const r = await runExtraction({ ...tiny(texts), sensitivity: 'public' }, d);
    expect(model.prompts).toHaveLength(10);
    expect(r.chunks).toEqual({ total: 35, local: 10, pendingCloud: 25, failed: 0 });
  });

  it('env changes mid-run are honoured', async () => {
    let avail: Env['localAvailability'] = 'available';
    const { d } = deps(() => { avail = 'unavailable'; return ok(json([])); }, { env: () => ({ ...ENV, localAvailability: avail }) });
    const r = await runExtraction(tiny(['A one.', 'B two.']), d);
    expect(r.chunks).toMatchObject({ local: 1, failed: 1 });
  });

  it('abort stops before the next chunk and stores what was done', async () => {
    const ac = new AbortController();
    const stored: Mention[][] = [];
    const { d, model } = deps(() => { ac.abort(); return ok(json([{ name: 'Marta Quill', type: 'person', quote: 'Marta Quill' }])); }, {
      signal: ac.signal, store: { putMentions: async (_id, ms) => { stored.push(ms); } }
    });
    const r = await runExtraction(tiny(['Marta Quill spoke.', 'Marta Quill again.']), d);
    expect(model.prompts).toHaveLength(1);
    expect(r.aborted).toBe(true);
    expect(stored).toEqual([r.mentions]);
    expect(r.mentions).toHaveLength(1);
  });

  it('persists mentions through the real mentionStore', async () => {
    const { d } = deps([ok(json([{ name: 'Marta Quill', type: 'person', quote: 'Marta Quill' }]))], {
      store: { putMentions: (id, ms) => putMentions(id, ms) }
    });
    const r = await runExtraction(tiny(['Marta Quill spoke.'], 'persist'), d);
    expect(await getMentions('persist')).toEqual(r.mentions);
  });

  it('keeps relations between returned entities and drops unknown endpoints or unanchored quotes', async () => {
    const text = 'Edric Fenwick met with Marta Quill at the hall.';
    const { d } = deps([ok(json(
      [{ name: 'Edric Fenwick', type: 'person', quote: 'Edric Fenwick' }, { name: 'Marta Quill', type: 'person', quote: 'Marta Quill' }],
      [
        { subject: 'Mr. Edric Fenwick', object: 'Marta Quill', label: 'met-with', quote: 'Edric Fenwick met with Marta Quill' },
        { subject: 'Ilsa Moorcroft', object: 'Marta Quill', label: 'met-with', quote: 'Edric Fenwick met with Marta Quill' },
        { subject: 'Edric Fenwick', object: 'Marta Quill', label: 'family', quote: 'their wedding' }
      ]
    ))]);
    const r = await runExtraction(tiny([text]), d);
    expect(r.droppedUnanchored).toBe(2);
    expect(r.relations).toEqual([{
      subject: 'Mr. Edric Fenwick', object: 'Marta Quill', label: 'met-with',
      anchor: { docId: 'tiny', page: 1, start: 0, end: 34, quote: 'Edric Fenwick met with Marta Quill' },
      sentenceId: 'tiny:1:0', inferenceSource: 'on_device'
    }]);
  });

  it('the first prompt is the design 5.5 prompt of the chunk text', async () => {
    const { d, model } = deps([ok(json([]))]);
    await runExtraction(tiny(['Marta Quill spoke.']), d);
    expect(model.prompts[0]).toBe(buildExtractionPrompt('Marta Quill spoke.'));
  });
});
