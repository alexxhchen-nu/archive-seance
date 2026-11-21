import type { Config } from '../config/defaults';
import type { LoadedPdf } from '../pdf/loadPdf';
import type { OpenedPdf } from '../pdf/openPdf';
import { buildPageIndex, summarizePages } from '../pdf/pageIndex';
import { chunkPages } from '../pdf/chunker';
import type { Chunk, PageText } from '../types';
import type { CachedIndex, PutIndexInput } from '../storage/indexCache';

export interface IndexSummary {
  title: string;
  docId: string;
  sourceUrl?: string;
  pages: number;
  chunks: number;
  noTextPages: number[];
  pageTexts: PageText[];
  chunkList: Chunk[];
  fromCache: boolean;
}

export interface IndexCacheLike {
  getIndex(docId: string): Promise<CachedIndex | undefined>;
  putIndex(input: PutIndexInput): Promise<void>;
}

export interface LoadAndIndexDeps {
  load(): Promise<LoadedPdf>;
  open(bytes: Uint8Array, cfg: Pick<Config, 'maxPdfPages'>): Promise<OpenedPdf>;
  onStatus?(message: string): void;
  cache?: IndexCacheLike;
}

export type IndexConfig = Pick<Config, 'maxPdfPages' | 'minTextCharsPerPage' | 'routeLocalMaxChunkChars'>;

/** load -> openPdf -> buildPageIndex -> chunkPages -> summary. PdfLoadError propagates unchanged. */
export async function loadAndIndex(deps: LoadAndIndexDeps, cfg: IndexConfig): Promise<IndexSummary> {
  deps.onStatus?.('Reading PDF…');
  const pdf = await deps.load();
  // Cache failures never block indexing: a read error is a miss, a write error is ignored.
  const hit = await deps.cache?.getIndex(pdf.docId).catch(() => undefined);
  if (hit) {
    // A hit is not rewritten; title/source shown reflect this load, the cached meta is left as is.
    const s = summarizePages(hit.pages);
    return summarize(pdf, s, hit.pages, hit.chunks, true);
  }
  deps.onStatus?.('Opening PDF…');
  const doc = await deps.open(pdf.bytes, cfg);
  let out: IndexSummary;
  try {
    const pageTexts = await buildPageIndex(doc, pdf.docId, cfg, (done, total) => {
      deps.onStatus?.(`Indexing page ${done} of ${total}…`);
    });
    const chunkList = chunkPages(pageTexts, cfg.routeLocalMaxChunkChars);
    out = summarize(pdf, summarizePages(pageTexts), pageTexts, chunkList, false);
  } finally {
    await doc.destroy();
  }
  if (deps.cache) {
    const meta: PutIndexInput['meta'] = { docId: pdf.docId, title: pdf.title };
    if (pdf.sourceUrl !== undefined) meta.sourceUrl = pdf.sourceUrl;
    else meta.sourceName = pdf.title;
    await deps.cache.putIndex({ meta, pages: out.pageTexts, chunks: out.chunkList }).catch(() => undefined);
  }
  return out;
}

function summarize(
  pdf: LoadedPdf, s: { pages: number; noTextPages: number[] }, pageTexts: PageText[], chunkList: Chunk[], fromCache: boolean
): IndexSummary {
  const out: IndexSummary = {
    title: pdf.title, docId: pdf.docId, pages: s.pages, chunks: chunkList.length,
    noTextPages: s.noTextPages, pageTexts, chunkList, fromCache
  };
  if (pdf.sourceUrl !== undefined) out.sourceUrl = pdf.sourceUrl;
  return out;
}
