import type { EntityScore, Score } from './score';
import type { EvalMode } from './predictions';

/** Row labels of the measurement table in docs/EVAL.md, per mode. */
export const EVAL_ROWS = {
  'local-only': {
    accuracy: ['Entity precision / recall (local)', 'Relation precision / recall (local)'],
    timing: 'Wall-clock, local-only run'
  },
  'cloud-enabled': {
    accuracy: ['Entity and relation precision / recall (cloud-enabled)'],
    timing: 'Wall-clock, cloud-enabled run'
  }
} as const;

export interface RowMeta { fixtureId: string; date: string; machine: string; gitSha: string }

/** Calendar date in America/Chicago (YYYY-MM-DD) for an ISO timestamp. */
export function dateInChicago(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) throw new Error(`invalid timestamp: ${iso}`);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

const pct = (v: number | null): string => (v === null ? 'n/a' : v.toFixed(3));
const pr = (s: Score): string => `P ${pct(s.precision)} / R ${pct(s.recall)} (tp ${s.tp}, fp ${s.fp}, fn ${s.fn})`;
const cell = (s: string): string => s.replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();

/** Values for each row label to write, computed only from the given scores and timing. */
export function rowValues(mode: EvalMode, s: { entities: EntityScore; relations: Score }, wallClockMs: number | null): Map<string, string> {
  const out = new Map<string, string>();
  if (mode === 'local-only') {
    out.set(EVAL_ROWS[mode].accuracy[0], pr(s.entities));
    out.set(EVAL_ROWS[mode].accuracy[1], pr(s.relations));
  } else {
    out.set(EVAL_ROWS[mode].accuracy[0], `entities ${pr(s.entities)}; relations ${pr(s.relations)}`);
  }
  if (wallClockMs !== null) out.set(EVAL_ROWS[mode].timing, `${Math.round(wallClockMs)} ms`);
  return out;
}

/**
 * Replaces the table rows whose first cell matches a key of `values`; all other lines are kept byte for byte.
 * Throws if a target row is missing, so nothing is appended or duplicated.
 */
export function rewriteEvalRows(md: string, values: ReadonlyMap<string, string>, meta: RowMeta): string {
  const found = new Set<string>();
  const lines = md.split('\n').map((line) => {
    const m = /^\|\s*([^|]+?)\s*\|/.exec(line);
    const label = m?.[1];
    if (label === undefined || !values.has(label)) return line;
    found.add(label);
    const cells = [label, values.get(label) ?? '', meta.fixtureId, meta.date, meta.machine, meta.gitSha].map(cell);
    return `| ${cells.join(' | ')} |`;
  });
  const missing = [...values.keys()].filter((k) => !found.has(k));
  if (missing.length > 0) throw new Error(`docs/EVAL.md is missing table row(s): ${missing.join(', ')}`);
  return lines.join('\n');
}
