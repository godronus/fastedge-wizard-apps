/**
 * Copies each wizards/<name>/dist/ and packages/<name>/dist/ into release/<name>/.
 * Run via: node scripts/assemble.mjs  (or pnpm run assemble from repo root)
 * Skips directories starting with '_' (templates, utilities).
 */
import { cpSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

async function assembleDirs(sourceDir, label) {
  if (!existsSync(sourceDir)) return 0;
  const entries = await readdir(sourceDir, { withFileTypes: true });
  const names = entries
    .filter(e => e.isDirectory() && !e.name.startsWith('_') && !e.name.startsWith('.'))
    .map(e => e.name)
    .filter(name => existsSync(join(sourceDir, name, 'dist')));

  for (const name of names) {
    const src  = join(sourceDir, name, 'dist');
    const dest = join(root, 'release', name);
    rmSync(dest, { recursive: true, force: true });
    mkdirSync(dest, { recursive: true });
    cpSync(src, dest, { recursive: true });
    console.log(`  ${label}/${name}/dist  →  release/${name}/`);
  }
  return names.length;
}

const nWizards  = await assembleDirs(join(root, 'wizards'),  'wizards');
const nPackages = await assembleDirs(join(root, 'packages'), 'packages');
const total = nWizards + nPackages;

if (total === 0) {
  console.error('assemble: no dist/ directories found — run the build first');
  process.exit(1);
}

console.log(`\nassembled ${total} dir(s) into release/ (${nWizards} wizard(s), ${nPackages} package(s))`);
