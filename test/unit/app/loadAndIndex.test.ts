import { describe, expect, it, vi } from 'vitest';
import { loadAndIndex } from '../../../src/app/loadAndIndex';
import { PdfLoadError, loadPdfFromFile } from '../../../src/pdf/loadPdf';
import { openPdf } from '../../../src/pdf/openPdf';
import { DEFAULTS } from '../../../src/config/defaults';
import { expected, fixtureBytes, pdfjsNode } from '../../helpers/fixtures';

const open = (b: Uint8Array) => openPdf(b, DEFAULTS, pdfjsNode);

describe('loadAndIndex', () => {
  it('indexes a fixture end to end and reports progress', async () => {
    const file = new File([fixtureBytes('mixed-scanned.pdf') as Uint8Array<ArrayBuffer>], 'mixed-scanned.pdf');
    const onStatus = vi.fn();
    const s = await loadAndIndex({ load: () => loadPdfFromFile(file, DEFAULTS), open, onStatus }, DEFAULTS);
    expect(s).toMatchObject({
      title: 'mixed-scanned.pdf',
      pages: 3,
      chunks: expected['mixed-scanned.pdf'].chunkCountAtDefaultMax,
      noTextPages: [2]
    });
    expect(s.docId).toMatch(/^[0-9a-f]{64}$/);
    expect(s.chunkList.every((c) => c.docId === s.docId)).toBe(true);
    expect(onStatus).toHaveBeenCalledWith('Indexing page 3 of 3…');
  });

  it('propagates PdfLoadError and never opens the document', async () => {
    const openSpy = vi.fn(open);
    const file = new File(['plain text'], 'notes.txt');
    const e = await loadAndIndex({ load: () => loadPdfFromFile(file, DEFAULTS), open: openSpy }, DEFAULTS).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(PdfLoadError);
    expect((e as PdfLoadError).code).toBe('not-pdf');
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('destroys the document even when indexing fails', async () => {
    const destroy = vi.fn(async () => {});
    const doc = { numPages: 1, getPage: async () => { throw new Error('boom'); }, destroy };
    const load = async () => ({ bytes: new Uint8Array(), docId: 'x', sizeBytes: 0, title: 't' });
    await expect(loadAndIndex({ load, open: async () => doc }, DEFAULTS)).rejects.toThrow('boom');
    expect(destroy).toHaveBeenCalledTimes(1);
  });
});
