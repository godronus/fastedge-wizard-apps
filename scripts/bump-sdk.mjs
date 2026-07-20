/**
 * Bumps the @gcore/fastedge-wizard-sdk dependency ref across package.json files
 * and normalises them all to the canonical `github:` form (also converts any
 * stray `file:` refs). Verifies the ref actually exists on the SDK repo before
 * writing, so a typo (e.g. `#0.0.1` when the tag is `v0.0.1`) aborts instead of
 * committing pins that fail to install.
 *
 *   node scripts/bump-sdk.mjs <ref> [--all] [--dry-run] [--no-verify]
 *
 *   <ref>         tag/branch on the SDK repo, e.g. v0.0.1
 *   (default)     root package.json + underscore wizards (_template, _example…)
 *   --all         also bump real wizards (normally pinned to their tested ref)
 *   --dry-run     print changes, write nothing
 *   --no-verify   skip the ls-remote existence check
 *   --selftest    run the transform's assertions and exit
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SLUG = 'G-Core/fastedge-wizard-sdk';
const SDK_URL = `https://github.com/${SLUG}.git`;
const DEP = '@gcore/fastedge-wizard-sdk';
const DEP_RE = /("@gcore\/fastedge-wizard-sdk":\s*)"[^"]*"/;

const root = fileURLToPath(new URL('..', import.meta.url));

/** Swap the SDK dep value in a package.json's raw text. Returns null if absent. */
function bumpText(text, ref) {
  if (!DEP_RE.test(text)) return null;
  return text.replace(DEP_RE, `$1"github:${SLUG}#${ref}"`);
}

function selfTest() {
  const gh = '{\n    "@gcore/fastedge-wizard-sdk": "github:G-Core/fastedge-wizard-sdk#0.0.1"\n}';
  const file = '{\n    "@gcore/fastedge-wizard-sdk": "file:../../../../fastedge-wizard-sdk"\n}';
  const want = '"github:G-Core/fastedge-wizard-sdk#v0.0.1"';
  console.assert(bumpText(gh, 'v0.0.1').includes(want), 'github ref not bumped');
  console.assert(bumpText(file, 'v0.0.1').includes(want), 'file ref not converted');
  console.assert(bumpText('{"react":"19"}', 'v0.0.1') === null, 'missing dep not null');
  console.log('selftest ok');
}

const args = process.argv.slice(2);
if (args.includes('--selftest')) { selfTest(); process.exit(0); }

const flags = new Set(args.filter(a => a.startsWith('--')));
const ref = args.find(a => !a.startsWith('--'));
if (!ref) {
  console.error('usage: node scripts/bump-sdk.mjs <ref> [--all] [--dry-run] [--no-verify]');
  process.exit(1);
}

// Verify the ref resolves on the SDK repo before touching anything.
if (!flags.has('--no-verify')) {
  const refs = execSync(`git ls-remote --tags --heads ${SDK_URL}`, { encoding: 'utf8' });
  const names = refs.split('\n').map(l => l.split('\t')[1]).filter(Boolean);
  const found = names.includes(`refs/tags/${ref}`) || names.includes(`refs/heads/${ref}`);
  if (!found) {
    console.error(`✗ ref "${ref}" not found on ${SLUG}. Available:`);
    for (const n of names) console.error(`    ${n.replace(/^refs\/(tags|heads)\//, '')}`);
    process.exit(1);
  }
}

// Build the target file list.
const targets = [join(root, 'package.json')];
for (const e of readdirSync(join(root, 'wizards'), { withFileTypes: true })) {
  if (!e.isDirectory() || e.name.startsWith('.')) continue;
  const isTemplate = e.name.startsWith('_');
  if (isTemplate || flags.has('--all')) targets.push(join(root, 'wizards', e.name, 'package.json'));
}

const dry = flags.has('--dry-run');
let changed = 0;
for (const file of targets) {
  if (!existsSync(file)) continue;
  const before = readFileSync(file, 'utf8');
  const after = bumpText(before, ref);
  const rel = file.slice(root.length);
  if (after === null) { console.log(`  skip  ${rel} (no ${DEP})`); continue; }
  if (after === before) { console.log(`  ok    ${rel} (already #${ref})`); continue; }
  if (!dry) writeFileSync(file, after);
  console.log(`  ${dry ? 'would' : 'bump '} ${rel} → #${ref}`);
  changed++;
}

console.log(`\n${dry ? '[dry-run] ' : ''}${changed} file(s) ${dry ? 'would change' : 'changed'}`);
if (changed && !dry) console.log('→ run `pnpm install` (root, and any bumped wizard) to refresh lockfiles');
