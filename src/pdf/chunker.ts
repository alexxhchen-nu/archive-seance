import type { Chunk, PageText } from '../types';

const WS = /\s/u;

function isWs(text: string, i: number): boolean {
  return WS.test(text[i] ?? '');
}

function isHigh(c: number): boolean {
  return c >= 0xd800 && c <= 0xdbff;
}

function isLow(c: number): boolean {
  return c >= 0xdc00 && c <= 0xdfff;
}

/** True when `i` falls between the two halves of a surrogate pair. */
function splitsPair(text: string, i: number): boolean {
  return i > 0 && i < text.length && isHigh(text.charCodeAt(i - 1)) && isLow(text.charCodeAt(i));
}

interface Span { start: number; end: number }

/** [start,end) shrunk to non-whitespace; null when only whitespace. */
function trimSpan(text: string, start: number, end: number): Span | null {
  while (start < end && isWs(text, start)) start++;
  while (end > start && isWs(text, end - 1)) end--;
  return start < end ? { start, end } : null;
}

function hardSplit(text: string, span: Span, maxChars: number): Span[] {
  const out: Span[] = [];
  let pos = span.start;
  while (span.end - pos > maxChars) {
    const limit = pos + maxChars;
    let cut = -1;
    // Prefer the last whitespace at or before the limit.
    for (let i = limit; i > pos; i--) {
      if (isWs(text, i)) { cut = i; break; }
    }
    let piece = cut > pos ? trimSpan(text, pos, cut) : null;
    if (!piece) {
      cut = limit;
      if (splitsPair(text, cut)) cut--;
      // maxChars === 1 with a surrogate pair: the code point cannot be split, so it is emitted whole.
      if (cut === pos) cut = pos + 2;
      piece = { start: pos, end: cut };
    }
    out.push(piece);
    pos = cut;
    while (pos < span.end && isWs(text, pos)) pos++;
  }
  if (pos < span.end) out.push({ start: pos, end: span.end });
  return out;
}

export function chunkPage(page: PageText, maxChars: number): Chunk[] {
  if (!Number.isInteger(maxChars) || maxChars < 1) throw new RangeError(`maxChars must be a positive integer, got ${maxChars}`);
  if (page.status === 'no-text') return [];
  const text = page.text;
  const pieces: Span[] = [];
  const seg = new Intl.Segmenter('en', { granularity: 'sentence' });
  for (const s of seg.segment(text)) {
    const span = trimSpan(text, s.index, s.index + s.segment.length);
    if (!span) continue;
    if (span.end - span.start > maxChars) pieces.push(...hardSplit(text, span, maxChars));
    else pieces.push(span);
  }

  const chunks: Chunk[] = [];
  const emit = (sp: Span): void => {
    chunks.push({ id: `${page.docId}:${page.page}:${sp.start}`, docId: page.docId, page: page.page, start: sp.start, end: sp.end });
  };
  let cur: Span | null = null;
  for (const p of pieces) {
    if (cur && p.end - cur.start <= maxChars) cur.end = p.end;
    else {
      if (cur) emit(cur);
      cur = { ...p };
    }
  }
  if (cur) emit(cur);
  return chunks;
}

export function chunkPages(pages: readonly PageText[], maxChars: number): Chunk[] {
  if (!Number.isInteger(maxChars) || maxChars < 1) throw new RangeError(`maxChars must be a positive integer, got ${maxChars}`);
  return pages.flatMap((p) => chunkPage(p, maxChars));
}
