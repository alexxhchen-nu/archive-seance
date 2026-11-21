import type { Config } from '../config/defaults';
import type { PageText } from '../types';
import type { PdfDocumentLike, TextContentLike, TextItemLike } from './PdfDocumentLike';

// Explicit map instead of NFKC: NFKC would also rewrite superscripts, fractions, full-width forms
// and similar characters, changing text the model quotes back; only the Latin ligatures matter here.
const LIGATURES: Record<string, string> = {
  '\uFB00': 'ff', '\uFB01': 'fi', '\uFB02': 'fl', '\uFB03': 'ffi', '\uFB04': 'ffl', '\uFB05': 'st', '\uFB06': 'st'
};

function expandLigatures(s: string): string {
  return s.replace(/[\uFB00-\uFB06]/g, (c) => LIGATURES[c] ?? c);
}

/** True when the layout gap between two positioned items implies a word or line break. */
function gapBetween(prev: TextItemLike, next: TextItemLike): boolean {
  const pt = prev.transform;
  const nt = next.transform;
  if (!pt || !nt || pt.length < 6 || nt.length < 6) return false;
  const h = Math.abs(prev.height ?? 0) || Math.abs(pt[3] ?? 0);
  const [px, py, nx, ny] = [pt[4] ?? 0, pt[5] ?? 0, nt[4] ?? 0, nt[5] ?? 0];
  if (Math.abs(ny - py) > h / 2) return true;
  if (prev.width === undefined) return false;
  return nx - (px + prev.width) > 0.25 * h;
}

/**
 * itemOffsets contract (spanMapper binary-searches it): exactly one entry per textContent item,
 * including items without `str` and items that normalize to nothing. itemOffsets[i] is the offset
 * in the final `text` where item i's contribution starts (a contribution-less item gets the
 * current length). Values are non-decreasing and never exceed text.length.
 */
export function buildPageText(
  docId: string,
  pageNumber: number,
  textContent: TextContentLike,
  cfg: Pick<Config, 'minTextCharsPerPage'>
): PageText {
  let text = '';
  // A separator is owed but only emitted before the next non-empty contribution, so text never
  // ends in whitespace and offsets computed here stay valid for the final string.
  let pendingSpace = false;
  let prevPositioned: TextItemLike | undefined;
  let prevEOL = false;
  const itemOffsets: number[] = [];

  for (const item of textContent.items) {
    const raw = typeof item.str === 'string' ? item.str : undefined;
    if (raw === undefined) {
      itemOffsets.push(text.length);
      continue;
    }
    if (prevEOL || (prevPositioned && gapBetween(prevPositioned, item))) pendingSpace = true;
    const norm = expandLigatures(raw).replace(/\s+/gu, ' ');
    const leading = norm.startsWith(' ');
    const core = norm.trim();
    if (core.length > 0) {
      if ((pendingSpace || leading) && text.length > 0) text += ' ';
      pendingSpace = false;
      itemOffsets.push(text.length);
      text += core;
      if (norm.endsWith(' ')) pendingSpace = true;
    } else {
      itemOffsets.push(text.length);
      if (norm.length > 0) pendingSpace = true;
    }
    prevEOL = item.hasEOL === true;
    if (raw.length > 0 || item.hasEOL) prevPositioned = item;
  }

  return {
    docId,
    page: pageNumber,
    text,
    itemOffsets,
    status: text.length < cfg.minTextCharsPerPage ? 'no-text' : 'ok'
  };
}

export async function buildPageIndex(
  doc: PdfDocumentLike,
  docId: string,
  cfg: Pick<Config, 'minTextCharsPerPage'>,
  onProgress?: (done: number, total: number) => void
): Promise<PageText[]> {
  const pages: PageText[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    pages.push(buildPageText(docId, n, await page.getTextContent(), cfg));
    onProgress?.(n, doc.numPages);
  }
  return pages;
}

export function summarizePages(pages: readonly PageText[]): { pages: number; noTextPages: number[] } {
  return { pages: pages.length, noTextPages: pages.filter((p) => p.status === 'no-text').map((p) => p.page) };
}
