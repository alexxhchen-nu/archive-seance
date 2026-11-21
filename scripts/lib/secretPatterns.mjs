// Pure secret-pattern matching. Never return matched text, only locations.

export const API_KEY_RE = /AIza[0-9A-Za-z_-]{35}/;
export const DEBUG_TOKEN_LITERAL_RE = /FIREBASE_APPCHECK_DEBUG_TOKEN\s*=\s*["'`][^"'`]/;
export const UUID_RE = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/;
export const UUID_CONTEXT_RE = /debug|token|appcheck/i;
const ENV_PATH_RE = /(^|\/)\.env(\.|$)/;

export function isEnvFile(path) {
  return ENV_PATH_RE.test(path);
}

/** Tracked env files are forbidden except .env.example. */
export function isForbiddenTrackedPath(path) {
  return isEnvFile(path) && !/(^|\/)\.env\.example$/.test(path);
}

export function gitignoreIgnoresKiro(content) {
  return content.split(/\r?\n/).some((l) => {
    const t = l.trim();
    return t !== '' && !t.startsWith('#') && !t.startsWith('!') && /(^|\/)\.kiro/.test(t);
  });
}

/** Returns rule names matched by one line of `path`. */
export function scanLine(path, line) {
  const hits = [];
  const base = path.split('/').pop() ?? path;
  if (!isEnvFile(path) && API_KEY_RE.test(line)) hits.push('api-key');
  if (DEBUG_TOKEN_LITERAL_RE.test(line)) hits.push('debug-token-literal');
  if (base !== 'package-lock.json' && UUID_RE.test(line) && UUID_CONTEXT_RE.test(line)) hits.push('uuid-token');
  return hits;
}

/** @returns {{path:string,line:number,rule:string}[]} */
export function scanText(path, text) {
  const out = [];
  text.split(/\r?\n/).forEach((line, i) => {
    for (const rule of scanLine(path, line)) out.push({ path, line: i + 1, rule });
  });
  return out;
}

/** Scans `git log -p` output; reports commit + file + rule, no content. */
export function scanGitLog(logText) {
  const out = [];
  let commit = '';
  let file = '';
  for (const line of logText.split(/\r?\n/)) {
    if (line.startsWith('commit ')) { commit = line.slice(7, 19); continue; }
    if (line.startsWith('+++ b/')) { file = line.slice(6); continue; }
    if (line.startsWith('diff --git ')) {
      const m = / b\/(.+)$/.exec(line);
      file = m?.[1] ?? file;
      continue;
    }
    if ((line.startsWith('+') || line.startsWith('-')) && !line.startsWith('+++') && !line.startsWith('---')) {
      for (const rule of scanLine(file, line.slice(1))) out.push({ commit, path: file, rule });
    }
  }
  return out;
}
