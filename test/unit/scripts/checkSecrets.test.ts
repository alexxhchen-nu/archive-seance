import { describe, expect, it } from 'vitest';
import {
  gitignoreIgnoresKiro, isForbiddenTrackedPath, scanGitLog, scanLine, scanText
} from '../../../scripts/lib/secretPatterns.mjs';

// Secret-shaped values are assembled at runtime so none is stored in the repo.
const fakeKey = ['AI', 'za'].join('') + 'x'.repeat(20) + 'Y'.repeat(15);
const fakeUuid = ['1a2b3c4d', 'aaaa', 'bbbb', 'cccc', '0123456789ab'].join('-');
const tokenVar = ['FIREBASE', 'APPCHECK', 'DEBUG', 'TOKEN'].join('_');

describe('secretPatterns', () => {
  it('flags API keys outside env files only', () => {
    expect(scanLine('src/a.ts', `const k = "${fakeKey}";`)).toContain('api-key');
    expect(scanLine('.env.local', `X=${fakeKey}`)).not.toContain('api-key');
  });

  it('flags debug token string literals but not assignments from variables', () => {
    expect(scanLine('src/a.ts', `self.${tokenVar} = "abc"`)).toContain('debug-token-literal');
    expect(scanLine('src/a.ts', `self.${tokenVar} = token || true`)).toEqual([]);
  });

  it('flags UUIDs near token words, except in package-lock.json', () => {
    expect(scanLine('src/a.ts', `debug: ${fakeUuid}`)).toContain('uuid-token');
    expect(scanLine('src/a.ts', `id: ${fakeUuid}`)).toEqual([]);
    expect(scanLine('package-lock.json', `token ${fakeUuid}`)).toEqual([]);
  });

  it('reports line numbers without secret text', () => {
    const hits = scanText('x.ts', `ok\nk=${fakeKey}`);
    expect(hits).toEqual([{ path: 'x.ts', line: 2, rule: 'api-key' }]);
    expect(JSON.stringify(hits)).not.toContain(fakeKey);
  });

  it('checks tracked env paths and .gitignore', () => {
    expect(isForbiddenTrackedPath('.env.local')).toBe(true);
    expect(isForbiddenTrackedPath('.env')).toBe(true);
    expect(isForbiddenTrackedPath('.env.example')).toBe(false);
    expect(isForbiddenTrackedPath('src/environment.ts')).toBe(false);
    expect(gitignoreIgnoresKiro('dist/\n.kiro/\n')).toBe(true);
    expect(gitignoreIgnoresKiro('dist/\n# .kiro\n')).toBe(false);
  });

  it('scans git log output for added and removed lines', () => {
    const log = ['commit 0123456789abcdef', 'diff --git a/s.ts b/s.ts', '+++ b/s.ts', `-k=${fakeKey}`, '+ok'].join('\n');
    expect(scanGitLog(log)).toEqual([{ commit: '0123456789ab', path: 's.ts', rule: 'api-key' }]);
  });
});
