import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { locateQuote } from '../../../src/pipeline/locateQuote';
import { numRuns } from '../../helpers/numRuns';

const collapse = (s: string): string => s.replace(/\s+/gu, ' ').trim().toLowerCase();

const anyText = fc.string({ unit: 'binary', minLength: 1, maxLength: 60 });
// Letters and whitespace only: case flips stay length- and fold-stable, no hyphen joins.
const asciiText = fc.string({ unit: fc.constantFrom(...'abcXYZ \n\t'.split('')), minLength: 1, maxLength: 60 });

const withSub = (text: fc.Arbitrary<string>) =>
  text.chain((t) => fc.tuple(fc.constant(t), fc.nat(t.length), fc.nat(t.length)))
    .map(([t, a, b]) => ({ t, sub: t.slice(Math.min(a, b), Math.max(a, b)) }))
    .filter(({ sub }) => sub.trim().length > 0);

describe('locateQuote properties', () => {
  it('(1) any substring is located and the span is the trimmed substring', () => {
    fc.assert(fc.property(withSub(anyText), fc.nat(1000), ({ t, sub }, cs) => {
      const r = locateQuote(t, cs, sub);
      expect(r).not.toBeNull();
      if (r) expect(t.slice(r.start - cs, r.end - cs)).toBe(sub.trim());
    }), { numRuns: numRuns(300) });
  });

  it('(2) the span lies inside [chunkStart, chunkStart + chunk.length]', () => {
    fc.assert(fc.property(anyText, anyText, fc.nat(1000), (t, q, cs) => {
      const r = locateQuote(t, cs, q);
      if (r) {
        expect(r.start).toBeGreaterThanOrEqual(cs);
        expect(r.end).toBeLessThanOrEqual(cs + t.length);
        expect(r.start).toBeLessThan(r.end);
      }
    }), { numRuns: numRuns(300) });
  });

  it('(3) case-flipped / whitespace-stretched variants are located', () => {
    fc.assert(fc.property(withSub(asciiText), fc.boolean(), ({ t, sub }, upper) => {
      const variant = (upper ? sub.toUpperCase() : sub.toLowerCase()).replace(/\s+/g, ' \n  ');
      const r = locateQuote(t, 0, variant);
      expect(r).not.toBeNull();
      if (r) expect(collapse(t.slice(r.start, r.end))).toBe(collapse(variant));
    }), { numRuns: numRuns(300) });
  });

  it('(4) a quote with a character absent from the text returns null', () => {
    fc.assert(fc.property(asciiText, asciiText, (t, q) => {
      expect(locateQuote(t, 0, `${q}#${q}`)).toBeNull();
      expect(locateQuote(t, 0, '#')).toBeNull();
    }), { numRuns: numRuns(200) });
  });
});
