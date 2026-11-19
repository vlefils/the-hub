import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { compile } from 'tailwindcss';

process.chdir(fileURLToPath(new URL('.', import.meta.url)));
const result = await build({
  entryPoints: ['main.tsx'],
  outfile: 'assets/console.js',
  bundle: true,
  format: 'esm',
  jsx: 'automatic',
  minify: true,
  metafile: true,
  define: { 'process.env.NODE_ENV': '"production"' },
  plugins: [{
    name: 'tailwind-preflight',
    setup(builder) {
      builder.onLoad({ filter: /[\\/]tailwindcss[\\/]preflight\.css$/ }, async ({ path: file }) => {
        const css = await compile(await readFile(file, 'utf8'));
        return { contents: css.build([]), loader: 'css' };
      });
    },
  }],
});

const modules = new Set(Object.keys(result.metafile.inputs)
  .map(file => file.match(/^(.*node_modules\/(?:@[^/]+\/)?[^/]+)\//)?.[1]).filter(Boolean));
const notices = [];
for (const dir of [...modules].sort()) {
  const { name, version, license } = JSON.parse(await readFile(path.join(dir, 'package.json'), 'utf8'));
  const files = (await readdir(dir)).filter(file => /^(?:licen[cs]e|notice)(\.|$)/i.test(file)).sort();
  notices.push([name + ' ' + version + ' (' + license + ')',
    ...await Promise.all(files.map(file => readFile(path.join(dir, file), 'utf8')))].join('\n'));
}
await writeFile('assets/THIRD-PARTY.txt', notices.join('\n\n'));
