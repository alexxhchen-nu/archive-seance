import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pdfjsDataUrls } from '../../src/pdf/pdfjsDataUrls';
import * as legacy from 'pdfjs-dist/legacy/build/pdf.mjs';
import { openPdf } from '../../src/pdf/openPdf';
import type { OpenedPdf, PdfjsLike } from '../../src/pdf/openPdf';
import { DEFAULTS } from '../../src/config/defaults';
import expected from '../fixtures/fixtures.expected.json';

// pdf.js's Node data factory calls fs.readFile(baseUrl + filename) on a string, so a file:// URL
// string would not resolve; use absolute filesystem paths with trailing slashes.
/** pdfjs-dist's standard_fonts/, cmaps/ and wasm/ in node_modules, for the legacy build in tests. */
export const nodeDataUrls = pdfjsDataUrls((p) => resolve('node_modules/pdfjs-dist', p) + '/', '');

export const pdfjsNode = legacy as unknown as PdfjsLike;
export type FixtureName = keyof typeof expected;
export const FIXTURES = Object.keys(expected) as FixtureName[];
export { expected };

export function fixtureBytes(name: string): Uint8Array {
  return new Uint8Array(readFileSync(`test/fixtures/${name}`));
}

export function openFixture(name: string, cfg = DEFAULTS): Promise<OpenedPdf> {
  return openPdf(fixtureBytes(name), cfg, pdfjsNode, nodeDataUrls);
}
