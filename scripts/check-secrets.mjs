#!/usr/bin/env node
// Fails (exit 1) if tracked or untracked-not-ignored files, or git history, contain secret-shaped values.
// Prints locations only, never the matched text.
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { gitignoreIgnoresKiro, isForbiddenTrackedPath, scanGitLog, scanText } from './lib/secretPatterns.mjs';

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_LOG_BYTES = 64 * 1024 * 1024;

const git = (args, maxBuffer = 16 * 1024 * 1024) => execFileSync('git', args, { encoding: 'utf8', maxBuffer });
const list = (args) => git(args).split('\n').filter(Boolean);

const findings = [];
const tracked = list(['ls-files']);
const untracked = list(['ls-files', '-o', '--exclude-standard']);

for (const p of tracked) if (isForbiddenTrackedPath(p)) findings.push(`${p}: tracked env file`);

for (const p of [...new Set([...tracked, ...untracked])]) {
  let text;
  try {
    if (statSync(p).size > MAX_FILE_BYTES) continue;
    text = readFileSync(p, 'utf8');
  } catch {
    continue;
  }
  if (p === '.gitignore' && gitignoreIgnoresKiro(text)) findings.push('.gitignore: ignores .kiro');
  for (const f of scanText(p, text)) findings.push(`${f.path}:${f.line}: ${f.rule}`);
}

try {
  const log = git(['log', '-p', '--all', '--no-color'], MAX_LOG_BYTES);
  for (const f of scanGitLog(log)) findings.push(`history ${f.commit} ${f.path}: ${f.rule}`);
} catch (e) {
  findings.push(`git history scan failed or exceeded ${MAX_LOG_BYTES} bytes: ${e instanceof Error ? e.name : 'error'}`);
}

if (findings.length > 0) {
  console.error('check-secrets: potential secrets found:');
  for (const f of findings) console.error('  ' + f);
  process.exit(1);
}
console.log(`check-secrets: ok (${tracked.length + untracked.length} files, history scanned)`);
