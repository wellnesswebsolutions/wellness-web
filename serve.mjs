// Minimal static server for the agency site preview.
// Run with: bun run agency-site/serve.mjs
const ROOT = new URL('./', import.meta.url).pathname;
const PORT = Number(process.env.PORT) || 4173;

const TYPES = {
  html: 'text/html; charset=utf-8',
  css: 'text/css; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  webp: 'image/webp',
  ico: 'image/x-icon',
};

Bun.serve({
  port: PORT,
  async fetch(req) {
    let path = decodeURIComponent(new URL(req.url).pathname);
    if (path.endsWith('/')) path += 'index.html';
    // keep requests inside the site folder
    if (path.includes('..')) return new Response('Forbidden', { status: 403 });

    const file = Bun.file(ROOT + path.replace(/^\//, ''));
    if (!(await file.exists())) return new Response('Not found', { status: 404 });

    const ext = path.split('.').pop().toLowerCase();
    return new Response(file, {
      headers: { 'Content-Type': TYPES[ext] || 'application/octet-stream', 'Cache-Control': 'no-store' },
    });
  },
});

console.log(`agency-site running at http://localhost:${PORT}`);
