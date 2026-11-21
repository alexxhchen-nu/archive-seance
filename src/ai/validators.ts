import type { ExtractionOutput, PairLabelsOutput, VerdictOutput } from '../types';
import { EXTRACTION_SCHEMA, PAIR_LABEL_SCHEMA, VERDICT_SCHEMA } from './schemas';
import { validateSchema } from './validateSchema';
import type { SchemaNode } from './validateSchema';

export type Validated<T> = { ok: true; value: T } | { ok: false; error: string };

function validateAgainst<T>(schema: SchemaNode, raw: unknown): Validated<T> {
  let value = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw);
    } catch (e) {
      return { ok: false, error: `not valid JSON: ${e instanceof Error ? e.message : String(e)}` };
    }
  }
  const r = validateSchema(schema, value);
  return r.ok ? { ok: true, value: value as T } : { ok: false, error: r.message };
}

export function validateExtraction(raw: unknown): Validated<ExtractionOutput> {
  return validateAgainst(EXTRACTION_SCHEMA, raw);
}

export function validatePairLabels(raw: unknown): Validated<PairLabelsOutput> {
  return validateAgainst(PAIR_LABEL_SCHEMA, raw);
}

export function validateVerdict(raw: unknown): Validated<VerdictOutput> {
  return validateAgainst(VERDICT_SCHEMA, raw);
}
