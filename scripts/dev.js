import http from 'node:http';
import { readFile } from 'node:fs/promises';
import handler from '../api/weather.js';
http.createServer(async (req, res) => {
  try {
    if (new URL(req.url, 'http://localhost').pathname === '/api/weather') {
      res.status = code => { res.statusCode = code; return res; };
      res.json = data => { res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(data)); };
      return await handler(req, res);
    }
    if (req.url !== '/') { res.writeHead(404).end(); return; }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(await readFile(new URL('../index.html', import.meta.url)));
  } catch { res.writeHead(500).end('Internal server error'); }
}).listen(3000, '127.0.0.1', () => console.log('http://localhost:3000'));
