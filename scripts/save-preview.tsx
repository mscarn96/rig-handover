// Plan morning-digest § 3/§ 4: save one rig page as a single self-contained HTML file.
// Usage: tsx --env-file-if-exists=.env scripts/save-preview.tsx <path> <out.html>
// Unset the marker for § 4 with LANE_MARKER= in front (an env var set in the shell wins over .env).
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { createApp } from '../src/app.js';

const [path = '/digest/2026-10-28', out = 'var/preview/index.html'] = process.argv.slice(2);
const res = await createApp().request(path);
if (res.status !== 200) {
  console.error(`${path} answered ${res.status}`);
  process.exit(1);
}
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, await res.text());
console.log(`saved ${path} -> ${out}`);
