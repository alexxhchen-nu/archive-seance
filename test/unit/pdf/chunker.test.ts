import { describe, expect, it } from 'vitest';
import { chunkPage, chunkPages } from '../../../src/pdf/chunker';
import { buildPageIndex } from '../../../src/pdf/pageIndex';
import { DEFAULTS } from '../../../src/config/defaults';
import type { Chunk, PageText } from '../../../src/types';
import { FIXTURES, expected, openFixture } from '../../helpers/fixtures';

const pt = (text: string, page = 1, status: PageText['status'] = 'ok'): PageText =>
  ({ docId: 'doc', page, text, itemOffsets: [0], status });
const texts = (p: PageText, cs: Chunk[]) => cs.map((c) => p.text.slice(c.start, c.end));

function invariants(p: PageText, cs: Chunk[], max: number): void {
  let prev = 0;
  const covered = new Set<number>();
  for (const c of cs) {
    expect(c.end - c.start).toBeGreaterThanOrEqual(1);
    expect(c.end - c.start).toBeLessThanOrEqual(max);
    expect(c.start).toBeGreaterThanOrEqual(prev);
    expect(c.id).toBe(`${p.docId}:${p.page}:${c.start}`);
    const s = p.text.slice(c.start, c.end);
    expect(s).toBe(s.trim());
    for (let i = c.start; i < c.end; i++) covered.add(i);
    prev = c.end;
  }
  for (let i = 0; i < p.text.length; i++) {
    if (!/\s/.test(p.text[i]!)) expect(covered.has(i)).toBe(true);
  }
}

describe('chunkPage', () => {
  it('packs whole sentences when they fit', () => {
    const p = pt('One two. Three four. Five six.');
    expect(texts(p, chunkPage(p, 20))).toEqual(['One two. Three four.', 'Five six.']);
    expect(texts(p, chunkPage(p, 1000))).toEqual(['One two. Three four. Five six.']);
  });

  it('keeps invariants around abbreviations whatever the segmenter does', () => {
    const p = pt('Mr. Fenwick met Dr. Moorcroft at 7 p.m. on the pier. They spoke. Then left.');
    for (const max of [5, 12, 30, 80]) invariants(p, chunkPage(p, max), max);
  });

  it('hard-splits a long sentence at whitespace', () => {
    const p = pt('alpha beta gamma delta epsilon');
    expect(texts(p, chunkPage(p, 11))).toEqual(['alpha beta', 'gamma delta', 'epsilon']);
  });

  it('hard-splits a long sentence without spaces exactly at the limit', () => {
    const p = pt('abcdefghij');
    expect(texts(p, chunkPage(p, 4))).toEqual(['abcd', 'efgh', 'ij']);
  });

  it('never splits a surrogate pair at the limit', () => {
    const p = pt('abc\u{1F56F}def');
    const cs = chunkPage(p, 4);
    expect(texts(p, cs)).toEqual(['abc', '\u{1F56F}de', 'f']);
    invariants(p, cs, 4);
  });

  it('gives no chunks for no-text pages or whitespace', () => {
    expect(chunkPage(pt('Some text here.', 1, 'no-text'), 100)).toEqual([]);
    expect(chunkPage(pt(''), 100)).toEqual([]);
    expect(chunkPage(pt('   '), 100)).toEqual([]);
  });

  it.each([0, -1, 1.5, NaN, Infinity])('throws RangeError for maxChars %s', (m) => {
    expect(() => chunkPage(pt('x'), m)).toThrow(RangeError);
    expect(() => chunkPages([], m)).toThrow(RangeError);
  });
});

describe('chunkPages', () => {
  it('never crosses pages', () => {
    const pages = [pt('Short one.', 1), pt('x', 2, 'no-text'), pt('Short two.', 3)];
    const cs = chunkPages(pages, 1000);
    expect(cs.map((c) => [c.page, c.start, c.end])).toEqual([[1, 0, 10], [3, 0, 10]]);
  });

  it.each(FIXTURES)('%s: chunk counts match fixtures.expected.json', async (name) => {
    const doc = await openFixture(name);
    const pages = await buildPageIndex(doc, 'd', DEFAULTS);
    await doc.destroy();
    const def = chunkPages(pages, DEFAULTS.routeLocalMaxChunkChars);
    expect(def).toHaveLength(expected[name].chunkCountAtDefaultMax);
    expect(chunkPages(pages, 400)).toHaveLength(expected[name].chunkCountAtMax400);
    for (const p of pages) invariants(p, chunkPage(p, 400), 400);
  });
});
