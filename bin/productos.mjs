#!/usr/bin/env node

/**
 * productOS npx/npm entry point
 * Usage: npx productos  OR  npm install -g productos && productos
 *
 * Starts the Node.js backend server and the Vite frontend,
 * then opens the user's default browser.
 */

import { spawn, execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import http from 'node:http';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SERVER_PORT = 51423;
const VITE_PORT = 5173;

// Read version from package.json
const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const VERSION = packageJson.version;

// ── Colour helpers ──────────────────────────────────────────────────
const cyan  = (s) => `\x1b[36m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red   = (s) => `\x1b[31m${s}\x1b[0m`;
const bold  = (s) => `\x1b[1m${s}\x1b[0m`;
const dim   = (s) => `\x1b[2m${s}\x1b[0m`;

console.log(bold(cyan('\n  ╔══════════════════════════════════════╗')));
console.log(bold(cyan(`  ║        🚀 ProductOS v${VERSION.padEnd(8)}      ║`)));
console.log(bold(cyan('  ╚══════════════════════════════════════╝\n')));

// ── Wait for HTTP endpoint to respond 200 ───────────────────────────
function waitForServer(port, path = '/api/health', timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      const req = http.get(`http://127.0.0.1:${port}${path}`, (res) => {
        if (res.statusCode === 200) {
          resolve();
        } else {
          retry();
        }
      });
      req.on('error', retry);
      req.setTimeout(500, () => { req.destroy(); retry(); });
      function retry() {
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`Server on port ${port} did not respond within ${timeoutMs / 1000}s`));
        } else {
          setTimeout(check, 500);
        }
      }
    };
    check();
  });
}

// ── Open default browser ─────────────────────────────────────────────
function openBrowser(url) {
  if (process.env.CI === 'true') {
    console.log(`\n  ${dim('👉 CI Environment detected. Browser will not open automatically.')}`);
    console.log(`  ${bold('👉 Open:')} ${bold(url)}`);
    return;
  }
  try {
    // Small delay to ensure OS has fully bound the port
    setTimeout(() => {
      if (process.platform === 'darwin')      execSync(`open "${url}"`);
      else if (process.platform === 'win32')  execSync(`start "" "${url}"`);
      else                                    execSync(`xdg-open "${url}"`);
    }, 500);
  } catch {
    console.log(`\n  ${bold('👉 Open:')} ${bold(url)}`);
  }
}

// ── Check if port is in use ──────────────────────────────────────────
async function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = http.createServer()
      .once('error', () => resolve(false))
      .once('listening', () => {
        server.close();
        resolve(true);
      })
      .listen(port, '127.0.0.1');
  });
}

async function findAvailablePort(startPort, maxAttempts = 10) {
  for (let port = startPort; port < startPort + maxAttempts; port++) {
    if (await isPortAvailable(port)) return port;
  }
  return null;
}

