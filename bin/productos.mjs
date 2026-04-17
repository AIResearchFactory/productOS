#!/usr/bin/env node

/**
 * productOS npx entry point
 * Usage: npx productos
 *
 * Starts the companion Rust server and the Vite dev frontend,
 * then opens the user's default browser.
 */

import { spawn, execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import http from 'http';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SERVER_PORT = 51423;
const VITE_PORT = 5173;

// Read version from package.json
const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const VERSION = packageJson.version;

// ── Colour helpers ──────────────────────────────────────────────────
const cyan = (s) => `\x1b[36m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;

console.log(bold(cyan('\n  ╔══════════════════════════════════════╗')));
console.log(bold(cyan(`  ║        🚀 productOS v${VERSION.padEnd(8)}      ║`)));
console.log(bold(cyan('  ╚══════════════════════════════════════╝\n')));

// ── Locate server binary ────────────────────────────────────────────
function findServerBinary() {
  const candidates = [
    path.join(ROOT, 'src-tauri', 'target', 'release', 'productos-server'),
    path.join(ROOT, 'src-tauri', 'target', 'debug', 'productos-server'),
    // Windows
    path.join(ROOT, 'src-tauri', 'target', 'release', 'productos-server.exe'),
    path.join(ROOT, 'src-tauri', 'target', 'debug', 'productos-server.exe'),
  ];

  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

// ── Wait for server to be ready ─────────────────────────────────────
function waitForServer(port, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      const req = http.get(`http://127.0.0.1:${port}/api/health`, (res) => {
        if (res.statusCode === 200) {
          resolve();
        } else {
          retry();
        }
      });
      req.on('error', retry);
      req.setTimeout(500, retry);
      function retry() {
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`Server did not start within ${timeoutMs / 1000}s`));
        } else {
          setTimeout(check, 500);
        }
      }
    };
    check();
  });
}

// ── Open browser ────────────────────────────────────────────────────
function openBrowser(url) {
  const platform = process.platform;
  try {
    if (platform === 'darwin') {
      execSync(`open "${url}"`);
    } else if (platform === 'win32') {
      execSync(`start "" "${url}"`);
    } else {
      execSync(`xdg-open "${url}"`);
    }
  } catch {
    console.log(`  Open ${bold(url)} in your browser`);
  }
}

// ── Main ────────────────────────────────────────────────────────────
async function main() {
  const children = [];

  // Graceful shutdown handler
  function cleanup() {
    console.log('\n' + cyan('  Shutting down productOS...'));
    for (const child of children) {
      try { child.kill('SIGTERM'); } catch {}
    }
    process.exit(0);
  }
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  // 1. Start companion server
  const serverBin = findServerBinary();
  if (!serverBin) {
    console.log(red('  ✗ Companion server binary not found.'));
    console.log('    Building from source (requires Rust toolchain)...\n');
    try {
      execSync('cargo build --bin productos-server --release', {
        cwd: path.join(ROOT, 'src-tauri'),
        stdio: 'inherit',
      });
    } catch {
      console.error(red('\n  ✗ Build failed. Please install Rust: https://rustup.rs'));
      process.exit(1);
    }
    const built = findServerBinary();
    if (!built) {
      console.error(red('  ✗ Build succeeded but binary not found.'));
      process.exit(1);
    }
  }

  const finalBin = findServerBinary();
  console.log(green('  ✓ Server binary: ') + finalBin);

  const server = spawn(finalBin, [], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env },
  });
  children.push(server);
  server.stdout.on('data', (d) => process.stdout.write(`  ${cyan('[server]')} ${d}`));
  server.stderr.on('data', (d) => process.stderr.write(`  ${red('[server]')} ${d}`));
  server.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.error(red(`  ✗ Server exited with code ${code}`));
    }
  });

  // 2. Wait for server to be ready
  console.log(cyan('  ⏳ Waiting for server...'));
  try {
    await waitForServer(SERVER_PORT);
    console.log(green(`  ✓ Server ready on http://localhost:${SERVER_PORT}`));
  } catch (e) {
    console.error(red(`  ✗ ${e.message}`));
    cleanup();
  }

  // 3. Start Vite dev server
  console.log(cyan('  ⏳ Starting frontend...'));
  const vite = spawn('npx', ['vite', '--port', String(VITE_PORT), '--strictPort'], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
    env: { ...process.env },
  });
  children.push(vite);
  vite.stdout.on('data', (d) => {
    const line = d.toString();
    process.stdout.write(`  ${cyan('[vite]')} ${line}`);
    if (line.includes('Local:') || line.includes('ready in')) {
      console.log(green(`\n  ✓ productOS is ready!`));
      console.log(bold(`  🌐 Open: http://localhost:${VITE_PORT}\n`));
      openBrowser(`http://localhost:${VITE_PORT}`);
    }
  });
  vite.stderr.on('data', (d) => process.stderr.write(`  ${red('[vite]')} ${d}`));

  // Keep process alive
  await new Promise(() => {});
}

main().catch((err) => {
  console.error(red(`  ✗ Fatal: ${err.message}`));
  process.exit(1);
});
