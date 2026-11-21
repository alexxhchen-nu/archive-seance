import type { Mention } from '../types';
import { openSeanceDb } from './openDb';
import { INDEX_MENTIONS_DOC, STORE_MENTIONS } from './schema';

/** Stored shape: the mention plus a top-level docId for the 'docId' index. */
type MentionRecord = Mention & { docId: string };

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

/** Queues deletion of every mention of `docId` inside an existing readwrite transaction. */
export function deleteMentionsOf(store: IDBObjectStore, docId: string): void {
  const cursorReq = store.index(INDEX_MENTIONS_DOC).openKeyCursor(IDBKeyRange.only(docId));
  cursorReq.onsuccess = () => {
    const cursor = cursorReq.result;
    if (!cursor) return;
    store.delete(cursor.primaryKey);
    cursor.continue();
  };
}

/** Replaces all mentions of `docId` in one transaction. */
export async function putMentions(docId: string, mentions: readonly Mention[], factory?: IDBFactory): Promise<void> {
  const foreign = mentions.find((m) => m.anchor.docId !== docId);
  if (foreign) throw new Error(`mention ${foreign.id} belongs to another document`);
  const db = await openSeanceDb(factory);
  try {
    const tx = db.transaction(STORE_MENTIONS, 'readwrite');
    const finished = done(tx);
    const store = tx.objectStore(STORE_MENTIONS);
    // Deletes are issued from the cursor callbacks; puts are queued after the cursor finishes.
    const cursorReq = store.index(INDEX_MENTIONS_DOC).openKeyCursor(IDBKeyRange.only(docId));
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (cursor) {
        store.delete(cursor.primaryKey);
        cursor.continue();
        return;
      }
      for (const m of mentions) store.put({ ...m, docId } satisfies MentionRecord);
    };
    await finished;
  } finally {
    db.close();
  }
}

/** Mentions of `docId`, sorted by page then start. */
export async function getMentions(docId: string, factory?: IDBFactory): Promise<Mention[]> {
  const db = await openSeanceDb(factory);
  try {
    const tx = db.transaction(STORE_MENTIONS, 'readonly');
    const recs = (await req(tx.objectStore(STORE_MENTIONS).index(INDEX_MENTIONS_DOC).getAll(IDBKeyRange.only(docId)))) as MentionRecord[];
    const out = recs.map(({ docId: _d, ...m }) => m);
    out.sort((a, b) => a.anchor.page - b.anchor.page || a.anchor.start - b.anchor.start || a.id.localeCompare(b.id));
    return out;
  } finally {
    db.close();
  }
}

export async function clearMentions(docId: string, factory?: IDBFactory): Promise<void> {
  const db = await openSeanceDb(factory);
  try {
    const tx = db.transaction(STORE_MENTIONS, 'readwrite');
    const finished = done(tx);
    deleteMentionsOf(tx.objectStore(STORE_MENTIONS), docId);
    await finished;
  } finally {
    db.close();
  }
}
