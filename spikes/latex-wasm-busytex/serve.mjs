// Minimal static server for the spike.
// Sets COOP/COEP (cross-origin isolation) in case the emscripten build wants
// SharedArrayBuffer, and serves .wasm/.data with sane types. Node >= 18, no deps.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const PORT = process.env.PORT ? Number(process.env.PORT) : 8099;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
  '.data': 'application/octet-stream',
  '.tex': 'text/plain; charset=utf-8',
  '.pdf': 'application/pdf',
};

createServer(async (req, res) => {
  // Cross-origin isolation — harmless when unused, required if the engine uses threads.
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');

  try {
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    const rel = normalize(urlPath === '/' ? '/index.html' : urlPath).replace(/^(\.\.[/\\])+/, '');
    const filePath = join(ROOT, rel);
    if (!filePath.startsWith(ROOT)) { res.writeHead(403).end('forbidden'); return; }

    const info = await stat(filePath);
    if (info.isDirectory()) { res.writeHead(403).end('forbidden'); return; }

    const body = await readFile(filePath);
    res.setHeader('Content-Type', TYPES[extname(filePath)] || 'application/octet-stream');
    res.setHeader('Content-Length', info.size);
    res.writeHead(200).end(body);
  } catch (err) {
    res.writeHead(err.code === 'ENOENT' ? 404 : 500).end(String(err));
  }
}).listen(PORT, () => {
  console.log(`Spike server on http://localhost:${PORT}  (Ctrl-C to stop)`);
});
