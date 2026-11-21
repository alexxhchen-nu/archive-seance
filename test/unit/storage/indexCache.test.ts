import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearAll, clearDocument, evictOldest, getIndex, listDocuments, putIndex
} from '../../../src/storage/indexCache';
import type { PutIndexInput } from '../../../src/storage/indexCache';
import { openSeanceDb } from '../../../src/storage/openDb';
import { DB_NAME, DB_VERSION, RECORD_VERSION } from '../../../src/storage/schema';
import type { Chunk, PageText } from '../../../src/types';

function input(docId: string, pageCount = 2, title = 'a.pdf'): PutIndexInput {
  const pages: PageText[] = Array.from({ length: pageCount }, (_, i) => ({
    docId, page: i + 1, text: `page ${i + 1} of ${docId}`, itemOffsets: [0], status: 'ok'
  }));
  const chunks: Chunk[] = pages.map((p) => ({ id: `${docId}:${p.page}:0`, docId, page: p.page, start: 0, end: p.text.length, text: p.text } as Chunk));
  return { meta: { docId, title, sourceName: title }, pages, chunks };
}

async function raw<T>(store: string, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<void> {
  const db = await openSeanceDb();
  const tx = db.transaction(store, 'readwrite');
  fn(tx.objectStore(store));
  await new Promise<void>((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
  db.close();
}

beforeEach(async () => {
  await clearAll();
});

describe('indexCache', () => {
  it('uses the seance database at the schema version', async () => {
    const db = await openSeanceDb();
    expect(db.name).toBe(DB_NAME);
    expect(db.version).toBe(DB_VERSION);
    expect([...db.objectStoreNames].sort()).toEqual(['chunks', 'documents', 'mentions', 'pages']);
    db.close();
  });

  it('round-trips pages and chunks', async () => {
    const i = input('d1', 3);
    await putIndex(i);
    const hit = await getIndex('d1');
    expect(hit?.pages).toEqual(i.pages);
    expect(hit?.chunks).toEqual(i.chunks);
    expect(hit?.meta).toMatchObject({ docId: 'd1', title: 'a.pdf', sourceName: 'a.pdf', pages: 3, chunkCount: 3, schemaVersion: RECORD_VERSION });
  });

  it('returns undefined on a miss', async () => {
    expect(await getIndex('nope')).toBeUndefined();
  });

  it('treats missing pages as a miss', async () => {
    await putIndex(input('d1', 3));
    await raw('pages', (s) => s.delete(['d1', 2]));
    expect(await getIndex('d1')).toBeUndefined();
  });

  it('treats a missing chunks record as a miss', async () => {
    await putIndex(input('d1'));
    await raw('chunks', (s) => s.delete('d1'));
    expect(await getIndex('d1')).toBeUndefined();
  });

  it.each([RECORD_VERSION - 1, RECORD_VERSION + 1])('treats schemaVersion %i as a miss', async (v) => {
    await putIndex(input('d1'));
    const meta = (await listDocuments())[0]!;
    await raw('documents', (s) => s.put({ ...meta, schemaVersion: v }));
    expect(await getIndex('d1')).toBeUndefined();
  });

  it('keeps documents isolated by docId', async () => {
    await putIndex(input('d1', 2));
    await putIndex(input('d2', 1, 'b.pdf'));
    expect((await getIndex('d1'))?.pages.every((p) => p.docId === 'd1')).toBe(true);
    expect((await getIndex('d2'))?.pages).toHaveLength(1);
    await clearDocument('d1');
    expect(await getIndex('d1')).toBeUndefined();
    expect(await getIndex('d2')).toBeDefined();
  });

  it('clearAll removes everything', async () => {
    await putIndex(input('d1'));
    await putIndex(input('d2'));
    await clearAll();
    expect(await listDocuments()).toEqual([]);
    expect(await getIndex('d1')).toBeUndefined();
  });

  it('keeps createdAt and updates updatedAt on re-put, replacing old pages', async () => {
    await putIndex(input('d1', 3), undefined, () => new Date('2026-01-01T00:00:00Z'));
    await putIndex(input('d1', 1), undefined, () => new Date('2026-02-01T00:00:00Z'));
    const hit = await getIndex('d1');
    expect(hit?.meta.createdAt).toBe('2026-01-01T00:00:00.000Z');
    expect(hit?.meta.updatedAt).toBe('2026-02-01T00:00:00.000Z');
    expect(hit?.pages).toHaveLength(1);
  });

  it('evictOldest keeps the newest N', async () => {
    for (const [id, m] of [['a', 1], ['b', 3], ['c', 2]] as const) {
      await putIndex(input(id), undefined, () => new Date(`2026-0${m}-01T00:00:00Z`));
    }
    expect(await evictOldest(5)).toEqual([]);
    expect(await evictOldest(1)).toEqual(['a', 'c']);
    expect((await listDocuments()).map((d) => d.docId)).toEqual(['b']);
    expect(await getIndex('a')).toBeUndefined();
  });

  it('a failed put writes nothing (single transaction)', async () => {
    const bad = input('d1', 2);
    // A page without a valid key makes the pages put throw inside the transaction.
    (bad.pages[1] as unknown as { page: unknown }).page = undefined;
    await expect(putIndex(bad)).rejects.toThrow();
    expect(await listDocuments()).toEqual([]);
    expect(await getIndex('d1')).toBeUndefined();
  });

  it('never touches chrome.storage', async () => {
    const get = vi.fn();
    vi.stubGlobal('chrome', { storage: { sync: { get, set: get }, local: { get, set: get } } });
    try {
      await putIndex(input('d1'));
      await getIndex('d1');
      await clearAll();
    } finally {
      vi.unstubAllGlobals();
    }
    expect(get).not.toHaveBeenCalled();
  });
});
