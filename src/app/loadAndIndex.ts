import type { Config } from '../config/defaults';
import type { LoadedPdf } from '../pdf/loadPdf';
import type { OpenedPdf } from '../pdf/openPdf';
import { buildPageIndex, summarizePages } from '../pdf/pageIndex';
import { chunkPages } from '../pdf/chunker';
import type { Chunk, PageText } from '../types';

export interface IndexSummary {
  title: string;
  docId: string;
  sourceUrl?: string;
  pages: number;
  chunks: number;
  noTextPages: number[];
  pageTexts: PageText[];
  chunkList: Chunk[];
}

export interface LoadAndIndexDeps {
  load(): Promise<LoadedPdf>;
  open(bytes: Uint8Array, cfg: Pick<Config, 'maxPdfPages'>): Promise<OpenedPdf>;
  onStatus?(message: string): void;
}

export type IndexConfig = Pick<Config, 'maxPdfPages' | 'minTextCharsPerPage' | 'routeLocalMaxChunkChars'>;

/** load -> openPdf -> buildPageIndex -> chunkPages -> summary. PdfLoadError propagates unchanged. */
export async function loadAndIndex(deps: LoadAndIndexDeps, cfg: IndexConfig): Promise<IndexSummary> {
  deps.onStatus?.('Reading PDF…');
  const pdf = await deps.load();
  deps.onStatus?.('Opening PDF…');
  const doc = await deps.open(pdf.bytes, cfg);
  try {
    const pageTexts = await buildPageIndex(doc, pdf.docId, cfg, (done, total) => {
      deps.onStatus?.(`Indexing page ${done} of ${total}…`);
    });
    const chunkList = chunkPages(pageTexts, cfg.routeLocalMaxChunkChars);
    const s = summarizePages(pageTexts);
    const out: IndexSummary = {
      title: pdf.title, docId: pdf.docId, pages: s.pages, chunks: chunkList.length,
      noTextPages: s.noTextPages, pageTexts, chunkList
    };
    if (pdf.sourceUrl !== undefined) out.sourceUrl = pdf.sourceUrl;
    return out;
  } finally {
    await doc.destroy();
  }
}
