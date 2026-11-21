import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { scanDir } from '../../../scripts/lib/bundleScan.mjs';

const forbidden = ['re' + 'captcha', 'api.js'].join('/');

describe('bundleScan', () => {
  let dir = '';
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('finds forbidden strings in nested files and passes clean dirs', () => {
    dir = mkdtempSync(join(tmpdir(), 'rhc-'));
    mkdirSync(join(dir, 'chunks'));
    writeFileSync(join(dir, 'a.js'), 'console.log(1)');
    expect(scanDir(dir)).toEqual([]);
    writeFileSync(join(dir, 'chunks', 'b.js'), `load("https://www.google.com/${forbidden}")`);
    expect(scanDir(dir)).toEqual([{ file: join('chunks', 'b.js'), patterns: [forbidden] }]);
  });
});
