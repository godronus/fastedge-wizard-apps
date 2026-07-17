/**
 * Copies each wizards/<name>/dist/ into release/<name>/ after all wizard builds complete.
 * Run via: node scripts/assemble.mjs  (or pnpm run assemble from repo root)
 * Skips directories starting with '_' (templates, utilities).
 *
 * Also mirrors what the WASM proxy does at runtime:
 *   1. Injects <link rel="stylesheet" href="/styles/v1/wizard.css"> into each wizard's HTML.
 *   2. Serves that CSS from release/styles/v1/wizard.css so http-server (tests) works.
 * Source priority: SDK's bundled mock-host/wizard.css → CDN.
 */
import { cpSync, mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
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

// ── Portal styles injection ───────────────────────────────────────────────────
// Mirrors what the WASM proxy does: inject the portal CSS link and serve the CSS.

const PORTAL_LINK = '<link rel="stylesheet" href="/styles/v1/wizard.css">';

async function getWizardCSS() {
  // Prefer the SDK's bundled copy (available when SDK >= v0.0.9 is installed)
  for (const name of wizardNames) {
    const p = join(wizardsDir, name, 'node_modules', '@gcore', 'fastedge-wizard-sdk', 'mock-host', 'wizard.css');
    if (existsSync(p)) return readFileSync(p, 'utf8');
  }
  // CDN fallback
  try {
    const res = await fetch('https://wizard-app-4732724.fastedge.cdn.gc.onl/styles/v1/wizard.css');
    if (res.ok) return res.text();
    console.warn(`  warn: CDN returned ${res.status} — portal styles not injected`);
  } catch {
    console.warn('  warn: CDN unreachable — portal styles not injected');
  }
  return null;
}

const wizardCSS = await getWizardCSS();

if (wizardCSS) {
  // Write shared CSS once
  const stylesDir = join(root, 'release', 'styles', 'v1');
  mkdirSync(stylesDir, { recursive: true });
  writeFileSync(join(stylesDir, 'wizard.css'), wizardCSS);

  // Inject <link> before </head> in each wizard's index.html
  for (const name of wizardNames) {
    const htmlPath = join(root, 'release', name, 'index.html');
    if (!existsSync(htmlPath)) continue;
    const html = readFileSync(htmlPath, 'utf8');
    const i = html.indexOf('</head>');
    if (i !== -1) writeFileSync(htmlPath, html.slice(0, i) + PORTAL_LINK + '\n' + html.slice(i));
  }
  console.log('injected portal styles → release/styles/v1/wizard.css');
}
