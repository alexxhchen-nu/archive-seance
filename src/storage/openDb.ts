import { DB_NAME, SCHEMA_VERSION, STORE_CHUNKS, STORE_DOCUMENTS, STORE_PAGES } from './schema';

/** Opens (and creates/migrates) the `seance` database. Raw IndexedDB; no `idb` dependency. */
export function openSeanceDb(factory: IDBFactory = globalThis.indexedDB): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!factory) {
      reject(new Error('IndexedDB is not available'));
      return;
    }
    const req = factory.open(DB_NAME, SCHEMA_VERSION);
    req.onupgradeneeded = (ev) => {
      const db = req.result;
      // v0 -> v1: first version, create the stores. Later versions add branches keyed on ev.oldVersion.
      if (ev.oldVersion < 1) {
        db.createObjectStore(STORE_DOCUMENTS, { keyPath: 'docId' });
        db.createObjectStore(STORE_PAGES, { keyPath: ['docId', 'page'] });
        db.createObjectStore(STORE_CHUNKS, { keyPath: 'docId' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Could not open IndexedDB'));
    req.onblocked = () => reject(new Error('IndexedDB open blocked by another connection'));
  });
}
