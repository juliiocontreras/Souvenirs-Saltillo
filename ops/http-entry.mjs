import http from 'node:http';
import { pathToFileURL } from 'node:url';
const MAX_HTML_BYTES = 8 * 1024 * 1024;

export function createEntryServer(upstreamPort) {
  return http.createServer((request, response) => {
    const unavailable = () => {
      if (response.headersSent) return response.destroy();
      response.writeHead(503, {'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'});
      response.end('La tienda no está disponible temporalmente. Vuelve a intentarlo.');
    };
    if (!request.url?.startsWith('/')) {
      response.writeHead(400); response.end(); return;
    }
    const upstream = http.request({
      hostname:'127.0.0.1', port:upstreamPort, path:request.url,
      method:request.method, headers:{...request.headers,'accept-encoding':'identity'},
    }, incoming => {
      incoming.on('error', unavailable);
      if (!(incoming.headers['content-type'] || '').toLowerCase().startsWith('text/html')) {
        response.writeHead(incoming.statusCode, incoming.headers);
        incoming.pipe(response); return;
      }
      // Buffer before normalizing HTML across Next.js stream boundaries.
      const chunks = [];
      let bytes = 0;
      incoming.on('data', chunk => {
        bytes += chunk.length;
        if (bytes > MAX_HTML_BYTES) { incoming.destroy(); unavailable(); return; }
        chunks.push(chunk);
      });
      incoming.on('end', () => {
        if (response.writableEnded || response.destroyed) return;
        // BasicDeploy also injects a disclosure after literal </title>. Optional
        // whitespace in an HTML end tag keeps the same DOM/title while avoiding
        // that invalid head insertion. Its ordinary body disclosure stays visible.
        const body = Buffer.from(Buffer.concat(chunks).toString('utf8')
          .replaceAll('</title>', '</title >'));
        const headers = {...incoming.headers,'content-length':String(body.length)};
        delete headers['transfer-encoding'];
        response.writeHead(incoming.statusCode, headers);
        response.end(body);
      });
    });
    upstream.setTimeout(330000, () => upstream.destroy());
    upstream.on('error', unavailable);
    request.on('aborted', () => upstream.destroy());
    request.pipe(upstream);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  createEntryServer(Number(process.env.UPSTREAM_PORT || 8081))
    .listen(Number(process.env.PORT || 8080), '0.0.0.0');
}
