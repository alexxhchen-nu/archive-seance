import fc from 'fast-check';
import type { Candidate, Verdict } from '../../../src/graph/confidence';
import type { Decision } from '../../../src/graph/cluster';
import { normalizeName } from '../../../src/graph/similarity';
import type { EntityType } from '../../../src/types';

const first = fc.constantFrom('John', 'Jon', 'J.', 'James', 'José', 'Jose', 'Ann', 'Anne', 'A.', 'Zoë', 'Zoe');
const middle = fc.constantFrom('', 'A.', 'B.', 'Alan');
const last = fc.constantFrom('Smith', 'Smyth', 'Núñez', 'Nunez', "O'Brien", 'Lee');
const honorific = fc.constantFrom('', 'Mr. ', 'Dr. ', 'Prof. ');
const suffix = fc.constantFrom('', ' Jr.', ' Sr.', ' III');

export const personName = fc.oneof(
  fc.tuple(honorific, first, middle, last, suffix).map(([h, f, m, l, s]) => `${h}${f} ${m ? `${m} ` : ''}${l}${s}`),
  last,
);
export const orgName = fc.oneof(
  fc.tuple(fc.constantFrom('', 'The '), fc.constantFrom('Harbor Lantern', 'Harbour Lantern', 'Federal Bureau of Investigation', 'Société Générale', 'Acme'), fc.constantFrom('', ' Inc.', ' Ltd', ', LLC', ' Co.'))
    .map(([t, n, s]) => `${t}${n}${s}`),
  fc.constantFrom('FBI', 'HL', 'SG'),
);

const neighbourIds = fc.uniqueArray(fc.constantFrom('n1', 'n2', 'n3', 'n4', 'n5'), { maxLength: 4 });

export const candidate: fc.Arbitrary<Omit<Candidate, 'key'>> = fc
  .tuple(fc.constantFrom<EntityType>('person', 'org'), personName, orgName, neighbourIds)
  .map(([type, p, o, ns]) => ({ type, name: normalizeName(type === 'person' ? p : o, type), neighbours: new Set(ns) }));

export const candidates: fc.Arbitrary<Candidate[]> = fc
  .array(candidate, { minLength: 1, maxLength: 8 })
  .map((cs) => cs.map((c, i) => ({ ...c, key: `k${i}` })));

export const verdict: fc.Arbitrary<Verdict | undefined> = fc.constantFrom(undefined, 'same', 'unsure', 'different');
export const decision: fc.Arbitrary<Decision> = fc.constantFrom('confirmed', 'split', 'unsure');
