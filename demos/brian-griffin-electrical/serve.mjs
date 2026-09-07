const ROOT = new URL('./', import.meta.url).pathname;
const PORT = Number(process.env.PORT) || 8937;

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
    if (path.includes('..')) return new Response('Forbidden', { status: 403 });

    const file = Bun.file(ROOT + path.replace(/^\//, ''));
    const ext = path.split('.').pop().toLowerCase();
    return new Response(file, {
      headers: { 'Content-Type': TYPES[ext] || 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  },
});

console.log(`Serving ${ROOT} on http://localhost:${PORT}`);
