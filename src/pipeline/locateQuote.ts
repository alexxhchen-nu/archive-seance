export interface QuoteSpan {
  start: number;
  end: number;
}

interface Normalized {
  text: string;
  /** For each UTF-16 unit of `text`: original [from, to) it came from. */
  from: number[];
  to: number[];
}

const WS = /\s/u;
const LETTER = /\p{L}/u;

function codePointAt(s: string, i: number): string {
  const cp = s.codePointAt(i);
  return cp === undefined ? '' : String.fromCodePoint(cp);
}

/**
 * Collapse whitespace runs to one space, lower-case, and join line-end hyphenation
 * (letter '-' whitespace+ letter -> the two letters adjacent).
 */
function normalize(s: string): Normalized {
  const out: string[] = [];
  const from: number[] = [];
  const to: number[] = [];
  let i = 0;
  while (i < s.length) {
    const c = codePointAt(s, i);
    if (WS.test(c)) {
      let j = i;
      while (j < s.length && WS.test(s[j] ?? '')) j++;
      out.push(' ');
      from.push(i);
      to.push(j);
      i = j;
      continue;
    }
    if (c === '-' && i > 0 && LETTER.test(codePointAt(s, prevStart(s, i)))) {
      let j = i + 1;
      while (j < s.length && WS.test(s[j] ?? '')) j++;
      if (j > i + 1 && j < s.length && LETTER.test(codePointAt(s, j))) {
        i = j;
        continue;
      }
    }
    const lower = c.toLowerCase();
    for (let k = 0; k < lower.length; k++) {
      out.push(lower[k] ?? '');
      from.push(i);
      to.push(i + c.length);
    }
    i += c.length;
  }
  return { text: out.join(''), from, to };
}

function prevStart(s: string, i: number): number {
  const low = s.charCodeAt(i - 1);
  if (i >= 2 && low >= 0xdc00 && low <= 0xdfff) {
    const high = s.charCodeAt(i - 2);
    if (high >= 0xd800 && high <= 0xdbff) return i - 2;
  }
  return i - 1;
}

/**
 * Finds `quote` in `chunkText` and returns absolute UTF-16 offsets in the page text
 * (`chunkStart` + relative). Exact match first, then a whitespace/case/hyphenation-normalized
 * match mapped back to the original span. No fuzzy (edit-distance) matching.
 */
export function locateQuote(chunkText: string, chunkStart: number, quote: string): QuoteSpan | null {
  const q = quote.trim();
  if (q.length === 0) return null;
  const exact = chunkText.indexOf(q);
  if (exact >= 0) return { start: chunkStart + exact, end: chunkStart + exact + q.length };

  const nq = normalize(q).text.trim();
  if (nq.length === 0) return null;
  const nt = normalize(chunkText);
  const at = nt.text.indexOf(nq);
  if (at < 0) return null;
  const start = nt.from[at];
  const end = nt.to[at + nq.length - 1];
  if (start === undefined || end === undefined) return null;
  return { start: chunkStart + start, end: chunkStart + end };
}
