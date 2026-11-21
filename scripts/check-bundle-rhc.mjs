#!/usr/bin/env node
// Fails if the build output references remotely hosted reCAPTCHA / gapi scripts (MV3 remote-code rule).
import { existsSync } from 'node:fs';
import { scanDir } from './lib/bundleScan.mjs';

const args = process.argv.slice(2);
const allowMissing = args.includes('--allow-missing');
const dir = args.find((a) => !a.startsWith('--')) ?? 'dist';

if (!existsSync(dir)) {
  console.log(`check-bundle-rhc: ${dir} does not exist`);
  process.exit(allowMissing ? 0 : 1);
}
const hits = scanDir(dir);
if (hits.length > 0) {
  console.error('check-bundle-rhc: remote code references found:');
  for (const h of hits) console.error(`  ${h.file}: ${h.patterns.join(', ')}`);
  process.exit(1);
}
console.log(`check-bundle-rhc: ok (${dir})`);
