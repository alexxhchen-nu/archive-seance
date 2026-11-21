import { readFileSync } from 'node:fs';
import * as legacy from 'pdfjs-dist/legacy/build/pdf.mjs';
import { openPdf } from '../../src/pdf/openPdf';
import type { OpenedPdf, PdfjsLike } from '../../src/pdf/openPdf';
import { DEFAULTS } from '../../src/config/defaults';
import expected from '../fixtures/fixtures.expected.json';

export const pdfjsNode = legacy as unknown as PdfjsLike;
export type FixtureName = keyof typeof expected;
export const FIXTURES = Object.keys(expected) as FixtureName[];
export { expected };

export function fixtureBytes(name: string): Uint8Array {
  return new Uint8Array(readFileSync(`test/fixtures/${name}`));
}

export function openFixture(name: string, cfg = DEFAULTS): Promise<OpenedPdf> {
  return openPdf(fixtureBytes(name), cfg, pdfjsNode);
}
