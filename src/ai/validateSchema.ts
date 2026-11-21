/** The JSON-Schema subset used by src/ai/schemas.ts. Extra properties in data are ignored. */
export interface SchemaNode {
  readonly type?: 'object' | 'array' | 'string' | 'boolean' | 'number';
  readonly enum?: readonly unknown[];
  readonly properties?: { readonly [key: string]: SchemaNode };
  readonly required?: readonly string[];
  readonly items?: SchemaNode;
}

export type SchemaResult = { ok: true } | { ok: false; path: string; message: string };

function describe(v: unknown): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  return typeof v;
}

function join(path: string, key: string): string {
  return path ? `${path}.${key}` : key;
}

function fail(path: string, message: string): SchemaResult {
  return { ok: false, path: path || '(root)', message: `${path || '(root)'}: ${message}` };
}

export function validateSchema(schema: SchemaNode, value: unknown, path = ''): SchemaResult {
  switch (schema.type) {
    case 'object': {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return fail(path, `expected object, got ${describe(value)}`);
      }
      const obj = value as Record<string, unknown>;
      for (const key of schema.required ?? []) {
        if (!Object.prototype.hasOwnProperty.call(obj, key)) return fail(join(path, key), 'is required');
      }
      for (const [key, sub] of Object.entries(schema.properties ?? {})) {
        if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
        const r = validateSchema(sub, obj[key], join(path, key));
        if (!r.ok) return r;
      }
      break;
    }
    case 'array': {
      if (!Array.isArray(value)) return fail(path, `expected array, got ${describe(value)}`);
      if (schema.items) {
        for (let i = 0; i < value.length; i++) {
          const r = validateSchema(schema.items, value[i], `${path}[${i}]`);
          if (!r.ok) return r;
        }
      }
      break;
    }
    case 'string':
    case 'boolean':
      if (typeof value !== schema.type) return fail(path, `expected ${schema.type}, got ${describe(value)}`);
      break;
    case 'number':
      if (typeof value !== 'number' || !Number.isFinite(value)) return fail(path, `expected number, got ${describe(value)}`);
      break;
    case undefined:
      break;
  }
  if (schema.enum && !schema.enum.includes(value)) {
    return fail(path, `${JSON.stringify(value)} is not one of ${schema.enum.map((e) => JSON.stringify(e)).join(', ')}`);
  }
  return { ok: true };
}
