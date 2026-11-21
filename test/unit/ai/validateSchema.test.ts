import { describe, expect, it } from 'vitest';
import { validateSchema } from '../../../src/ai/validateSchema';
import type { SchemaNode } from '../../../src/ai/validateSchema';

const schema: SchemaNode = {
  type: 'object',
  properties: {
    items: { type: 'array', items: { type: 'object', properties: {
      kind: { type: 'string', enum: ['a', 'b'] },
      n: { type: 'number' },
      flag: { type: 'boolean' }
    }, required: ['kind'] } }
  },
  required: ['items']
};

describe('validateSchema', () => {
  it('accepts valid data and ignores extra properties', () => {
    expect(validateSchema(schema, { items: [{ kind: 'a', n: 1, flag: true, extra: 1 }], more: 'x' })).toEqual({ ok: true });
    expect(validateSchema(schema, { items: [] })).toEqual({ ok: true });
  });

  it.each([
    [null, '(root)', /expected object, got null/],
    [[], '(root)', /expected object, got array/],
    ['x', '(root)', /expected object, got string/],
    [{}, 'items', /is required/],
    [{ items: {} }, 'items', /expected array/],
    [{ items: [{ kind: 'a' }, {}] }, 'items[1].kind', /is required/],
    [{ items: [{ kind: 'c' }] }, 'items[0].kind', /not one of/],
    [{ items: [{ kind: 'a', n: '1' }] }, 'items[0].n', /expected number, got string/],
    [{ items: [{ kind: 'a', n: NaN }] }, 'items[0].n', /expected number/],
    [{ items: [{ kind: 'a', flag: 1 }] }, 'items[0].flag', /expected boolean/],
    [{ items: [null] }, 'items[0]', /got null/]
  ])('rejects %j at %s', (value, path, msg) => {
    const r = validateSchema(schema, value);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.path).toBe(path);
      expect(r.message).toMatch(msg);
      expect(r.message.startsWith(path)).toBe(true);
    }
  });
});
