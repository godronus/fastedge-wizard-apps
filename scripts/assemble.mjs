/**
 * Copies each wizards/<name>/dist/ into release/<name>/ after all wizard builds complete.
 * Run via: node scripts/assemble.mjs  (or pnpm run assemble from repo root)
 * Skips directories starting with '_' (templates, utilities).
 */
import { cpSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const wizardsDir = join(root, 'wizards');

const entries = await readdir(wizardsDir, { withFileTypes: true });

const wizardNames = entries
  .filter(e => e.isDirectory() && !e.name.startsWith('_') && !e.name.startsWith('.'))
  .map(e => e.name)
  .filter(name => existsSync(join(wizardsDir, name, 'dist')));

if (wizardNames.length === 0) {
  console.error('assemble: no wizard dist/ directories found — run pnpm -r run build first');
  process.exit(1);
}

for (const name of wizardNames) {
  const src = join(wizardsDir, name, 'dist');
  const dest = join(root, 'release', name);
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(dest, { recursive: true });
  cpSync(src, dest, { recursive: true });
  console.log(`  wizards/${name}/dist  →  release/${name}/`);
}

console.log(`\nassembled ${wizardNames.length} wizard(s) into release/`);
