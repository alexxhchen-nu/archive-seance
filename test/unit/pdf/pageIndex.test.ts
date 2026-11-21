import { describe, expect, it, vi } from 'vitest';
import { buildPageIndex, buildPageText, summarizePages } from '../../../src/pdf/pageIndex';
import type { PdfDocumentLike, TextItemLike } from '../../../src/pdf/PdfDocumentLike';
import { DEFAULTS } from '../../../src/config/defaults';
import { FIXTURES, expected, openFixture } from '../../helpers/fixtures';

const cfg = { minTextCharsPerPage: 1 };
const page = (items: TextItemLike[], c = cfg) => buildPageText('doc', 1, { items }, c);

function checkOffsets(text: string, offsets: number[], n: number): void {
  expect(offsets).toHaveLength(n);
  let prev = 0;
  for (const o of offsets) {
    expect(o).toBeGreaterThanOrEqual(prev);
    expect(o).toBeLessThanOrEqual(text.length);
    prev = o;
  }
}

describe('buildPageIndex on fixtures (pdf.js legacy build)', () => {
  it.each(FIXTURES)('%s: pages, status, offsets, normalization', async (name) => {
    const doc = await openFixture(name);
    try {
      const pages = await buildPageIndex(doc, 'd', DEFAULTS);
      expect(summarizePages(pages)).toEqual({ pages: expected[name].pages, noTextPages: expected[name].noTextPages });
      for (const [i, p] of pages.entries()) {
        expect(p.page).toBe(i + 1);
        expect(p.status).toBe((expected[name].noTextPages as number[]).includes(p.page) ? 'no-text' : 'ok');
        const items = (await (await doc.getPage(p.page)).getTextContent()).items;
        checkOffsets(p.text, p.itemOffsets, items.length);
        expect(p.text).not.toMatch(/\s\s|^\s|\s$/);
      }
    } finally {
      await doc.destroy();
    }
  });

  it('joins a phrase split across lines with one space and keeps the no-text page', async () => {
    const doc = await openFixture('harbor-lantern-minutes.pdf');
    const pages = await buildPageIndex(doc, 'd', DEFAULTS);
    await doc.destroy();
    expect(pages[0]!.text).toContain('which were approved without amendment');
    expect(pages[1]!.text).toContain('Northgate Rope Company about');

    const mixed = await openFixture('mixed-scanned.pdf');
    const m = await buildPageIndex(mixed, 'd', DEFAULTS);
    await mixed.destroy();
    expect(m).toHaveLength(3);
    expect(m[1]).toMatchObject({ page: 2, status: 'no-text', text: '' });
  });
});

describe('buildPageText', () => {
  it('expands ligatures and collapses NBSP, tabs and newlines', () => {
    const p = page([{ str: '\u00A0 \uFB01ne\to\uFB03ce\uFB02oor\n\n e\uFB03cient ' }]);
    expect(p.text).toBe('fine officefloor efficient');
    expect(p.itemOffsets).toEqual([0]);
  });

  it('records offsets for items without str and empty items', () => {
    const p = page([{ str: 'Alpha', hasEOL: true }, {}, { str: '' }, { str: '   ' }, { str: 'Beta' }, {}]);
    expect(p.text).toBe('Alpha Beta');
    expect(p.itemOffsets).toEqual([0, 5, 5, 5, 6, 10]);
  });

  it('joins on hasEOL and joins as-is without transforms', () => {
    expect(page([{ str: 'line', hasEOL: true }, { str: 'two' }]).text).toBe('line two');
    expect(page([{ str: 'Ha' }, { str: 'rbor' }]).text).toBe('Harbor');
  });

  it('inserts a space for large x or y gaps only', () => {
    const t = (x: number, y: number) => [10, 0, 0, 10, x, y];
    expect(page([{ str: 'Ha', transform: t(0, 0), width: 10, height: 10 }, { str: 'rbor', transform: t(10.5, 0), width: 20, height: 10 }]).text).toBe('Harbor');
    expect(page([{ str: 'Ha', transform: t(0, 0), width: 10, height: 10 }, { str: 'rbor', transform: t(14, 0), width: 20, height: 10 }]).text).toBe('Ha rbor');
    expect(page([{ str: 'end', transform: t(100, 100), width: 10, height: 10 }, { str: 'next', transform: t(0, 80), width: 20, height: 10 }]).text).toBe('end next');
  });

  it('flags no-text at the minTextCharsPerPage boundary', () => {
    const c = { minTextCharsPerPage: 40 };
    expect(page([{ str: 'x'.repeat(39) }], c).status).toBe('no-text');
    expect(page([{ str: 'x'.repeat(40) }], c).status).toBe('ok');
  });
});

describe('buildPageIndex', () => {
  it('keeps docId and 1-based pages and reports progress per page', async () => {
    const texts = ['first page text', '', 'third'];
    const doc: PdfDocumentLike = {
      numPages: 3,
      getPage: async (n) => ({ getTextContent: async () => ({ items: [{ str: texts[n - 1] }] }) })
    };
    const progress = vi.fn();
    const pages = await buildPageIndex(doc, 'abc', { minTextCharsPerPage: 1 }, progress);
    expect(pages.map((p) => [p.docId, p.page, p.status])).toEqual([['abc', 1, 'ok'], ['abc', 2, 'no-text'], ['abc', 3, 'ok']]);
    expect(progress.mock.calls).toEqual([[1, 3], [2, 3], [3, 3]]);
  });
});

describe('pdf.js data files (standard fonts, CMaps)', () => {
  it.each([
    ['times-roman-plain.pdf', 'The Harbor Lantern Society convened at dusk.'],
    ['cjk-unigb.pdf', '港湾灯笼 Harbor Lantern Society 港湾灯笼会议于黄昏召开。 会员们在东码头点亮了十二盏铜灯。']
  ])('%s: extracts the full phrase', async (name, phrase) => {
    const doc = await openFixture(name);
    try {
      const [p] = await buildPageIndex(doc, 'd', DEFAULTS);
      expect(p!.text).toContain(phrase);
      expect(p!.status).toBe('ok');
    } finally {
      await doc.destroy();
    }
  });

  it.each(['times-roman-plain.pdf', 'harbor-lantern-minutes.pdf'])('%s: no standardFontDataUrl warning when the data URLs are set', async (name) => {
    const logged: string[] = [];
    const spies = (['log', 'warn', 'error'] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation((...a: unknown[]) => { logged.push(a.map(String).join(' ')); })
    );
    try {
      const doc = await openFixture(name);
      try {
        await buildPageIndex(doc, 'd', DEFAULTS);
      } finally {
        await doc.destroy();
      }
    } finally {
      for (const s of spies) s.mockRestore();
    }
    expect(logged.join('\n')).not.toContain('standardFontDataUrl');
  });
});
