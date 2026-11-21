const EXTRACTION_RULES = [
  'You extract people and organizations from archival text.',
  'Rules: Only use the text below. Copy "quote" verbatim from the text (one sentence or phrase containing the name).',
  'Return JSON matching the schema. If nothing is present, return empty arrays. Do not guess.',
  'Relation labels: employed-by, member-of, family, business-partner, met-with, communicated-with.',
  'Only output a relation if a single sentence states it.'
];

export const RETRY_INSTRUCTION = 'Return only valid JSON matching the schema.';

/** Design 5.5 extraction prompt. */
export function buildExtractionPrompt(chunkText: string): string {
  return [...EXTRACTION_RULES, '', 'TEXT:', '<<<', chunkText, '>>>'].join('\n');
}

/** Second attempt after invalid output or a failed call (R4.8). */
export function buildRetryPrompt(chunkText: string): string {
  return `${buildExtractionPrompt(chunkText)}\n${RETRY_INSTRUCTION}`;
}
