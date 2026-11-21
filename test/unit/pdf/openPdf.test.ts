import { describe, expect, it } from 'vitest';
import { openPdf } from '../../../src/pdf/openPdf';
import { PdfLoadError } from '../../../src/pdf/loadPdf';
import { DEFAULTS } from '../../../src/config/defaults';
import { fixtureBytes, openFixture, pdfjsNode } from '../../helpers/fixtures';

describe('openPdf', () => {
  it('opens a fixture with the right page count and leaves the input bytes intact', async () => {
    const bytes = fixtureBytes('harbor-lantern-minutes.pdf');
    const doc = await openPdf(bytes, DEFAULTS, pdfjsNode);
    expect(doc.numPages).toBe(3);
    expect(bytes.byteLength).toBeGreaterThan(0);
    await doc.destroy();
  });

  it('maps corrupt input to parse-failed', async () => {
    const e = await openPdf(new TextEncoder().encode('%PDF-1.4\ngarbage'), DEFAULTS, pdfjsNode).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(PdfLoadError);
    expect((e as PdfLoadError).code).toBe('parse-failed');
  });

  it('rejects too many pages before any text is read', async () => {
    const e = await openFixture('mixed-scanned.pdf', { ...DEFAULTS, maxPdfPages: 2 }).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(PdfLoadError);
    expect((e as PdfLoadError).code).toBe('too-many-pages');
    expect((e as PdfLoadError).message).toBe('PDF has 3 pages; the limit is 2');
  });
});
