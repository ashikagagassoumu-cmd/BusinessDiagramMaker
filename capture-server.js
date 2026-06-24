const http = require('http');
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'screenshots');
if (!fs.existsSync(dir)) fs.mkdirSync(dir);

http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  if (req.method === 'POST' && req.url.startsWith('/save/')) {
    const filename = decodeURIComponent(req.url.slice(6));
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const base64 = body.replace(/^data:image\/\w+;base64,/, '');
      fs.writeFileSync(path.join(dir, filename), Buffer.from(base64, 'base64'));
      res.writeHead(200, {'Content-Type':'application/json'});
      res.end(JSON.stringify({ok:true, path: path.join(dir, filename)}));
    });
  } else {
    res.writeHead(404); res.end('Not found');
  }
}).listen(8766, () => console.log('Capture server on http://localhost:8766'));
