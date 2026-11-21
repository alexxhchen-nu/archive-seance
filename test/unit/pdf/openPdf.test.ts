import { describe, expect, it } from 'vitest';
import { openPdf } from '../../../src/pdf/openPdf';
import type { PdfjsLike } from '../../../src/pdf/openPdf';
import { pdfjsDataUrls } from '../../../src/pdf/pdfjsDataUrls';
import { PdfLoadError } from '../../../src/pdf/loadPdf';
import { DEFAULTS } from '../../../src/config/defaults';
import { fixtureBytes, nodeDataUrls, openFixture, pdfjsNode } from '../../helpers/fixtures';

describe('openPdf', () => {
  it('opens a fixture with the right page count and leaves the input bytes intact', async () => {
    const bytes = fixtureBytes('harbor-lantern-minutes.pdf');
    const doc = await openPdf(bytes, DEFAULTS, pdfjsNode, nodeDataUrls);
    expect(doc.numPages).toBe(3);
    expect(bytes.byteLength).toBeGreaterThan(0);
    await doc.destroy();
  });

  it('maps corrupt input to parse-failed', async () => {
    const e = await openPdf(new TextEncoder().encode('%PDF-1.4\ngarbage'), DEFAULTS, pdfjsNode, nodeDataUrls).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(PdfLoadError);
    expect((e as PdfLoadError).code).toBe('parse-failed');
  });

  it('rejects too many pages before any text is read', async () => {
    const e = await openFixture('mixed-scanned.pdf', { ...DEFAULTS, maxPdfPages: 2 }).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(PdfLoadError);
    expect((e as PdfLoadError).code).toBe('too-many-pages');
    expect((e as PdfLoadError).message).toBe('PDF has 3 pages; the limit is 2');
  });

  it('passes isEvalSupported:false and the pdf.js data URLs (trailing slashes) to getDocument', async () => {
    let seen: Record<string, unknown> = {};
    const fake: PdfjsLike = {
      getDocument: (src) => { seen = { ...src }; return { promise: Promise.resolve({ numPages: 1, getPage: async () => { throw new Error('x'); } }), destroy: async () => {} }; }
    };
    const urls = pdfjsDataUrls((p) => `chrome-extension://abc/${p}`);
    await openPdf(new Uint8Array([1]), DEFAULTS, fake, urls);
    expect(seen).toMatchObject({
      isEvalSupported: false, cMapPacked: true,
      standardFontDataUrl: 'chrome-extension://abc/pdfjs/standard_fonts/',
      cMapUrl: 'chrome-extension://abc/pdfjs/cmaps/',
      wasmUrl: 'chrome-extension://abc/pdfjs/wasm/'
    });
    for (const u of Object.values(nodeDataUrls)) expect(u.endsWith('/')).toBe(true);
  });
});
