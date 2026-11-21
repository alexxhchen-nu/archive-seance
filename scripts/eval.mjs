#!/usr/bin/env node
// Measured eval entry (R17). Order: R17.1a review gate first, then --predictions is required,
// then the predictions file is validated (fixture, schema, mock-build refusal), then scored with
// src/eval/score.ts and only the matching rows of docs/EVAL.md are rewritten (R17.2, R17.3).
// The model only runs inside Chrome; this script never calls one. Predictions come from the
// extension's "Export eval run" button.
import { readFileSync, writeFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { parseArgs } from 'node:util';

// src/ uses extensionless relative imports (Vite style); resolve them to .ts for Node type stripping.
registerHooks({
  resolve(specifier, context, next) {
    try {
      return next(specifier, context);
    } catch (e) {
      if (/^\.\.?\//.test(specifier)) {
        for (const ext of ['.ts', '/index.ts']) {
          try { return next(specifier + ext, context); } catch { /* try next */ }
        }
      }
      throw e;
    }
  }
});

const GOLD_PATH = process.env.EVAL_GOLD_PATH || 'test/fixtures/eval/nhprc-2015-11/gold.json';
const EVAL_MD = process.env.EVAL_MD_PATH || 'docs/EVAL.md';

const { isGoldReviewed, UNREVIEWED_REFUSAL } = await import('../src/eval/reviewGate.ts');

const gold = JSON.parse(readFileSync(GOLD_PATH, 'utf8'));
if (!isGoldReviewed(gold)) {
  console.error(UNREVIEWED_REFUSAL);
  process.exit(1);
}

let args;
try {
  args = parseArgs({ options: { predictions: { type: 'string' }, machine: { type: 'string' } } }).values;
} catch (e) {
  console.error(`npm run eval: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(2);
}

if (!args.predictions) {
  console.error(
    'No predictions file given. Open the real (non-mock) extension build, open pages 1–2 of the NHPRC PDF, ' +
    'click "Export eval run" in the probe panel, then rerun: npm run eval -- --predictions <file> --machine "<name>". ' +
    `See "How to measure" in docs/EVAL.md. ${EVAL_MD} was not changed and no accuracy numbers were written.`
  );
  process.exit(2);
}

const { validatePredictions, scorePredictions } = await import('../src/eval/predictions.ts');
const { rewriteEvalRows, rowValues, dateInChicago } = await import('../src/eval/evalDoc.ts');

let raw;
try {
  raw = JSON.parse(readFileSync(args.predictions, 'utf8'));
} catch (e) {
  console.error(`Could not read predictions file ${args.predictions}: ${e instanceof Error ? e.message : String(e)}. ${EVAL_MD} was not changed.`);
  process.exit(3);
}
const v = validatePredictions(raw, gold.fixtureId);
if (!v.ok) {
  console.error(`Invalid predictions file: ${v.error}. ${EVAL_MD} was not changed and no accuracy numbers were written.`);
  process.exit(v.mock ? 4 : 3);
}

const p = v.value;
const scores = scorePredictions(gold, p);
const values = rowValues(p.mode, scores, p.wallClockMs);
const meta = {
  fixtureId: p.fixtureId,
  date: dateInChicago(p.timestamp),
  machine: args.machine?.trim() || 'unspecified',
  gitSha: p.build.gitSha || 'unknown'
};
let next;
try {
  next = rewriteEvalRows(readFileSync(EVAL_MD, 'utf8'), values, meta);
} catch (e) {
  console.error(`${e instanceof Error ? e.message : String(e)}. ${EVAL_MD} was not changed.`);
  process.exit(3);
}
writeFileSync(EVAL_MD, next);
for (const [k, val] of values) console.log(`${k}: ${val}`);
console.log(`Updated ${values.size} row(s) of ${EVAL_MD} for mode ${p.mode}.`);
