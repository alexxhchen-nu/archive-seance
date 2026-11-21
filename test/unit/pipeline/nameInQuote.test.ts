import { describe, expect, it } from 'vitest';
import { foldWsCase, nameInQuote } from '../../../src/pipeline/nameInQuote';

describe('nameInQuote (R3.4a)', () => {
  it('accepts exact, case, and whitespace variants', () => {
    expect(nameInQuote('Edith Marlow', 'Mrs. Edith Marlow chaired')).toBe(true);
    expect(nameInQuote('edith  MARLOW', 'Mrs. Edith\nMarlow chaired')).toBe(true);
    expect(nameInQuote('Marta Quill', 'called by Marta Quill.')).toBe(true);
  });
  it('rejects a name that does not appear after whitespace/case normalization', () => {
    expect(nameInQuote('Edith Marlow', 'Mrs. Marlow has been a member')).toBe(false);
    expect(nameInQuote('Miriam Holloway', 'arranged by Miriam Hollo- way')).toBe(false);
    expect(nameInQuote('SHS', 'Saltmarsh Historical Society')).toBe(false);
  });
  it('does not fold hyphenation or punctuation', () => {
    expect(nameInQuote('E. Marlow', 'E. Marlow wrote')).toBe(true);
    expect(nameInQuote('E Marlow', 'E. Marlow wrote')).toBe(false);
    expect(nameInQuote('Holloway', 'Hollo- way')).toBe(false);
  });
  it('rejects empty or whitespace-only names', () => {
    expect(nameInQuote('   ', 'Marta Quill spoke')).toBe(false);
    expect(nameInQuote('', 'Marta Quill spoke')).toBe(false);
  });
  it('foldWsCase collapses whitespace and lower-cases', () => {
    expect(foldWsCase('  Edith\n  MARLOW ')).toBe('edith marlow');
  });
});
