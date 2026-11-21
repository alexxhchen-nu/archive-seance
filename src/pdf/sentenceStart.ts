const WS = /\s/u;

/**
 * Start offset of the Intl.Segmenter('en', sentence) segment of `text` containing `offset`,
 * moved past leading whitespace like the chunker trims its sentence spans.
 */
export function sentenceStart(text: string, offset: number): number {
  const seg = new Intl.Segmenter('en', { granularity: 'sentence' });
  const s = seg.segment(text).containing(Math.max(0, Math.min(offset, text.length - 1)));
  if (!s) return 0;
  let start = s.index;
  const end = s.index + s.segment.length;
  while (start < end && start < offset && WS.test(text[start] ?? '')) start++;
  return start;
}
