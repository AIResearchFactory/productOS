import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Importer } from '../core/importer.js';
import { adapters } from '../providers/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, '../../web');

const importer = new Importer(adapters);

function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

async function serveFile(res, filePath, contentType) {
  try {
    const content = await fs.readFile(filePath);
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/') {
    return serveFile(res, path.join(webRoot, 'index.html'), 'text/html; charset=utf-8');
  }
  if (req.method === 'GET' && req.url === '/app.js') {
    return serveFile(res, path.join(webRoot, 'app.js'), 'application/javascript; charset=utf-8');
  }
  if (req.method === 'GET' && req.url === '/styles.css') {
    return serveFile(res, path.join(webRoot, 'styles.css'), 'text/css; charset=utf-8');
  }

  if (req.method === 'POST' && req.url === '/api/import') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 10 * 1024 * 1024) {
        req.socket.destroy();
      }
    });

    req.on('end', async () => {
      try {
        const parsed = JSON.parse(body || '{}');
        const result = await importer.import({
          provider: parsed.provider,
          payload: parsed.payload
        });
        json(res, 200, result);
      } catch (err) {
        json(res, 400, { error: err.message || 'Import failed' });
      }
    });
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

const port = Number(process.env.PORT || 3199);
server.listen(port, () => {
  console.log(`UI running on http://localhost:${port}`);
});
