import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { PrivacyInvariantError, ModeViolationError } from '../../../src/ai/call';
import { decideRoute } from '../../../src/ai/router';
import type { Env } from '../../../src/ai/router';
import { validateExtraction } from '../../../src/ai/validators';
import { DEFAULTS } from '../../../src/config/defaults';
import { chunkPages } from '../../../src/pdf/chunker';
import { locateQuote } from '../../../src/pipeline/locateQuote';
import { runExtraction } from '../../../src/pipeline/runExtraction';
import type { ExtractionInput } from '../../../src/pipeline/runExtraction';
import type { PageText, Sensitivity } from '../../../src/types';
import { chunkOf, fakeModel } from '../../helpers/fakeModel';
import type { FakeStep } from '../../helpers/fakeModel';
import { numRuns } from '../../helpers/numRuns';

const TEXT = 'Marta Quill met with Edric Fenwick. Dr. Ilsa Moorcroft works for the Northgate Rope Company. Tobias  Wren wrote to Marta.';
const PAGES: PageText[] = [{ docId: 'p', page: 1, text: TEXT, itemOffsets: [0], status: 'ok' }];
const doc = (sensitivity: Sensitivity, maxChars = 60): ExtractionInput =>
  ({ docId: 'p', sensitivity, pages: PAGES, chunks: chunkPages(PAGES, maxChars) });
const ENV: Env = { localAvailability: 'available', online: true, localChunksUsed: 0 };

const sub = fc.tuple(fc.nat(TEXT.length), fc.nat(40)).map(([a, n]) => TEXT.slice(a, a + n));
const quote = fc.oneof(sub, sub.map((s) => s.toUpperCase()), fc.string({ maxLength: 12 }), fc.constant('Marta Quill'));
const name = fc.constantFrom('Marta Quill', 'Edric Fenwick', 'Mrs. Quill', 'Northgate Rope Company', 'Nobody');
const entity = fc.record({ name, type: fc.constantFrom('person', 'org'), quote, start: fc.integer(), end: fc.integer() });
const relation = fc.record({
  subject: name, object: name,
  label: fc.constantFrom('employed-by', 'member-of', 'family', 'business-partner', 'met-with', 'communicated-with'),
  quote, start: fc.integer(), end: fc.integer()
});
const output = fc.oneof(
  { weight: 4, arbitrary: fc.record({ entities: fc.array(entity, { maxLength: 4 }), relations: fc.array(relation, { maxLength: 3 }) }).map((o) => JSON.stringify(o)) },
  { weight: 1, arbitrary: fc.string({ maxLength: 20 }) },
  { weight: 1, arbitrary: fc.jsonValue().map((v) => JSON.stringify(v)) }
);
const step = fc.record({ text: output, source: fc.constantFrom('on_device', 'on_device', 'on_device', 'in_cloud', undefined) })
  .map(({ text, source }): FakeStep => (source === undefined ? { text } : { text, source }));

