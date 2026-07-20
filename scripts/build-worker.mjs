import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
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

const inlineJavascript = javascript.replace(/<\/script/gi, '<\\/script');
const inlineCss = css.replace(/<\/style/gi, '<\\/style');

html = html
  .replace(styleMatch[0], () => `<style>${inlineCss}</style>`)
  .replace(scriptMatch[0], () => `<script type="module">${inlineJavascript}</script>`);

const workerSource = `const HTML=${JSON.stringify(html)};
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const acceptsHtml = request.headers.get('accept')?.includes('text/html');
    const hasExtension = /\\.[a-z0-9]+$/i.test(url.pathname);
    if (url.pathname === '/' || (acceptsHtml && !hasExtension)) {
      return new Response(HTML, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache' } });
    }
    if (env?.ASSETS?.fetch) {
      const response = await env.ASSETS.fetch(request);
      if (response.status !== 404) return response;
    }
    return new Response('Not found', { status: 404 });
  }
};
`;

const output = resolve(root, 'dist/server/index.js');
await mkdir(dirname(output), { recursive: true });
await writeFile(output, workerSource, 'utf8');

const hostingOutput = resolve(root, 'dist/.openai/hosting.json');
await mkdir(dirname(hostingOutput), { recursive: true });
await writeFile(hostingOutput, await readFile(resolve(root, '.openai/hosting.json')));

// Sites exposes static files from the Cloudflare/Vite client directory.
// Move Vite's public payload after the executable JS and CSS are inlined.
const clientOutput = resolve(root, 'dist/client');
await rm(clientOutput, { recursive: true, force: true });
await mkdir(clientOutput, { recursive: true });
await rename(resolve(root, 'dist/assets'), resolve(clientOutput, 'assets'));
await rename(resolve(root, 'dist/og.png'), resolve(clientOutput, 'og.png'));
