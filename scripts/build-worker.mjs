import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const root = process.cwd();
const indexPath = resolve(root, 'dist/index.html');
let html = await readFile(indexPath, 'utf8');

const scriptMatch = html.match(/<script\s+type="module"[^>]*src="([^"]+)"[^>]*><\/script>/i);
const styleMatch = html.match(/<link\s+rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/i);

if (!scriptMatch || !styleMatch) throw new Error('Build assets were not found in dist/index.html');

const assetPath = (value) => resolve(root, 'dist', value.replace(/^\.\//, '').replace(/^\//, ''));
const [javascript, css] = await Promise.all([
  readFile(assetPath(scriptMatch[1]), 'utf8'),
  readFile(assetPath(styleMatch[1]), 'utf8'),
]);

html = html
  .replace(styleMatch[0], `<style>${css}</style>`)
  .replace(scriptMatch[0], `<script type="module">${javascript}</script>`);

const workerSource = `const HTML=${JSON.stringify(html)};
export default {
  async fetch(request) {
    const url = new URL(request.url);
    const acceptsHtml = request.headers.get('accept')?.includes('text/html');
    const hasExtension = /\\.[a-z0-9]+$/i.test(url.pathname);
    if (url.pathname === '/' || (acceptsHtml && !hasExtension)) {
      return new Response(HTML, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache' } });
    }
    return new Response('Not found', { status: 404 });
  }
};
`;

const output = resolve(root, 'dist/server/index.js');
await mkdir(dirname(output), { recursive: true });
await writeFile(output, workerSource, 'utf8');