describe('runExtraction invariants', () => {
  it('(1)(2)(4) anchors equal page slices, accounting adds up, model offsets never used', async () => {
    await fc.assert(fc.asyncProperty(fc.array(step, { minLength: 1, maxLength: 8 }), fc.constantFrom<Sensitivity>('sensitive', 'public'), async (steps, sens) => {
      const model = fakeModel(steps);
      let r;
      try {
        r = await runExtraction(doc(sens), { cfg: DEFAULTS, model, env: () => ENV });
      } catch (e) {
        expect(e instanceof PrivacyInvariantError || e instanceof ModeViolationError).toBe(true);
        return;
      }
      for (const a of [...r.mentions.map((m) => m.anchor), ...r.relations.map((x) => x.anchor)]) {
        expect(a.quote).toBe(TEXT.slice(a.start, a.end));
      }
      // Recompute what each valid output should yield, from its chunk and without any offsets from the model.
      let produced = 0;
      let expectedAnchors: string[] = [];
      for (let i = 0; i < model.prompts.length; i++) {
        const s = steps[Math.min(i, steps.length - 1)];
        if (!s || !('text' in s) || s.source !== 'on_device') continue;
        const v = validateExtraction(s.text);
        if (!v.ok) continue;
        produced += v.value.entities.length + v.value.relations.length;
        const chunkText = chunkOf(model.prompts[i] ?? '');
        const chunkStart = TEXT.indexOf(chunkText);
        for (const e of v.value.entities) {
          const span = locateQuote(chunkText, chunkStart, e.quote);
          if (span) expectedAnchors.push(`${span.start}-${span.end}`);
        }
      }
      expect(r.droppedUnanchored + r.mentions.length + r.duplicateMentions + r.relations.length).toBe(produced);
      expectedAnchors = [...new Set(expectedAnchors)];
      for (const m of r.mentions) expect(expectedAnchors).toContain(`${m.anchor.start}-${m.anchor.end}`);
    }), { numRuns: numRuns(150) });
  });

  it('(3) a sensitive doc never yields a result from an in_cloud response', async () => {
    await fc.assert(fc.asyncProperty(fc.array(step, { minLength: 1, maxLength: 8 }), async (steps) => {
      const model = fakeModel(steps);
      const usedCloud = (): boolean => model.prompts.some((_p, i) => {
        const s = steps[Math.min(i, steps.length - 1)];
        return !!s && 'text' in s && s.source === 'in_cloud';
      });
      try {
        const r = await runExtraction(doc('sensitive'), { cfg: DEFAULTS, model, env: () => ENV });
        expect(usedCloud()).toBe(false);
        for (const m of r.mentions) expect(m.source.inferenceSource).toBe('on_device');
      } catch (e) {
        expect(e).toBeInstanceOf(PrivacyInvariantError);
        expect(usedCloud()).toBe(true);
      }
    }), { numRuns: numRuns(150) });
  });

  it('(4) extra numeric start/end fields never change anchors', async () => {
    await fc.assert(fc.asyncProperty(fc.array(entity, { minLength: 1, maxLength: 4 }), async (ents) => {
      const strip = JSON.stringify({ entities: ents.map(({ name: n, type, quote: q }) => ({ name: n, type, quote: q })), relations: [] });
      const withOffsets = JSON.stringify({ entities: ents, relations: [] });
      const run = (t: string) => runExtraction(doc('sensitive', 1000), { cfg: DEFAULTS, model: fakeModel([{ text: t, source: 'on_device' }]), env: () => ENV });
      const [a, b] = await Promise.all([run(strip), run(withOffsets)]);
      expect(b.mentions.map((m) => m.anchor)).toEqual(a.mentions.map((m) => m.anchor));
    }), { numRuns: numRuns(100) });
  });

  it('(5) the model is never called when decideRoute is not local', async () => {
    const envArb = fc.record({
      localAvailability: fc.constantFrom<Env['localAvailability']>('available', 'downloadable', 'downloading', 'unavailable', 'api-missing'),
      online: fc.boolean(), localChunksUsed: fc.nat(5)
    });
    await fc.assert(fc.asyncProperty(envArb, fc.constantFrom<Sensitivity>('sensitive', 'public'), fc.integer({ min: 10, max: 200 }), fc.boolean(), async (env, sens, maxLocal, cloudEnabled) => {
      const cfg = { ...DEFAULTS, routeLocalMaxChunkChars: maxLocal, cloudEnabled };
      const input = doc(sens, 80);
      const model = fakeModel([{ text: '{"entities":[],"relations":[]}', source: 'on_device' }]);
      const r = await runExtraction(input, { cfg, model, env: () => env });
      let local = 0;
      for (const c of input.chunks) {
        const d = decideRoute({ kind: 'extract', chunkChars: c.end - c.start }, { sensitivity: sens, pages: 1 }, { ...env, localChunksUsed: env.localChunksUsed + local }, cfg);
        if (d.route === 'local') local++;
      }
      expect(model.prompts.length).toBe(local);
      expect(r.chunks.local).toBe(local);
    }), { numRuns: numRuns(150) });
  });
});
