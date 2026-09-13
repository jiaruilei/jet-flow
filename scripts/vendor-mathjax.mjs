import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const require = createRequire(import.meta.url);
const mathjaxManifest = require.resolve('mathjax/package.json');
const mathjaxRoot = dirname(mathjaxManifest);
const fontRoot = dirname(createRequire(mathjaxManifest).resolve('@mathjax/mathjax-newcm-font/package.json'));
const vendor = join(root, 'vendor', 'mathjax');
const fonts = join(vendor, 'fonts', 'mathjax-newcm-font');
await mkdir(fonts, { recursive: true });

// Browser components, accessibility support, and fonts for both renderers.
// CHTML is the default; the MathJax menu can also switch to SVG.
for (const name of ['tex-chtml.js', 'core.js', 'loader.js', 'startup.js', 'input', 'output', 'ui', 'a11y', 'sre', 'LICENSE']) {
  await cp(join(mathjaxRoot, name), join(vendor, name), { recursive: true });
}
for (const name of ['chtml', 'chtml.js', 'svg', 'svg.js']) {
  await cp(join(fontRoot, name), join(fonts, name), { recursive: true });
}
const mathjax = JSON.parse(await readFile(mathjaxManifest, 'utf8'));
const font = JSON.parse(await readFile(join(fontRoot, 'package.json'), 'utf8'));
await writeFile(join(vendor, 'VERSION.json'), JSON.stringify({ mathjax: mathjax.version, font: { name: font.name, version: font.version } }, null, 2) + '\n');
console.log(`Prepared MathJax ${mathjax.version} and ${font.name} ${font.version} for static hosting.`);
