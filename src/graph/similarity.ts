import type { EntityType } from '../types';

export interface NormalizedName {
  tokens: string[];
  /** Person: generational suffix (jr, sr, ii...). Org: stripped legal suffix (inc, ltd...). */
  suffix?: string;
}

const HONORIFICS = new Set(['mr', 'mrs', 'ms', 'dr', 'prof', 'sir', 'hon']);
const PERSON_SUFFIXES = new Set(['jr', 'sr', 'ii', 'iii', 'iv']);
const ORG_SUFFIXES = new Set(['inc', 'llc', 'ltd', 'corp', 'co', 'company', 'plc', 'the']);
const INITIALISM_STOPWORDS = new Set(['of', 'and', 'for', 'the', 'de', 'du']);

export function normalizeName(s: string, type: EntityType = 'person'): NormalizedName {
  const words = s
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/['\u2019`]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .split(' ')
    .filter((w) => w.length > 0);
  if (type === 'org') {
    const stripped = words.filter((w) => !ORG_SUFFIXES.has(w));
    const legal = words.filter((w) => ORG_SUFFIXES.has(w) && w !== 'the');
    return legal.length > 0 ? { tokens: stripped, suffix: legal.join(' ') } : { tokens: stripped };
  }
  const tokens = words.filter((w) => !HONORIFICS.has(w));
  const suffixes = tokens.filter((w, i) => i > 0 && PERSON_SUFFIXES.has(w));
  const rest = tokens.filter((w, i) => !(i > 0 && PERSON_SUFFIXES.has(w)));
  return suffixes.length > 0 ? { tokens: rest, suffix: suffixes.join(' ') } : { tokens: rest };
}

function jaro(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;
  const window = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const aHit = new Array<boolean>(a.length).fill(false);
  const bHit = new Array<boolean>(b.length).fill(false);
  let m = 0;
  for (let i = 0; i < a.length; i++) {
    const lo = Math.max(0, i - window);
    const hi = Math.min(b.length - 1, i + window);
    for (let j = lo; j <= hi; j++) {
      if (!bHit[j] && a[i] === b[j]) {
        aHit[i] = bHit[j] = true;
        m++;
        break;
      }
    }
  }
  if (m === 0) return 0;
  let t = 0;
  let k = 0;
  for (let i = 0; i < a.length; i++) {
    if (!aHit[i]) continue;
    while (!bHit[k]) k++;
    if (a[i] !== b[k]) t++;
    k++;
  }
  return (m / a.length + m / b.length + (m - t / 2) / m) / 3;
}

/** Jaro-Winkler (p = 0.1, prefix up to 4). Arguments are ordered first so the greedy match is symmetric. */
export function jaroWinkler(x: string, y: string): number {
  const [a, b] = x <= y ? [x, y] : [y, x];
  const j = jaro(a, b);
  let l = 0;
  while (l < 4 && l < a.length && l < b.length && a[l] === b[l]) l++;
  return j + l * 0.1 * (1 - j);
}

const full = (n: NormalizedName) => n.tokens.join(' ');
const sameTokens = (a: string[], b: string[]) => a.length === b.length && a.every((t, i) => t === b[i]);

function initialisms(tokens: string[]): string[] {
  const all = tokens.map((t) => t[0]).join('');
  const content = tokens.filter((t) => !INITIALISM_STOPWORDS.has(t)).map((t) => t[0]).join('');
  return [all, content];
}

function isInitialismOf(short: string[], long: string[]): boolean {
  const only = short.length === 1 ? (short[0] ?? '') : '';
  return only.length >= 2 && long.length >= 2 && initialisms(long).includes(only);
}

function personScore(a: NormalizedName, b: NormalizedName): number {
  const [ta, tb] = [a.tokens, b.tokens];
  if (sameTokens(ta, tb)) return 1;
  if (ta.length === 0 || tb.length === 0) return jaroWinkler(full(a), full(b));
  const sameSurname = ta[ta.length - 1] === tb[tb.length - 1];
  if (sameSurname && ta.length >= 2 && tb.length >= 2) {
    const [fa, fb] = [ta[0] ?? '', tb[0] ?? ''];
    if ((fa.length === 1 || fb.length === 1) && fa[0] === fb[0]) return 0.88;
    if (fa.length > 1 && fb.length > 1) {
      return jaroWinkler(fa, fb) >= 0.9 ? jaroWinkler(full(a), full(b)) : 0.35;
    }
  }
  // Surname-only applies only when the lone token is the other side's surname.
  if (sameSurname && (ta.length === 1) !== (tb.length === 1)) return 0.62;
  return jaroWinkler(full(a), full(b));
}

function orgScore(a: NormalizedName, b: NormalizedName): number {
  if (sameTokens(a.tokens, b.tokens)) return 0.97;
  if (isInitialismOf(a.tokens, b.tokens) || isInitialismOf(b.tokens, a.tokens)) return 0.8;
  return jaroWinkler(full(a), full(b));
}

export function nameScore(a: NormalizedName, b: NormalizedName, type: EntityType): number {
  return type === 'org' ? orgScore(a, b) : personScore(a, b);
}

export function contextScore(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  if (a.size === 0 || b.size === 0) return 0.5;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}
