import { describe, expect, it } from 'vitest';
import { validateExtraction, validatePairLabels, validateVerdict } from '../../../src/ai/validators';

const ent = { name: 'Marta Quill', type: 'person', quote: 'Marta Quill spoke.' };
const rel = { subject: 'Marta Quill', object: 'Harbor Lantern Society', label: 'member-of', quote: 'q' };

function err(r: { ok: boolean; error?: string }): string {
  expect(r.ok).toBe(false);
  return r.error ?? '';
}

describe('validateExtraction', () => {
  it('accepts valid output, objects and JSON strings', () => {
    const v = { entities: [ent], relations: [rel] };
    expect(validateExtraction(v)).toEqual({ ok: true, value: v });
    expect(validateExtraction(JSON.stringify(v))).toEqual({ ok: true, value: v });
  });

  it('accepts empty arrays', () => {
    expect(validateExtraction({ entities: [], relations: [] }).ok).toBe(true);
  });

  it('rejects non-JSON strings without throwing', () => {
    expect(err(validateExtraction('{nope'))).toMatch(/not valid JSON/);
    expect(err(validateExtraction(''))).toMatch(/not valid JSON/);
  });

  it('rejects null, arrays and missing required keys', () => {
    expect(err(validateExtraction(null))).toMatch(/expected object/);
    expect(err(validateExtraction('null'))).toMatch(/expected object/);
    expect(err(validateExtraction([]))).toMatch(/expected object, got array/);
    expect(err(validateExtraction({ entities: [] }))).toMatch(/^relations: is required/);
    expect(err(validateExtraction({ entities: [ent, ent, { name: 'x', type: 'person' }], relations: [] })))
      .toMatch(/^entities\[2\]\.quote: is required/);
  });

  it('rejects wrong types and enums with paths', () => {
    expect(err(validateExtraction({ entities: [ent, ent, { ...ent, type: 'place' }], relations: [] })))
      .toMatch(/^entities\[2\]\.type: "place" is not one of/);
    expect(err(validateExtraction({ entities: [{ ...ent, name: 3 }], relations: [] }))).toMatch(/^entities\[0\]\.name: expected string/);
    expect(err(validateExtraction({ entities: {}, relations: [] }))).toMatch(/^entities: expected array/);
  });

  it("extraction labels exclude 'mentioned-together' and 'none'", () => {
    for (const label of ['mentioned-together', 'none']) {
      expect(err(validateExtraction({ entities: [], relations: [{ ...rel, label }] }))).toMatch(/^relations\[0\]\.label/);
    }
  });
});

describe('validatePairLabels', () => {
  it("accepts 'mentioned-together' and 'none' and empty pairs", () => {
    for (const label of ['mentioned-together', 'none', 'family']) {
      expect(validatePairLabels({ pairs: [{ pairId: 'p', label, snippetId: 's' }] }).ok).toBe(true);
    }
    expect(validatePairLabels('{"pairs":[]}').ok).toBe(true);
  });

  it('rejects malformed output', () => {
    expect(err(validatePairLabels({ pairs: [{ pairId: 'p', label: 'friend', snippetId: 's' }] }))).toMatch(/^pairs\[0\]\.label/);
    expect(err(validatePairLabels({ pairs: [{ pairId: 'p', label: 'none' }] }))).toMatch(/^pairs\[0\]\.snippetId: is required/);
    expect(err(validatePairLabels({}))).toMatch(/^pairs: is required/);
    expect(err(validatePairLabels('[1]'))).toMatch(/expected object/);
  });
});

describe('validateVerdict', () => {
  it('accepts each verdict', () => {
    for (const verdict of ['same', 'different', 'unsure']) expect(validateVerdict({ verdict }).ok).toBe(true);
  });

  it('rejects malformed output', () => {
    expect(err(validateVerdict({ verdict: 'maybe' }))).toMatch(/^verdict: "maybe" is not one of/);
    expect(err(validateVerdict({ verdict: true }))).toMatch(/^verdict: expected string/);
    expect(err(validateVerdict({}))).toMatch(/^verdict: is required/);
    expect(err(validateVerdict(undefined))).toMatch(/expected object, got undefined/);
    expect(err(validateVerdict('same'))).toMatch(/not valid JSON/);
  });
});
