export interface PdfjsDataUrls {
  standardFontDataUrl: string;
  cMapUrl: string;
  wasmUrl: string;
}

/** Builds the pdf.js data URLs from a resolver (e.g. chrome.runtime.getURL). Each URL ends with `/`. */
export function pdfjsDataUrls(resolve: (path: string) => string, base = 'pdfjs/'): PdfjsDataUrls {
  return {
    standardFontDataUrl: resolve(`${base}standard_fonts/`),
    cMapUrl: resolve(`${base}cmaps/`),
    wasmUrl: resolve(`${base}wasm/`)
  };
}

/** Extension default: the copies Vite places under `<outDir>/pdfjs/`. Undefined outside an extension page. */
export function extensionPdfjsDataUrls(): PdfjsDataUrls | undefined {
  const c = (globalThis as { chrome?: { runtime?: { getURL?: (p: string) => string } } }).chrome;
  const getURL = c?.runtime?.getURL;
  return typeof getURL === 'function' ? pdfjsDataUrls((p) => getURL(p)) : undefined;
}
