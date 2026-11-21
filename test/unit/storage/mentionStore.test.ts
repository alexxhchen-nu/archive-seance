import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { clearAll, clearDocument, getIndex } from '../../../src/storage/indexCache';
import { clearMentions, getMentions, putMentions } from '../../../src/storage/mentionStore';
import { openSeanceDb } from '../../../src/storage/openDb';
import { DB_NAME, DB_VERSION, RECORD_VERSION } from '../../../src/storage/schema';
import type { Mention } from '../../../src/types';
import { putIndex } from '../../../src/storage/indexCache';

function mention(docId: string, page: number, start: number, surface = 'Marta Quill'): Mention {
  return {
    id: `${docId}-${page}-${start}`,
    surface,
    type: 'person',
    anchor: { docId, page, start, end: start + surface.length, quote: surface },
    sentenceId: `${docId}:${page}:0`,
    source: { route: 'local', inferenceSource: 'on_device', ocr: false }
  };
}

function reqP<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
}

function deleteDb(): Promise<void> {
  return new Promise((res, rej) => {
    const r = indexedDB.deleteDatabase(DB_NAME);
    r.onsuccess = () => res();
    r.onerror = () => rej(r.error);
  });
}

describe('mentionStore', () => {
  beforeEach(async () => {
    await clearAll();
  });

  it('round-trips mentions sorted by page then start', async () => {
    const ms = [mention('d1', 2, 5), mention('d1', 1, 40), mention('d1', 1, 3)];
    await putMentions('d1', ms);
    expect(await getMentions('d1')).toEqual([ms[2], ms[1], ms[0]]);
  });

  it('replaces all mentions of the doc and leaves other docs untouched', async () => {
    await putMentions('d1', [mention('d1', 1, 0), mention('d1', 1, 10)]);
    await putMentions('d2', [mention('d2', 1, 0)]);
    await putMentions('d1', [mention('d1', 3, 7)]);
    expect(await getMentions('d1')).toEqual([mention('d1', 3, 7)]);
    expect(await getMentions('d2')).toEqual([mention('d2', 1, 0)]);
    await putMentions('d1', []);
    expect(await getMentions('d1')).toEqual([]);
  });

  it('rejects mentions anchored in another document', async () => {
    await expect(putMentions('d1', [mention('d2', 1, 0)])).rejects.toThrow(/another document/);
  });

  it('clearMentions removes only that doc', async () => {
    await putMentions('d1', [mention('d1', 1, 0)]);
    await putMentions('d2', [mention('d2', 1, 0)]);
    await clearMentions('d1');
    expect(await getMentions('d1')).toEqual([]);
    expect(await getMentions('d2')).toHaveLength(1);
  });

  it('clearDocument and clearAll remove mentions', async () => {
    await putMentions('d1', [mention('d1', 1, 0)]);
    await putMentions('d2', [mention('d2', 1, 0)]);
    await clearDocument('d1');
    expect(await getMentions('d1')).toEqual([]);
    expect(await getMentions('d2')).toHaveLength(1);
    await clearAll();
    expect(await getMentions('d2')).toEqual([]);
  });
});

describe('seance DB migration v1 -> v2', () => {
  it('keeps v1 cached documents and adds a working mentions store', async () => {
    await deleteDb();
    const docId = 'old';
    const page = { docId, page: 1, text: 'Marta Quill spoke.', itemOffsets: [0], status: 'ok' };
    const chunk = { id: `${docId}:1:0`, docId, page: 1, start: 0, end: page.text.length };
    const meta = {
      docId, title: 'old.pdf', sourceName: 'old.pdf', pages: 1, chunkCount: 1,
      schemaVersion: 1, createdAt: '2026-11-01T00:00:00.000Z', updatedAt: '2026-11-01T00:00:00.000Z'
    };
    const v1 = await new Promise<IDBDatabase>((res, rej) => {
      const r = indexedDB.open(DB_NAME, 1);
      r.onupgradeneeded = () => {
        r.result.createObjectStore('documents', { keyPath: 'docId' });
        r.result.createObjectStore('pages', { keyPath: ['docId', 'page'] });
        r.result.createObjectStore('chunks', { keyPath: 'docId' });
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const tx = v1.transaction(['documents', 'pages', 'chunks'], 'readwrite');
    tx.objectStore('documents').put(meta);
    tx.objectStore('pages').put(page);
    tx.objectStore('chunks').put({ docId, chunks: [chunk] });
    await new Promise<void>((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
    v1.close();

    const db = await openSeanceDb();
    expect(db.version).toBe(DB_VERSION);
    expect([...db.objectStoreNames].sort()).toEqual(['chunks', 'documents', 'mentions', 'pages']);
    const idx = db.transaction('mentions', 'readonly').objectStore('mentions').index('docId');
    expect(idx.unique).toBe(false);
    expect(await reqP(idx.count())).toBe(0);
    db.close();

    expect(RECORD_VERSION).toBe(1);
    const hit = await getIndex(docId);
    expect(hit?.meta).toEqual(meta);
    expect(hit?.pages).toEqual([page]);
    expect(hit?.chunks).toEqual([chunk]);

    await putMentions(docId, [mention(docId, 1, 0)]);
    expect(await getMentions(docId)).toEqual([mention(docId, 1, 0)]);
    await putIndex({ meta: { docId: 'new', title: 'n.pdf' }, pages: [], chunks: [] });
    expect(await getIndex(docId)).toBeDefined();
  });
});
