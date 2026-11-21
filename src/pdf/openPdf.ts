import * as defaultPdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { Config } from '../config/defaults';
import { PdfLoadError } from './loadPdf';
import type { PdfDocumentLike } from './PdfDocumentLike';
import { extensionPdfjsDataUrls } from './pdfjsDataUrls';
import type { PdfjsDataUrls } from './pdfjsDataUrls';

export interface PdfjsGetDocumentParams extends Partial<PdfjsDataUrls> {
  data: Uint8Array;
  isEvalSupported: boolean;
  cMapPacked?: boolean;
}

export interface PdfjsLike {
  getDocument(src: PdfjsGetDocumentParams): { promise: Promise<PdfDocumentLike>; destroy(): Promise<void> };
  GlobalWorkerOptions?: { workerSrc: string };
}

export type OpenedPdf = PdfDocumentLike & { destroy(): Promise<void> };

let workerConfigured = false;

export async function openPdf(
  bytes: Uint8Array,
  cfg: Pick<Config, 'maxPdfPages'>,
  pdfjsLib: PdfjsLike = defaultPdfjs as unknown as PdfjsLike,
  dataUrls: PdfjsDataUrls | undefined = extensionPdfjsDataUrls()
): Promise<OpenedPdf> {
  if (pdfjsLib === (defaultPdfjs as unknown) && !workerConfigured && defaultPdfjs.GlobalWorkerOptions) {
    defaultPdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    workerConfigured = true;
  }
  // pdf.js transfers (detaches) the buffer it is given; keep the caller's bytes intact.
  // isEvalSupported is no longer in pdfjs-dist 6 typings; passing it is harmless and keeps intent explicit.
  const params: PdfjsGetDocumentParams = { data: bytes.slice(), isEvalSupported: false };
  if (dataUrls) Object.assign(params, dataUrls, { cMapPacked: true });
  const task = pdfjsLib.getDocument(params);
  let proxy: PdfDocumentLike;
  try {
    proxy = await task.promise;
  } catch (e) {
    await task.destroy();
    throw new PdfLoadError('parse-failed', `The PDF could not be read: ${e instanceof Error ? e.message : String(e)}`);
  }
  // pdfjs-dist 6 has no PDFDocumentProxy.destroy(); the loading task owns the worker and document.
  const doc: OpenedPdf = {
    numPages: proxy.numPages,
    getPage: (n) => proxy.getPage(n),
    destroy: () => task.destroy()
  };
  if (doc.numPages > cfg.maxPdfPages) {
    await doc.destroy();
    throw new PdfLoadError('too-many-pages', `PDF has ${doc.numPages} pages; the limit is ${cfg.maxPdfPages}`);
  }
  return doc;
}
