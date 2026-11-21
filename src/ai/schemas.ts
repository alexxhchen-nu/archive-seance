import type { GenerationConfig } from 'firebase/ai';

// Plain JSON Schema so one object feeds responseConstraint (on-device) and responseSchema (cloud).
export const EXTRACTION_SCHEMA = {
  type: 'object',
  properties: {
    entities: { type: 'array', items: { type: 'object', properties: {
      name:  { type: 'string' },
      type:  { type: 'string', enum: ['person', 'org'] },
      quote: { type: 'string' }
    }, required: ['name', 'type', 'quote'] } },
    relations: { type: 'array', items: { type: 'object', properties: {
      subject: { type: 'string' },
      object:  { type: 'string' },
      label:   { type: 'string', enum: ['employed-by', 'member-of', 'family', 'business-partner', 'met-with', 'communicated-with'] },
      quote:   { type: 'string' }
    }, required: ['subject', 'object', 'label', 'quote'] } }
  },
  required: ['entities', 'relations']
} as const;

export const PROBE_SCHEMA = {
  type: 'object',
  properties: { ok: { type: 'boolean' } },
  required: ['ok']
} as const;

export const PAIR_LABEL_SCHEMA = {
  type: 'object',
  properties: { pairs: { type: 'array', items: { type: 'object', properties: {
    pairId:    { type: 'string' },
    label:     { type: 'string', enum: ['employed-by','member-of','family','business-partner','met-with','communicated-with','mentioned-together','none'] },
    snippetId: { type: 'string' }
  }, required: ['pairId', 'label', 'snippetId'] } } },
  required: ['pairs']
} as const;

export const VERDICT_SCHEMA = {
  type: 'object',
  properties: { verdict: { type: 'string', enum: ['same', 'different', 'unsure'] } },
  required: ['verdict']
} as const;

export type SdkResponseSchema = NonNullable<GenerationConfig['responseSchema']>;

/**
 * The SDK types responseSchema with its SchemaType enum, which a plain string-literal JSON schema
 * does not satisfy structurally, although the wire format is identical. Cast only here.
 */
export function toSdkSchema(schema: object): SdkResponseSchema {
  return schema as unknown as SdkResponseSchema;
}
