import { describe, expect, it } from 'vitest';
import { sentenceStart } from '../../../src/pdf/sentenceStart';

describe('sentenceStart', () => {
  const t = 'First one here. Second sentence by Marta Quill. Third.';
  it('returns 0 inside the first sentence', () => {
    expect(sentenceStart(t, 0)).toBe(0);
    expect(sentenceStart(t, 6)).toBe(0);
  });
  it('returns the trimmed start of the containing sentence', () => {
    const at = t.indexOf('Marta');
    expect(sentenceStart(t, at)).toBe(t.indexOf('Second'));
    expect(sentenceStart(t, t.indexOf('Third'))).toBe(t.indexOf('Third'));
  });
  it('skips leading whitespace of a segment', () => {
    const s = 'A.   B said so.';
    expect(sentenceStart(s, s.indexOf('said'))).toBe(s.indexOf('B'));
  });
  it('handles empty text and out-of-range offsets', () => {
    expect(sentenceStart('', 0)).toBe(0);
    expect(sentenceStart(t, 999)).toBe(t.indexOf('Third'));
  });
});
