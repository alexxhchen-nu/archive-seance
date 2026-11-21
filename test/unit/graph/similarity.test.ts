import { describe, expect, it } from 'vitest';
import { contextScore, jaroWinkler, nameScore, normalizeName } from '../../../src/graph/similarity';

describe('normalizeName', () => {
  it('strips diacritics, punctuation, honorifics and splits suffixes', () => {
    expect(normalizeName('Dr. José  Álvarez-Núñez, Jr.')).toEqual({ tokens: ['jose', 'alvarez', 'nunez'], suffix: 'jr' });
    expect(normalizeName("Mrs. O'Brien")).toEqual({ tokens: ['obrien'] });
    expect(normalizeName('Prof Sir John Smith III')).toEqual({ tokens: ['john', 'smith'], suffix: 'iii' });
  });
  it('drops org legal suffixes into the suffix field', () => {
    expect(normalizeName('The Harbor Lantern Co., Ltd.', 'org')).toEqual({ tokens: ['harbor', 'lantern'], suffix: 'co ltd' });
    expect(normalizeName('Acme', 'org')).toEqual({ tokens: ['acme'] });
  });
});

describe('jaroWinkler', () => {
  it('matches known values', () => {
    expect(jaroWinkler('martha', 'marhta')).toBeCloseTo(0.961, 3);
    expect(jaroWinkler('abc', 'abc')).toBe(1);
    expect(jaroWinkler('', 'abc')).toBe(0);
    expect(jaroWinkler('jon smith', 'john smith')).toBeCloseTo(0.97, 2);
  });
});

describe('nameScore (design 7.2 / 7.5)', () => {
  const p = (a: string, b: string) => nameScore(normalizeName(a), normalizeName(b), 'person');
  const o = (a: string, b: string) => nameScore(normalizeName(a, 'org'), normalizeName(b, 'org'), 'org');
  it('reproduces the 7.5 name column', () => {
    expect(p('John Smith', 'john smith')).toBe(1);
    expect(p('J. Smith', 'John Smith')).toBe(0.88);
    expect(p('Jon Smith', 'John Smith')).toBeCloseTo(0.97, 2);
    expect(p('John Smith', 'James Smith')).toBe(0.35);
    expect(p('Smith', 'John Smith')).toBe(0.62);
  });
  it('falls back to Jaro-Winkler for unrelated names', () => {
    expect(p('Ann Lee', 'Bob Marsh')).toBe(jaroWinkler('ann lee', 'bob marsh'));
  });
  it('applies org rules', () => {
    expect(o('Acme Inc.', 'ACME Ltd')).toBe(0.97);
    expect(o('FBI', 'Federal Bureau of Investigation')).toBe(0.8);
    expect(o('Federal Bureau of Investigation', 'FBI')).toBe(0.8);
  });
});

describe('contextScore', () => {
  it('is Jaccard, neutral 0.5 on empty', () => {
    expect(contextScore(new Set(['a', 'b']), new Set(['b', 'c']))).toBeCloseTo(1 / 3);
    expect(contextScore(new Set(), new Set(['a']))).toBe(0.5);
  });
});
