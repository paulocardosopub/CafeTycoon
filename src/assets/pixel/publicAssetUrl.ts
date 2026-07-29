/** Resolves files from public/ for both a local server and GitHub Pages. */
export function publicAssetUrl(path: string): string {
  if (typeof document === 'undefined') return path;
  return new URL(path.replace(/^\/+/, ''), document.baseURI).toString();
}
