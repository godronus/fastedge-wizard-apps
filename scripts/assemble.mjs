/**
 * Copies each <wizard>/dist/ into public/<wizard>/ after all wizard builds complete.
 * Run via: node scripts/assemble.mjs  (or pnpm run assemble from repo root)
 */
import { cpSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

const EXCLUDED = new Set([
  'packages', 'scripts', 'release', 'node_modules', '.github', 'context',
]);

const entries = await readdir(root, { withFileTypes: true });

const wizardNames = entries
  .filter(e => e.isDirectory() && !EXCLUDED.has(e.name) && !e.name.startsWith('.'))
  .map(e => e.name)
  .filter(name => existsSync(join(root, name, 'dist')));

if (wizardNames.length === 0) {
  console.error('assemble: no wizard dist/ directories found — run pnpm -r run build first');
  process.exit(1);
}

for (const name of wizardNames) {
  const src = join(root, name, 'dist');
  const dest = join(root, 'release', name);
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(dest, { recursive: true });
  cpSync(src, dest, { recursive: true });
  console.log(`  ${name}/dist  →  release/${name}/`);
}

console.log(`\nassembled ${wizardNames.length} wizard(s) into release/`);