// ── Main ─────────────────────────────────────────────────────────────
async function main() {
  const children = [];

  function cleanup() {
    console.log('\n' + cyan('  Shutting down ProductOS...'));
    for (const child of children) {
      try { child.kill('SIGTERM'); } catch {}
    }
    process.exit(0);
  }
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  // ── 1. Start Node.js backend ─────────────────────────────────────
  const serverEntry = path.join(ROOT, 'node-backend', 'server.mjs');
  if (!fs.existsSync(serverEntry)) {
    console.error(red('  ✗ node-backend/server.mjs not found.'));
    console.error(red('    Make sure the package was installed correctly.'));
    process.exit(1);
  }

  console.log(dim('  Starting Node.js backend...'));
  const server = spawn(process.execPath, [serverEntry], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      PRODUCTOS_NODE_SERVER_PORT: String(SERVER_PORT),
      NODE_ENV: 'production',
    },
  });
  children.push(server);
  server.stdout.on('data', (d) => process.stdout.write(`  ${dim('[server]')} ${d}`));
  server.stderr.on('data', (d) => process.stderr.write(`  ${dim('[server]')} ${d}`));
  server.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.error(red(`  ✗ Backend exited with code ${code}`));
      cleanup();
    }
  });

  // ── 2. Wait for backend to be ready ─────────────────────────────
  console.log(cyan('  ⏳ Waiting for backend...'));
  try {
    await waitForServer(SERVER_PORT);
    console.log(green(`  ✓ Backend ready on http://localhost:${SERVER_PORT}`));
  } catch (e) {
    console.error(red(`  ✗ ${e.message}`));
    cleanup();
  }

  // ── 3. Serve frontend ────────────────────────────────────────────
  // If a production build exists (dist/), serve it statically.
  // Otherwise fall back to the Vite dev server.
  const distDir = path.join(ROOT, 'dist');
  const hasProductionBuild = fs.existsSync(path.join(distDir, 'index.html'));

  let frontendProc;
  let frontendUrl;

  if (hasProductionBuild) {
    console.log(dim('  Serving production build...'));
    // Use 'serve' if globally available, otherwise fall back to a tiny built-in static server
    const serveAvailable = (() => {
      try { execSync('serve --version', { stdio: 'ignore' }); return true; } catch { return false; }
    })();

    if (serveAvailable) {
      const actualVitePort = await findAvailablePort(VITE_PORT);
      if (!actualVitePort) {
        console.error(red('  ✗ Could not find an available port for the frontend.'));
        cleanup();
      }
      frontendUrl = `http://localhost:${actualVitePort}`;
      frontendProc = spawn('serve', ['-s', distDir, '-l', String(actualVitePort)], {
        cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], shell: true,
        env: { ...process.env, VITE_SERVER_URL: `http://localhost:${SERVER_PORT}` },
      });
    } else {
      // Built-in minimal static server
      const { createServer } = await import('node:http');
      const { readFile } = await import('node:fs/promises');
      const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
                     '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
                     '.json': 'application/json', '.woff2': 'font/woff2' };
      
      const actualVitePort = await findAvailablePort(VITE_PORT);
      if (!actualVitePort) {
        console.error(red('  ✗ Could not find an available port for the frontend.'));
        cleanup();
      }

      const staticServer = createServer(async (req, sres) => {
        let filePath = path.join(distDir, req.url.split('?')[0]);
        if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
          filePath = path.join(distDir, 'index.html');
        }
        const ext = path.extname(filePath);
        try {
          sres.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream' });
          sres.end(await readFile(filePath));
        } catch {
          sres.writeHead(404); sres.end('Not found');
        }
      });

      staticServer.on('error', (err) => {
        console.error(red(`  ✗ Frontend server error: ${err.message}`));
        cleanup();
      });

      staticServer.listen(actualVitePort, '127.0.0.1', () => {
        frontendUrl = `http://localhost:${actualVitePort}`;
        console.log(green(`  ✓ Frontend ready on ${frontendUrl}`));
        console.log(green(`  ✓ productOS is ready!`));
        console.log(bold(`  🌐 Open: ${frontendUrl}\n`));
        openBrowser(frontendUrl);
      });
      
      await new Promise(() => {});   // keep alive
    }
  } else {
    // Dev mode – launch Vite
    console.log(dim('  No production build found. Starting Vite dev server...'));
    frontendUrl = `http://localhost:${VITE_PORT}`;
    frontendProc = spawn('npx', ['vite', '--port', String(VITE_PORT), '--strictPort'], {
      cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], shell: true,
      env: {
        ...process.env,
        VITE_SERVER_URL: `http://localhost:${SERVER_PORT}`,
      },
    });
  }

  if (frontendProc) {
    children.push(frontendProc);
    frontendProc.stdout.on('data', (d) => {
      const line = d.toString();
      process.stdout.write(`  ${dim('[vite]')} ${line}`);
      if (line.includes('Local:') || line.includes('ready in') || line.includes('Accepting connections')) {
        console.log(green(`\n  ✓ ProductOS is ready!`));
        console.log(bold(`  🌐 Open: ${frontendUrl}\n`));
        openBrowser(frontendUrl);
      }
    });
    frontendProc.stderr.on('data', (d) => process.stderr.write(`  ${dim('[vite]')} ${d}`));
    frontendProc.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        console.error(red(`  ✗ Frontend process exited with code ${code}`));
        cleanup();
      }
    });
  }

  // Keep process alive
  await new Promise(() => {});
}

main().catch((err) => {
  console.error(red(`  ✗ Fatal: ${err.message}`));
  process.exit(1);
});
