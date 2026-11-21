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

const HELVETICA = ['<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'];

/** `fontObjs[0]` is the page font /F1 (object 3); later entries are objects it references (4, 5, ...). */
function buildPdf(pageStreams, fontObjs = HELVETICA) {
  const objs = [];
  const n = pageStreams.length;
  const first = 3 + fontObjs.length;
  // 1 catalog, 2 pages, 3.. font objects, then per page: page object, content stream.
  const kids = pageStreams.map((_, i) => `${first + i * 2} 0 R`).join(' ');
  objs.push('<< /Type /Catalog /Pages 2 0 R >>');
  objs.push(`<< /Type /Pages /Kids [${kids}] /Count ${n} >>`);
  objs.push(...fontObjs);
  pageStreams.forEach((s, i) => {
    objs.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${first + 1 + i * 2} 0 R >>`);
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

// Standard 14 Times-Roman, not embedded: pdf.js needs standardFontDataUrl to load a substitute.
const TIMES = ['<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman /Encoding /WinAnsiEncoding >>'];
writeFileSync(join(outDir, 'times-roman-plain.pdf'), buildPdf([textStream(['The Harbor Lantern Society convened at dusk.'])], TIMES));

// Type0 font with a predefined UniGB CMap, no embedded program and no ToUnicode: decoding needs cMapUrl.
const CJK = [
  '<< /Type /Font /Subtype /Type0 /BaseFont /STSong-Light /Encoding /UniGB-UTF16-H /DescendantFonts [4 0 R] >>',
  '<< /Type /Font /Subtype /CIDFontType0 /BaseFont /STSong-Light /CIDSystemInfo << /Registry (Adobe) /Ordering (GB1) /Supplement 0 >> /FontDescriptor 5 0 R /DW 1000 >>',
  '<< /Type /FontDescriptor /FontName /STSong-Light /Flags 6 /FontBBox [-25 -254 1000 880] /ItalicAngle 0 /Ascent 880 /Descent -120 /CapHeight 880 /StemV 93 >>'
];
const utf16hex = (t) => Buffer.from(t, 'utf16le').swap16().toString('hex').toUpperCase();
const cjkLines = ['港湾灯笼 Harbor Lantern Society', '港湾灯笼会议于黄昏召开。', '会员们在东码头点亮了十二盏铜灯。'];
const cjkOps = cjkLines.map((t, k) => `BT /F1 14 Tf 1 0 0 1 56 ${760 - k * 20} Tm <${utf16hex(t)}> Tj ET`).join('\n');
writeFileSync(join(outDir, 'cjk-unigb.pdf'), buildPdf([cjkOps], CJK));
console.log('wrote harbor-lantern-minutes.pdf, mixed-scanned.pdf, times-roman-plain.pdf, cjk-unigb.pdf');
