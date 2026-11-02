// 离线缓存：界面与词库先缓存；音频边听边缓存（要处理 iOS 的 Range 请求）
const VER = 'thai-v16';
const SHELL = ['./', 'index.html', 'style.css', 'app.js', 'manifest.webmanifest', 'data/words.json', 'icon-180.png', 'icon-192.png', 'audio/silence.mp3'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VER).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VER).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

async function rangeResponse(req, res) {
  const m = /bytes=(\d+)-(\d*)/.exec(req.headers.get('range') || '');
  if (!m) return res;
  const buf = await res.arrayBuffer();
  const start = +m[1];
  const end = m[2] ? Math.min(+m[2], buf.byteLength - 1) : buf.byteLength - 1;
  return new Response(buf.slice(start, end + 1), {
    status: 206,
    headers: {
      'Content-Type': res.headers.get('Content-Type') || 'audio/mpeg',
      'Content-Range': `bytes ${start}-${end}/${buf.byteLength}`,
      'Content-Length': String(end - start + 1),
    },
  });
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  const isAudio = url.pathname.includes('/audio/');
  e.respondWith((async () => {
    const cache = await caches.open(VER);
    const hit = await cache.match(req.url);
    if (hit) return isAudio ? rangeResponse(req, hit) : hit;
    try {
      // 带 Range 的请求不能直接缓存，改取完整文件再切片
      const full = await fetch(isAudio ? req.url : req);
      if (full.ok) cache.put(req.url, full.clone());
      return isAudio ? rangeResponse(req, full) : full;
    } catch (err) {
      if (req.mode === 'navigate') return (await cache.match('index.html')) || Response.error();
      return Response.error();
    }
  })());
});
