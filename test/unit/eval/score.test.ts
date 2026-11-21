import { describe, expect, it } from 'vitest';
import { scoreEntities, scoreRelations } from '../../../src/eval/score';
import type { GoldSet } from '../../../src/eval/score';

const gold: GoldSet = {
  entities: [
    { id: 'em', name: 'Edith Marlow', type: 'person', aliases: ['Mrs. Marlow', 'E. Marlow'], mentions: [] },
    { id: 'hm', name: 'Harold Marlow', type: 'person', aliases: [], mentions: [] },
    { id: 'shs', name: 'Saltmarsh Historical Society', type: 'org', aliases: ['SHS'], mentions: [] },
    { id: 'cf', name: 'Corvin Ferry Company', type: 'org', aliases: [], mentions: [] }
  ],
  relations: [
    { subject: 'em', object: 'shs', label: 'member-of', page: 1, quote: 'q' },
    { subject: 'hm', object: 'em', label: 'family', page: 1, quote: 'q' }
  ]
};

describe('scoreEntities', () => {
  it('computes P/R with alias matches and unique surfaces', () => {
    const s = scoreEntities(gold, [
      { surface: 'Mrs. Marlow', type: 'person' },
      { surface: 'mrs marlow', type: 'person' },
      { surface: 'SHS', type: 'org' },
      { surface: 'Tobias Wren', type: 'person' }
    ]);
    expect(s).toMatchObject({ tp: 2, fp: 1, fn: 2, precision: 2 / 3, recall: 0.5 });
    expect(s.mentions).toEqual({ predicted: 4, matched: 3, unmatched: 1 });
  });

  it('requires the same type', () => {
    const s = scoreEntities(gold, [{ surface: 'Edith Marlow', type: 'org' }]);
    expect(s).toMatchObject({ tp: 0, fp: 1, precision: 0, recall: 0 });
  });

  it('org legal suffix is normalized', () => {
    expect(scoreEntities(gold, [{ surface: 'Corvin Ferry Co.', type: 'org' }]).tp).toBe(0);
    expect(scoreEntities(gold, [{ surface: 'the Corvin Ferry Company', type: 'org' }]).tp).toBe(1);
  });

  it('returns null precision/recall for empty denominators', () => {
    expect(scoreEntities(gold, [])).toMatchObject({ precision: null, recall: 0 });
    expect(scoreEntities({ entities: [], relations: [] }, [])).toMatchObject({ precision: null, recall: null });
  });
});

describe('scoreRelations', () => {
  it('directed labels do not match reversed; symmetric ones do', () => {
    const s = scoreRelations(gold, [
      { subject: 'SHS', object: 'Mrs. Marlow', label: 'member-of' },
      { subject: 'Edith Marlow', object: 'Harold Marlow', label: 'family' }
    ]);
    expect(s).toMatchObject({ tp: 1, fp: 1, fn: 1, precision: 0.5, recall: 0.5 });
    expect(scoreRelations(gold, [{ subject: 'E. Marlow', object: 'Saltmarsh Historical Society', label: 'member-of' }]))
      .toMatchObject({ tp: 1, precision: 1, recall: 0.5 });
  });

  it('label must be equal', () => {
    expect(scoreRelations(gold, [{ subject: 'Harold Marlow', object: 'Edith Marlow', label: 'met-with' }]))
      .toMatchObject({ tp: 0, fp: 1, precision: 0 });
  });

  it('returns null for empty denominators', () => {
    expect(scoreRelations({ entities: [], relations: [] }, [])).toMatchObject({ precision: null, recall: null });
  });
});
