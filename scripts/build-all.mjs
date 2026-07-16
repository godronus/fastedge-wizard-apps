/**
 * Builds every wizard under wizards/ in isolation.
 * Each wizard manages its own deps and package manager — this script detects
 * the lockfile and runs the appropriate install + build.
 * Skips directories starting with '_' (templates, utilities).
 */
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const wizardsDir = join(root, 'wizards');
const CI = !!process.env.CI;

const entries = await readdir(wizardsDir, { withFileTypes: true });
const wizards = entries
  .filter(e => e.isDirectory() && !e.name.startsWith('_') && !e.name.startsWith('.'))
  .map(e => e.name);

if (wizards.length === 0) {
  console.error('build-all: no wizards found in wizards/');
  process.exit(1);
}

for (const name of wizards) {
  const dir = join(wizardsDir, name);
  console.log(`\n▶ wizards/${name}`);

  const installCmd =
    existsSync(join(dir, 'pnpm-lock.yaml'))    ? `pnpm install${CI ? ' --frozen-lockfile' : ''}` :
    existsSync(join(dir, 'yarn.lock'))          ? `yarn install${CI ? ' --frozen-lockfile' : ''}` :
    existsSync(join(dir, 'bun.lockb'))          ? `bun install${CI ? ' --frozen-lockfile' : ''}` :
    existsSync(join(dir, 'package-lock.json'))  ? (CI ? 'npm ci' : 'npm install') :
                                                  'npm install';

  execSync(installCmd, { cwd: dir, stdio: 'inherit' });
  execSync('npm run build --silent', { cwd: dir, stdio: 'inherit' });
}

console.log(`\n✓ Built ${wizards.length} wizard(s)`);
