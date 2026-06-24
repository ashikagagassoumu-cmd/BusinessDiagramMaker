const http = require('http');
const fs = require('fs');
const path = require('path');
const dir = __dirname;
http.createServer((req, res) => {
  const reqPath = req.url.split('?')[0].split('#')[0];   // クエリ/ハッシュ除去（?v=... でのキャッシュ回避を許可）
  const filePath = path.join(dir, decodeURIComponent(reqPath === '/' ? '/diagram_v7.11.html' : reqPath));
  const ext = path.extname(filePath);
  const types = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg'};
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, {'Content-Type': types[ext] || 'text/plain; charset=utf-8', 'Cache-Control': 'no-store, no-cache, must-revalidate', 'Pragma': 'no-cache', 'Expires': '0'});
    res.end(data);
  });
}).listen(8765, () => console.log('Server running on http://localhost:8765'));
