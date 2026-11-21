import { describe, expect, it } from 'vitest';
import { locateQuote } from '../../../src/pipeline/locateQuote';

function slice(text: string, chunkStart: number, quote: string): string | null {
  const r = locateQuote(text, chunkStart, quote);
  return r ? text.slice(r.start - chunkStart, r.end - chunkStart) : null;
}

describe('locateQuote', () => {
  it('finds an exact quote', () => {
    const t = 'The meeting was called to order by Marta Quill.';
    expect(locateQuote(t, 0, 'Marta Quill')).toEqual({ start: 35, end: 46 });
  });

  it('first occurrence wins', () => {
    const t = 'Wren spoke. Then Wren left.';
    expect(locateQuote(t, 0, 'Wren')).toEqual({ start: 0, end: 4 });
  });

  it('trims whitespace around the quote', () => {
    expect(locateQuote('a Marta Quill b', 0, '  Marta Quill \n')).toEqual({ start: 2, end: 13 });
  });

  it('matches across collapsed whitespace and returns the original span', () => {
    const t = 'by Marta\n  Quill at seven';
    expect(slice(t, 0, 'Marta Quill')).toBe('Marta\n  Quill');
    expect(slice('by Marta Quill at', 0, 'Marta  \n Quill')).toBe('Marta Quill');
  });

  it('matches case-insensitively and returns original casing', () => {
    expect(slice('Called by MARTA QUILL today', 0, 'marta quill')).toBe('MARTA QUILL');
  });

  // Page text joins lines with a space, so "exam-\nple" arrives as "exam- ple". A letter, '-',
  // whitespace, letter is joined in BOTH text and quote, so both directions match.
  it('joins line-end hyphenation in the text (text "exam- ple", quote "example")', () => {
    expect(slice('an exam- ple here', 0, 'example')).toBe('exam- ple');
  });

  it('joins line-end hyphenation in the quote (text "example", quote "exam- ple")', () => {
    expect(slice('an example here', 0, 'exam- ple')).toBe('example');
  });

  it('does not join an in-word hyphen without whitespace', () => {
    expect(locateQuote('a well-known name', 0, 'wellknown')).toBeNull();
    expect(slice('a well-known name', 0, 'Well-Known')).toBe('well-known');
  });

  it('uses UTF-16 offsets with non-BMP characters', () => {
    const t = '😀🏛 Edith  Marlow';
    const r = locateQuote(t, 0, 'edith marlow');
    expect(r).toEqual({ start: 5, end: 18 });
    expect(slice('x 𝐀𝐁 y', 0, '𝐀𝐁')).toBe('𝐀𝐁');
  });

  it('returns null when not found, empty, whitespace-only, or longer than the chunk', () => {
    expect(locateQuote('abc', 0, 'Marlow')).toBeNull();
    expect(locateQuote('abc', 0, '')).toBeNull();
    expect(locateQuote('abc', 0, ' \n\t')).toBeNull();
    expect(locateQuote('abc', 0, 'abcd')).toBeNull();
  });

  it('does no fuzzy matching (trailing period differs)', () => {
    expect(locateQuote('Marta Quill spoke', 0, 'Marta Quill.')).toBeNull();
  });

  it('applies chunkStart', () => {
    expect(locateQuote('by Marta Quill', 100, 'Marta Quill')).toEqual({ start: 103, end: 114 });
    expect(locateQuote('by MARTA\nQuill', 100, 'marta quill')).toEqual({ start: 103, end: 114 });
  });
});
