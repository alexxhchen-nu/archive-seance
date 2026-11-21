#!/usr/bin/env node
// Fetch (or use a local path to) the official NHPRC 2015-11 minutes PDF, check
// its SHA-256 against docs/DEMO_SOURCES.md, and compare this repo's pdf.js
// extraction of pages 1–2 to the committed excerpt in
// test/fixtures/eval/nhprc-2015-11/pages.json. Gold quotes are checked in
// test/unit/eval/nhprcGold.test.ts against that excerpt (no network in CI).
//
// Usage:
//   node scripts/verify-nhprc-eval.mjs
//   node scripts/verify-nhprc-eval.mjs --pdf /path/to/2015-11-minutes.pdf
//   NHPRC_PDF=/path/to/file.pdf node scripts/verify-nhprc-eval.mjs
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const PAGES = 'test/fixtures/eval/nhprc-2015-11/pages.json';
const URL = 'https://www.archives.gov/files/nhprc/about/meetings/2015-11-minutes.pdf';
const EXPECTED = JSON.parse(readFileSync(PAGES, 'utf8'));

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function parsePdfArg(argv) {
  const i = argv.indexOf('--pdf');
  if (i >= 0) return argv[i + 1];
  return process.env.NHPRC_PDF ?? '';
}

async function loadPdf(argv) {
  const local = parsePdfArg(argv);
  if (local) {
    const bytes = new Uint8Array(readFileSync(local));
    return { bytes, origin: local };
  }
  const res = await fetch(URL);
  if (!res.ok) throw new Error(`GET ${URL} failed: ${res.status} ${res.statusText}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  return { bytes, origin: URL };
}

const { bytes, origin } = await loadPdf(process.argv.slice(2));
const hex = sha256(bytes);
if (hex !== EXPECTED.sha256) {
  console.error(`SHA-256 mismatch for ${origin}.\n  expected ${EXPECTED.sha256}\n  got      ${hex}\nThe agency may have replaced the file. Do not overwrite pages.json until you have compared the new text.`);
  process.exit(1);
}
console.log(`SHA-256 matches (${origin}).`);

const dir = mkdtempSync(join(tmpdir(), 'nhprc-eval-'));
const pdfPath = join(dir, 'nhprc-2015-11.pdf');
writeFileSync(pdfPath, bytes);

const r = spawnSync('npx', ['vitest', 'run', 'test/unit/eval/nhprcLiveExtract.test.ts'], {
  stdio: 'inherit',
  env: { ...process.env, NHPRC_PDF: pdfPath }
});
process.exit(r.status === null ? 1 : r.status);
