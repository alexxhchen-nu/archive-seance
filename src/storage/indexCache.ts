import type { Chunk, PageText } from '../types';
import { openSeanceDb } from './openDb';
import { deleteMentionsOf } from './mentionStore';
import { RECORD_VERSION, STORE_CHUNKS, STORE_DOCUMENTS, STORE_MENTIONS, STORE_PAGES } from './schema';

export interface CachedDocumentMeta {
  docId: string;          // sha256 hex
  title: string;          // filename or URL last segment
  sourceUrl?: string;     // remote URL if any
  sourceName?: string;    // local filename if any
  pages: number;
  chunkCount: number;
  schemaVersion: number;  // RECORD_VERSION written at put time
  createdAt: string;      // ISO-8601
  updatedAt: string;
}

export interface CachedIndex {
  meta: CachedDocumentMeta;
  pages: PageText[];
  chunks: Chunk[];
}

export interface PutIndexInput {
  meta: Omit<CachedDocumentMeta, 'schemaVersion' | 'createdAt' | 'updatedAt' | 'pages' | 'chunkCount'>;
  pages: PageText[];
  chunks: Chunk[];
}

const ALL = [STORE_DOCUMENTS, STORE_PAGES, STORE_CHUNKS];

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error ?? new Error('IndexedDB request failed'));
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
  });
}

async function withDb<T>(factory: IDBFactory | undefined, fn: (db: IDBDatabase) => Promise<T>): Promise<T> {
  const db = await openSeanceDb(factory);
  try {
    return await fn(db);
  } finally {
    db.close();
  }
}

const pageRange = (docId: string) => IDBKeyRange.bound([docId, -Infinity], [docId, Infinity]);

export function getIndex(docId: string, factory?: IDBFactory): Promise<CachedIndex | undefined> {
  return withDb(factory, async (db) => {
    const tx = db.transaction(ALL, 'readonly');
    const [meta, pages, chunkRec] = await Promise.all([
      req(tx.objectStore(STORE_DOCUMENTS).get(docId)) as Promise<CachedDocumentMeta | undefined>,
      req(tx.objectStore(STORE_PAGES).getAll(pageRange(docId))) as Promise<PageText[]>,
      req(tx.objectStore(STORE_CHUNKS).get(docId)) as Promise<{ docId: string; chunks: Chunk[] } | undefined>
    ]);
    if (!meta || meta.schemaVersion !== RECORD_VERSION || !chunkRec) return undefined;
    if (pages.length !== meta.pages || chunkRec.chunks.length !== meta.chunkCount) return undefined;
    pages.sort((a, b) => a.page - b.page);
    if (pages.some((p, i) => p.page !== i + 1)) return undefined;
    return { meta, pages, chunks: chunkRec.chunks };
  });
}

/** Writes document, pages and chunks in one transaction; replaces any previous pages of the doc. */
export function putIndex(input: PutIndexInput, factory?: IDBFactory, now: () => Date = () => new Date()): Promise<void> {
  return withDb(factory, async (db) => {
    const tx = db.transaction(ALL, 'readwrite');
    const finished = done(tx);
    const docs = tx.objectStore(STORE_DOCUMENTS);
    const prev = (await req(docs.get(input.meta.docId))) as CachedDocumentMeta | undefined;
    const at = now().toISOString();
    const meta: CachedDocumentMeta = {
      ...input.meta,
      pages: input.pages.length,
      chunkCount: input.chunks.length,
      schemaVersion: RECORD_VERSION,
      createdAt: prev?.createdAt ?? at,
      updatedAt: at
    };
    try {
      const pagesStore = tx.objectStore(STORE_PAGES);
      pagesStore.delete(pageRange(input.meta.docId));
      for (const p of input.pages) pagesStore.put(p);
      tx.objectStore(STORE_CHUNKS).put({ docId: input.meta.docId, chunks: input.chunks });
      docs.put(meta);
    } catch (e) {
      // A synchronous put error does not abort by itself; abort so no earlier write in this tx commits.
      finished.catch(() => undefined);
      tx.abort();
      throw e;
    }
    await finished;
  });
}

export function clearDocument(docId: string, factory?: IDBFactory): Promise<void> {
  return withDb(factory, async (db) => {
    const tx = db.transaction([...ALL, STORE_MENTIONS], 'readwrite');
    const finished = done(tx);
    deleteMentionsOf(tx.objectStore(STORE_MENTIONS), docId);
    tx.objectStore(STORE_DOCUMENTS).delete(docId);
    tx.objectStore(STORE_PAGES).delete(pageRange(docId));
    tx.objectStore(STORE_CHUNKS).delete(docId);
    await finished;
  });
}

export function clearAll(factory?: IDBFactory): Promise<void> {
  return withDb(factory, async (db) => {
    const stores = [...ALL, STORE_MENTIONS];
    const tx = db.transaction(stores, 'readwrite');
    const finished = done(tx);
    for (const s of stores) tx.objectStore(s).clear();
    await finished;
  });
}

export function listDocuments(factory?: IDBFactory): Promise<CachedDocumentMeta[]> {
  return withDb(factory, async (db) => {
    const tx = db.transaction(STORE_DOCUMENTS, 'readonly');
    return (await req(tx.objectStore(STORE_DOCUMENTS).getAll())) as CachedDocumentMeta[];
  });
}

/** Deletes the oldest documents (by updatedAt, then createdAt) until at most maxDocuments remain. */
export async function evictOldest(maxDocuments: number, factory?: IDBFactory): Promise<string[]> {
  const docs = await listDocuments(factory);
  if (docs.length <= maxDocuments) return [];
  docs.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt) || a.createdAt.localeCompare(b.createdAt));
  const evicted = docs.slice(0, docs.length - Math.max(0, maxDocuments)).map((d) => d.docId);
  for (const id of evicted) await clearDocument(id, factory);
  return evicted;
}
