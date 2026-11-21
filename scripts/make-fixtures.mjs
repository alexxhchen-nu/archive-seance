// Writes the synthetic fixture PDFs in test/fixtures/. Deterministic, no dependencies.
// Usage: node scripts/make-fixtures.mjs
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'test', 'fixtures');

const esc = (s) => s.replace(/[\\()]/g, (c) => '\\' + c);

/** One BT/Tj/ET block per line so pdf.js reports separate items (exercises hasEOL and gap joining). */
function textStream(lines) {
  let y = 760;
  const ops = [];
  for (const line of lines) {
    if (line !== '') ops.push(`BT /F1 11 Tf 1 0 0 1 56 ${y} Tm (${esc(line)}) Tj ET`);
    y -= 16;
  }
  return ops.join('\n');
}

function buildPdf(pageStreams) {
  const objs = [];
  const n = pageStreams.length;
  // 1 catalog, 2 pages, 3 font, then per page: page object, content stream.
  const kids = pageStreams.map((_, i) => `${4 + i * 2} 0 R`).join(' ');
  objs.push('<< /Type /Catalog /Pages 2 0 R >>');
  objs.push(`<< /Type /Pages /Kids [${kids}] /Count ${n} >>`);
  objs.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  pageStreams.forEach((s, i) => {
    objs.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + i * 2} 0 R >>`);
    objs.push(`<< /Length ${Buffer.byteLength(s, 'latin1')} >>\nstream\n${s}\nendstream`);
  });
  let out = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  const offsets = [];
  objs.forEach((o, i) => {
    offsets.push(Buffer.byteLength(out, 'latin1'));
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out, 'latin1');
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) out += `${String(off).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

const harbor = [
  [
    'Harbor Lantern Society - Minutes of the Autumn Meeting',
    '',
    'The meeting was called to order by Marta Quill at seven in the evening.',
    'Mr. Edric Fenwick read the minutes of the previous session, which were',
    'approved without amendment. Dr. Ilsa Moorcroft reported that the lantern',
    'on the east pier had been repaired by the Northgate Rope Company.',
    '1. The treasurer presented the accounts for the quarter.',
    'Members thanked Mr. Fenwick for his careful work on the ledger.'
  ],
  [
    'Old Business',
    '',
    'Marta Quill noted that the Society had written twice to the Northgate Rope',
    'Company about the frayed mooring lines near the old customs shed, and that',
    'after a long exchange of letters, several visits to the yard, a disagreement',
    'over the cost of hemp versus manila, and a promise from the foreman that the',
    'work would be finished before the first frost, the company had at last agreed',
    'to replace every line on the north and east piers at no extra charge to members.',
    'Dr. Moorcroft asked that the agreement be recorded in full.'
  ],
  [
    'New Business',
    '',
    'Edric Fenwick proposed a winter lantern walk along the harbor wall.',
    'The proposal was seconded by Dr. Moorcroft and carried unanimously.',
    'Mr. Tobias Wren offered to print notices for the walk at his own expense.',
    'The meeting was adjourned at half past eight. The next meeting will be',
    'held at the Society hall on the first Tuesday of the month.'
  ]
];

const mixed = [
  textStream([
    'Harbor Lantern Society - Inventory Notes',
    'Marta Quill counted twelve brass lanterns in the storeroom.',
    'Two of them need new glass before the winter walk.'
  ]),
  // Page 2 draws only a rectangle and a line: no text operators, like a scanned page.
  '0.2 w 72 600 468 120 re S 72 560 m 540 560 l S',
  textStream([
    'Edric Fenwick will order the glass from a supplier in Northgate.',
    'The order is expected to arrive within three weeks.'
  ])
];

writeFileSync(join(outDir, 'harbor-lantern-minutes.pdf'), buildPdf(harbor.map(textStream)));
writeFileSync(join(outDir, 'mixed-scanned.pdf'), buildPdf(mixed));
console.log('wrote harbor-lantern-minutes.pdf, mixed-scanned.pdf');
