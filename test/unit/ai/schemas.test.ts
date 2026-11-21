import { describe, expect, it } from 'vitest';
import { EXTRACTION_SCHEMA, PROBE_SCHEMA, toSdkSchema } from '../../../src/ai/schemas';

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

  it('probe schema is well-formed; adapter returns same object', () => {
    expect(PROBE_SCHEMA.required.every((k) => k in PROBE_SCHEMA.properties)).toBe(true);
    expect(toSdkSchema(EXTRACTION_SCHEMA)).toBe(EXTRACTION_SCHEMA);
  });
});
