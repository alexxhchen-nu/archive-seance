import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { DEFAULTS } from '../../../src/config/defaults';
import { resolveGold, scoreEntities, scoreRelations } from '../../../src/eval/score';
import type { GoldSet } from '../../../src/eval/score';
import { chunkPages } from '../../../src/pdf/chunker';
import { buildPageIndex } from '../../../src/pdf/pageIndex';
import { locateQuote } from '../../../src/pipeline/locateQuote';
import { nameInQuote } from '../../../src/pipeline/nameInQuote';
import { runExtraction } from '../../../src/pipeline/runExtraction';
import type { PageText } from '../../../src/types';
import { chunkOf, fakeModel } from '../../helpers/fakeModel';
import { openFixture } from '../../helpers/fixtures';

interface GoldFile extends GoldSet {
  fixtureId: string;
  pdf: string;
  textSource: string;
  license: string;
  labeling: string;
  notEntities: string[];
}

const gold = JSON.parse(readFileSync('test/fixtures/eval/gold.json', 'utf8')) as GoldFile;
const LABELS = new Set(['employed-by', 'member-of', 'family', 'business-partner', 'met-with', 'communicated-with']);

let pages: PageText[];
beforeAll(async () => {
  const doc = await openFixture(`eval/${gold.pdf}`);
  pages = await buildPageIndex(doc, gold.fixtureId, DEFAULTS);
  await doc.destroy();
});

const pageText = (n: number): string => pages[n - 1]?.text ?? '';
function isVerbatim(page: number, quote: string): boolean {
  const t = pageText(page);
  const r = locateQuote(t, 0, quote);
  return r !== null && t.slice(r.start, r.end) === quote;
}

describe('eval gold fixture', () => {
  it('has provenance metadata and 4 text pages', () => {
    expect(gold).toMatchObject({ fixtureId: 'harbor-eval-minutes', textSource: 'synthetic', license: 'CC0-1.0' });
    expect(gold.labeling).toMatch(/AI assistant/);
    expect(pages).toHaveLength(4);
    expect(pages.every((p) => p.status === 'ok')).toBe(true);
  });

  it('every gold mention and relation quote is a verbatim span of its page text', () => {
    for (const e of gold.entities) for (const m of e.mentions) expect(isVerbatim(m.page, m.quote), `${e.id}: ${m.quote}`).toBe(true);
    for (const r of gold.relations) expect(isVerbatim(r.page, r.quote), r.quote).toBe(true);
  });

  it('ids are unique, every entity has a mention, relation endpoints exist, labels are closed', () => {
    const ids = gold.entities.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const e of gold.entities) expect(e.mentions.length).toBeGreaterThan(0);
    for (const r of gold.relations) {
      expect(ids).toContain(r.subject);
      expect(ids).toContain(r.object);
      expect(LABELS.has(r.label)).toBe(true);
    }
    expect(gold.entities.length).toBeGreaterThanOrEqual(20);
    expect(gold.relations.length).toBeGreaterThanOrEqual(12);
  });

  it('notEntities never match an entity name or alias, and appear in the text', () => {
    for (const s of gold.notEntities) {
      expect(resolveGold(gold, s)).toEqual([]);
      expect(pages.some((p) => p.text.includes(s))).toBe(true);
    }
  });

  it('R3.4a: every gold mention quote contains the canonical name or an alias (whitespace/case-normalized)', () => {
    for (const e of gold.entities) {
      const names = [e.name, ...e.aliases];
      for (const m of e.mentions) {
        expect(names.some((n) => nameInQuote(n, m.quote)), `${e.id} / ${e.name} in "${m.quote}"`).toBe(true);
      }
    }
  });

  // Validates the HARNESS (fixture + pipeline + scorer), NOT model accuracy: the "model" returns the gold labels.
  it('harness check: gold fed as scripted model output scores precision = recall = 1', async () => {
    const pageOfChunk = (chunkText: string): number => pages.findIndex((p) => p.text.includes(chunkText)) + 1;
    const surfaceInQuote = (e: GoldFile['entities'][number], quote: string): string =>
      [e.name, ...e.aliases].find((n) => nameInQuote(n, quote)) ?? e.name;
    const model = fakeModel((prompt) => {
      const chunkText = chunkOf(prompt);
      const page = pageOfChunk(chunkText);
      const inChunk = (p: number, q: string): boolean => p === page && chunkText.includes(q);
      const entities = gold.entities.flatMap((e) => e.mentions.filter((m) => inChunk(m.page, m.quote)).map((m) => ({ id: e.id, name: surfaceInQuote(e, m.quote), type: e.type, quote: m.quote })));
      const surfaceOf = (id: string): string => entities.find((n) => n.id === id)?.name ?? gold.entities.find((e) => e.id === id)?.name ?? id;
      const relations = gold.relations.filter((r) => inChunk(r.page, r.quote))
        .map((r) => ({ subject: surfaceOf(r.subject), object: surfaceOf(r.object), label: r.label, quote: r.quote }));
      const payload = { entities: entities.map(({ name, type, quote }) => ({ name, type, quote })), relations };
      return { text: JSON.stringify(payload), source: 'on_device' };
    });
    const res = await runExtraction(
      { docId: gold.fixtureId, sensitivity: 'sensitive', pages, chunks: chunkPages(pages, DEFAULTS.routeLocalMaxChunkChars) },
      { cfg: DEFAULTS, model, env: () => ({ localAvailability: 'available', online: false, localChunksUsed: 0 }) }
    );
    expect(res.droppedUnanchored).toBe(0);
    expect(res.mentions).toHaveLength(gold.entities.reduce((n, e) => n + e.mentions.length, 0));
    const es = scoreEntities(gold, res.mentions);
    expect([es.precision, es.recall, es.fp, es.fn]).toEqual([1, 1, 0, 0]);
    const rs = scoreRelations(gold, res.relations);
    expect([rs.precision, rs.recall, rs.fp, rs.fn]).toEqual([1, 1, 0, 0]);
  });
});
