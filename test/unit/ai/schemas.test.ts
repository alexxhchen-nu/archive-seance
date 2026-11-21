import { describe, expect, it } from 'vitest';
import { EXTRACTION_SCHEMA, PAIR_LABEL_SCHEMA, PROBE_SCHEMA, VERDICT_SCHEMA, toSdkSchema } from '../../../src/ai/schemas';
import type { RelationLabel } from '../../../src/types';

describe('schemas', () => {
  it('extraction schema matches design 4.1', () => {
    expect(EXTRACTION_SCHEMA.required).toEqual(['entities', 'relations']);
    const ent = EXTRACTION_SCHEMA.properties.entities.items;
    expect(ent.required).toEqual(['name', 'type', 'quote']);
    expect(ent.properties.type.enum).toEqual(['person', 'org']);
    const rel = EXTRACTION_SCHEMA.properties.relations.items;
    expect(rel.required).toEqual(['subject', 'object', 'label', 'quote']);
    expect(rel.properties.label.enum).toEqual(
      ['employed-by', 'member-of', 'family', 'business-partner', 'met-with', 'communicated-with']);
    for (const r of [...ent.required]) expect(ent.properties).toHaveProperty(r);
    for (const r of [...rel.required]) expect(rel.properties).toHaveProperty(r);
  });

  it('pair-label and verdict schemas match design 4.1', () => {
    const pair = PAIR_LABEL_SCHEMA.properties.pairs.items;
    expect(PAIR_LABEL_SCHEMA.required).toEqual(['pairs']);
    expect(pair.required).toEqual(['pairId', 'label', 'snippetId']);
    expect(pair.properties.label.enum).toContain('mentioned-together');
    expect(pair.properties.label.enum).toContain('none');
    expect(VERDICT_SCHEMA.properties.verdict.enum).toEqual(['same', 'different', 'unsure']);
  });

  it('schemas are plain JSON and required keys are declared properties', () => {
    const all = [EXTRACTION_SCHEMA, PROBE_SCHEMA, PAIR_LABEL_SCHEMA, VERDICT_SCHEMA];
    const walk = (n: Record<string, unknown>): void => {
      const props = (n.properties ?? {}) as Record<string, Record<string, unknown>>;
      for (const r of (n.required ?? []) as string[]) expect(props).toHaveProperty(r);
      for (const p of Object.values(props)) walk(p);
      if (n.items) walk(n.items as Record<string, unknown>);
    };
    for (const s of all) {
      expect(JSON.parse(JSON.stringify(s))).toEqual(s);
      walk(s);
    }
  });

  it('every RelationLabel is in the pair-label enum', () => {
    // Exhaustive record: adding a RelationLabel without listing it here fails typecheck.
    const labels: Record<RelationLabel, true> = {
      'employed-by': true, 'member-of': true, family: true, 'business-partner': true,
      'met-with': true, 'communicated-with': true, 'mentioned-together': true
    };
    const en: readonly string[] = PAIR_LABEL_SCHEMA.properties.pairs.items.properties.label.enum;
    for (const l of Object.keys(labels)) expect(en).toContain(l);
  });

  it('probe schema is well-formed; adapter returns same object', () => {
    expect(PROBE_SCHEMA.required.every((k) => k in PROBE_SCHEMA.properties)).toBe(true);
    expect(toSdkSchema(EXTRACTION_SCHEMA)).toBe(EXTRACTION_SCHEMA);
  });
});
