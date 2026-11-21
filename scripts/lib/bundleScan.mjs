// Pure-ish scanner for remotely hosted code markers in a build directory.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

export const FORBIDDEN = ['recaptcha/api.js', 'recaptcha/enterprise.js', 'apis.google.com/js/api.js'];

function walk(dir) {
  const out = [];
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walk(p));
    else if (ent.isFile()) out.push(p);
  }
  return out;
}

export function findForbiddenInText(text, patterns = FORBIDDEN) {
  return patterns.filter((s) => text.includes(s));
}

/** @returns {{file:string, patterns:string[]}[]} */
export function scanDir(dir, patterns = FORBIDDEN) {
  const hits = [];
  for (const file of walk(dir)) {
    const found = findForbiddenInText(readFileSync(file, 'latin1'), patterns);
    if (found.length > 0) hits.push({ file: relative(dir, file), patterns: found });
  }
  return hits;
}
