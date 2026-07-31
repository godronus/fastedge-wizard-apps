/**
 * Builds the wizard-step-kit example page into dist/.
 * Consumer wizards do NOT run this — they bundle src/ via their own esbuild.
 */
import { build } from 'esbuild';
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));

rmSync(join(root, 'dist'), { recursive: true, force: true });
mkdirSync(join(root, 'dist'), { recursive: true });

await build({
    entryPoints: [join(root, 'example/main.js')],
    bundle: true,
    format: 'esm',
    outfile: join(root, 'dist/main.js'),
    minify: false,
});

cpSync(join(root, 'example/index.html'),  join(root, 'dist/index.html'));
cpSync(join(root, 'example/styles.css'),  join(root, 'dist/example.css'));
cpSync(join(root, 'src/styles.css'),      join(root, 'dist/styles.css'));

console.log('wizard-step-kit: built dist/');
