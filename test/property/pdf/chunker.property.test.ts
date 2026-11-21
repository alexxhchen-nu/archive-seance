import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { chunkPages } from '../../../src/pdf/chunker';
import type { PageText } from '../../../src/types';

const word = fc.oneof(
  fc.constantFrom('Mr.', 'Dr.', 'lantern', 'Quill', 'a', 'harbor', '1.', 'e.g.', '\u{1F56F}', 'caf\u00E9', '\u6863\u6848', 'x\u{1D400}y'),
  fc.string({ unit: 'grapheme', minLength: 1, maxLength: 12 })
);
const sep = fc.constantFrom(' ', '  ', '. ', '! ', '? ', '\n', '\u00A0', '');
const text = fc.array(fc.tuple(word, sep), { maxLength: 40 }).map((ws) => ws.map(([w, s]) => w + s).join(''));
const pages = fc.array(fc.tuple(text, fc.boolean()), { minLength: 1, maxLength: 4 }).map((ps) =>
  ps.map(([t, noText], i): PageText => ({ docId: 'd0c', page: i + 1, text: t, itemOffsets: [0], status: noText ? 'no-text' : 'ok' })));
const maxChars = fc.integer({ min: 1, max: 200 });

const isHigh = (c: number) => c >= 0xd800 && c <= 0xdbff;
const isLow = (c: number) => c >= 0xdc00 && c <= 0xdfff;
const splits = (t: string, i: number) => i > 0 && i < t.length && isHigh(t.charCodeAt(i - 1)) && isLow(t.charCodeAt(i));

describe('chunker properties', () => {
  it('holds all chunk invariants', () => {
    fc.assert(fc.property(pages, maxChars, (ps, max) => {
      const cs = chunkPages(ps, max);
      const ids = new Set<string>();
      for (const p of ps) {
        const own = cs.filter((c) => c.page === p.page);
        if (p.status === 'no-text') {
          expect(own).toEqual([]); // (7)
          continue;
        }
        let prev = 0;
        const count = new Array<number>(p.text.length).fill(0);
        for (const c of own) {
          const len = c.end - c.start;
          // (1) length; single astral code points may need 2 units when max is 1
          expect(len).toBeGreaterThanOrEqual(1);
          expect(len <= max || (max === 1 && len === 2 && isHigh(p.text.charCodeAt(c.start)))).toBe(true);
          // (2) bounds within own page
          expect(c.docId).toBe(p.docId);
          expect(c.start).toBeGreaterThanOrEqual(0);
          expect(c.end).toBeLessThanOrEqual(p.text.length);
          // (3) ordered, non-overlapping
          expect(c.start).toBeGreaterThanOrEqual(prev);
          prev = c.end;
          // (5) no surrogate split
          expect(splits(p.text, c.start) || splits(p.text, c.end)).toBe(false);
          // (6) id format and uniqueness
          expect(c.id).toBe(`d0c:${p.page}:${c.start}`);
          expect(ids.has(c.id)).toBe(false);
          ids.add(c.id);
          for (let i = c.start; i < c.end; i++) count[i]!++;
        }
        // (4) exactly-once coverage of non-whitespace code units
        for (let i = 0; i < p.text.length; i++) {
          if (!/\s/u.test(p.text[i]!)) expect(count[i]).toBe(1);
        }
      }
      // (2) every chunk belongs to an existing page
      for (const c of cs) expect(ps.some((p) => p.page === c.page)).toBe(true);
      // (8) deterministic
      expect(chunkPages(ps, max)).toEqual(cs);
    }), { numRuns: 300 });
  });
});
