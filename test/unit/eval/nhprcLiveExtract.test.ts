import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { DEFAULTS } from '../../../src/config/defaults';
import { buildPageIndex } from '../../../src/pdf/pageIndex';
import { openPdf } from '../../../src/pdf/openPdf';
import { pdfjsNode, nodeDataUrls } from '../../helpers/fixtures';

/**
 * Live comparison of the official PDF against the committed page excerpt.
 * Skipped unless NHPRC_PDF is set (see scripts/verify-nhprc-eval.mjs). CI does not fetch the PDF.
 */
const pdfPath = process.env.NHPRC_PDF;
const pages = JSON.parse(readFileSync('test/fixtures/eval/nhprc-2015-11/pages.json', 'utf8')) as {
  sha256: string;
  text: Record<string, string>;
};

describe.skipIf(!pdfPath)('NHPRC official PDF vs committed page excerpt', () => {
  it('pages 1–2 extracted by this repo match pages.json', async () => {
    const bytes = new Uint8Array(readFileSync(pdfPath as string));
    const sha = createHash('sha256').update(bytes).digest('hex');
    expect(sha).toBe(pages.sha256);
    const doc = await openPdf(bytes, DEFAULTS, pdfjsNode, nodeDataUrls);
    const index = await buildPageIndex(doc, sha, DEFAULTS);
    await doc.destroy();
    expect(index[0]?.text).toBe(pages.text['1']);
    expect(index[1]?.text).toBe(pages.text['2']);
  });
});
