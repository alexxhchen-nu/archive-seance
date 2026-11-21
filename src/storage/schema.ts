/** IndexedDB database name (design §4.2). */
export const DB_NAME = 'seance';
/** IndexedDB open version. v1: documents, pages, chunks. v2: mentions. */
export const DB_VERSION = 2;
/** Format version written into cached index records; a record with another version is a cache miss. */
export const RECORD_VERSION = 1;

export const STORE_DOCUMENTS = 'documents';
export const STORE_PAGES = 'pages';
export const STORE_CHUNKS = 'chunks';
export const STORE_MENTIONS = 'mentions';
export const INDEX_MENTIONS_DOC = 'docId';
