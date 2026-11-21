import { describe, expect, it, vi } from 'vitest';
import { loadAndIndex } from '../../../src/app/loadAndIndex';
import type { IndexCacheLike } from '../../../src/app/loadAndIndex';
import type { CachedIndex } from '../../../src/storage/indexCache';
import { PdfLoadError, loadPdfFromFile } from '../../../src/pdf/loadPdf';
import { openPdf } from '../../../src/pdf/openPdf';
import { DEFAULTS } from '../../../src/config/defaults';
import { expected, fixtureBytes, nodeDataUrls, pdfjsNode } from '../../helpers/fixtures';

const open = (b: Uint8Array) => openPdf(b, DEFAULTS, pdfjsNode, nodeDataUrls);

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

  describe('with a cache', () => {
    function memCache() {
      const store = new Map<string, CachedIndex>();
      const cache: IndexCacheLike & { putIndex: ReturnType<typeof vi.fn> } = {
        getIndex: async (id) => store.get(id),
        putIndex: vi.fn(async (i) => {
          store.set(i.meta.docId, {
            meta: { ...i.meta, pages: i.pages.length, chunkCount: i.chunks.length, schemaVersion: 1, createdAt: 'c', updatedAt: 'u' },
            pages: i.pages, chunks: i.chunks
          });
        })
      };
      return { store, cache };
    }
    const fileOf = (name: string, title = name) => new File([fixtureBytes(name) as Uint8Array<ArrayBuffer>], title);

    it('first load opens and writes, second load is served from cache without opening', async () => {
      const { cache } = memCache();
      const openSpy = vi.fn(open);
      const a = await loadAndIndex({ load: () => loadPdfFromFile(fileOf('mixed-scanned.pdf'), DEFAULTS), open: openSpy, cache }, DEFAULTS);
      expect(a.fromCache).toBe(false);
      expect(openSpy).toHaveBeenCalledTimes(1);
      expect(cache.putIndex).toHaveBeenCalledTimes(1);
      const b = await loadAndIndex({ load: () => loadPdfFromFile(fileOf('mixed-scanned.pdf', 'renamed.pdf'), DEFAULTS), open: openSpy, cache }, DEFAULTS);
      expect(openSpy).toHaveBeenCalledTimes(1);
      expect(cache.putIndex).toHaveBeenCalledTimes(1);
      expect(b).toMatchObject({ fromCache: true, title: 'renamed.pdf', docId: a.docId, pages: 3, chunks: a.chunks, noTextPages: [2] });
      expect(b.pageTexts).toEqual(a.pageTexts);
      expect(b.chunkList).toEqual(a.chunkList);
    });

    it('different files get different docIds; A, B, A hits only on the second A', async () => {
      const { store, cache } = memCache();
      const openSpy = vi.fn(open);
      const run = (n: string) => loadAndIndex({ load: () => loadPdfFromFile(fileOf(n), DEFAULTS), open: openSpy, cache }, DEFAULTS);
      const a1 = await run('mixed-scanned.pdf');
      const b = await run('harbor-lantern-minutes.pdf');
      const a2 = await run('mixed-scanned.pdf');
      expect(a1.docId).not.toBe(b.docId);
      expect([a1.fromCache, b.fromCache, a2.fromCache]).toEqual([false, false, true]);
      expect(openSpy).toHaveBeenCalledTimes(2);
      expect(store.get(b.docId)?.pages.every((p) => p.docId === b.docId)).toBe(true);
    });

    it('a load error does not write the cache', async () => {
      const { cache } = memCache();
      const e = await loadAndIndex({ load: () => loadPdfFromFile(new File(['plain'], 'n.txt'), DEFAULTS), open, cache }, DEFAULTS).catch((x: unknown) => x);
      expect(e).toBeInstanceOf(PdfLoadError);
      expect(cache.putIndex).not.toHaveBeenCalled();
    });

    it('an indexing error does not write the cache', async () => {
      const { cache } = memCache();
      const doc = { numPages: 1, getPage: async () => { throw new Error('boom'); }, destroy: async () => {} };
      const load = async () => ({ bytes: new Uint8Array(), docId: 'x', sizeBytes: 0, title: 't' });
      await expect(loadAndIndex({ load, open: async () => doc, cache }, DEFAULTS)).rejects.toThrow('boom');
      expect(cache.putIndex).not.toHaveBeenCalled();
    });

    it('a failing cache read falls back to indexing', async () => {
      const cache: IndexCacheLike = { getIndex: async () => { throw new Error('idb down'); }, putIndex: async () => {} };
      const s = await loadAndIndex({ load: () => loadPdfFromFile(fileOf('mixed-scanned.pdf'), DEFAULTS), open, cache }, DEFAULTS);
      expect(s.fromCache).toBe(false);
      expect(s.pages).toBe(3);
    });
  });
});
