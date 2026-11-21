/** Collapse whitespace and case-fold, for the R3.4a "name appears in quote" check. */
export function foldWsCase(s: string): string {
  return s.replace(/\s+/gu, ' ').toLowerCase().trim();
}

/**
 * True when `name` appears inside `quote` after whitespace and case normalization.
 * No hyphenation or punctuation folding: R3.4a is only whitespace and case.
 */
export function nameInQuote(name: string, quote: string): boolean {
  const n = foldWsCase(name);
  return n.length > 0 && foldWsCase(quote).includes(n);
}
