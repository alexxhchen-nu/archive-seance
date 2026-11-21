import { describe, expect, it } from 'vitest';
import { buildExtractionPrompt, buildRetryPrompt, RETRY_INSTRUCTION } from '../../../src/ai/prompts';

const EXPECTED = `You extract people and organizations from archival text.
Rules: Only use the text below. Copy "quote" verbatim from the text (one sentence or phrase containing the name).
Return JSON matching the schema. If nothing is present, return empty arrays. Do not guess.
Relation labels: employed-by, member-of, family, business-partner, met-with, communicated-with.
Only output a relation if a single sentence states it.

TEXT:
<<<
CHUNK
>>>`;

describe('prompts', () => {
  it('builds the design 5.5 extraction prompt exactly', () => {
    expect(buildExtractionPrompt('CHUNK')).toBe(EXPECTED);
  });

  it('embeds the chunk text verbatim', () => {
    const chunk = '  Edith  Marlow\nmet {x} $& "q" >>> ';
    expect(buildExtractionPrompt(chunk)).toContain(`<<<\n${chunk}\n>>>`);
  });

  it('retry prompt is the extraction prompt plus a final JSON-only line', () => {
    const r = buildRetryPrompt('CHUNK');
    expect(RETRY_INSTRUCTION).toBe('Return only valid JSON matching the schema.');
    expect(r).toBe(`${EXPECTED}\n${RETRY_INSTRUCTION}`);
    expect(r.split('\n').at(-1)).toBe(RETRY_INSTRUCTION);
  });
});
