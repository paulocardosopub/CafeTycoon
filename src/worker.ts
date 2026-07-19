interface AssetFetcher {
  fetch(request: Request): Promise<Response>;
}

interface WorkerEnvironment {
  ASSETS: AssetFetcher;
}

export default {
  async fetch(request: Request, environment: WorkerEnvironment): Promise<Response> {
    const url = new URL(request.url);
    const acceptsHtml = request.headers.get('accept')?.includes('text/html');
    const hasFileExtension = /\.[a-z0-9]+$/i.test(url.pathname);

    if (url.pathname === '/' || (acceptsHtml && !hasFileExtension)) {
      return environment.ASSETS.fetch(new Request(new URL('/index.html', request.url), request));
    }

    return environment.ASSETS.fetch(request);
  },
};
