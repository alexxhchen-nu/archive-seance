import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { sha256Hex } from '../../../src/util/hash';

describe('sha256Hex', () => {
  it('matches known vectors', async () => {
    expect(await sha256Hex(new TextEncoder().encode('abc')))
      .toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(await sha256Hex(new Uint8Array()))
      .toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  it('agrees with node:crypto on a fixture, for Uint8Array and ArrayBuffer', async () => {
    const buf = readFileSync('test/fixtures/mixed-scanned.pdf');
    const want = createHash('sha256').update(buf).digest('hex');
    const u8 = new Uint8Array(buf);
    expect(await sha256Hex(u8)).toBe(want);
    expect(await sha256Hex(u8.slice().buffer)).toBe(want);
  });
});
