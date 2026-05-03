import { spawn } from 'node:child_process';

const nodeServerPort = process.env.PRODUCTOS_NODE_SERVER_PORT || '51424';
const vitePort = process.env.VITE_PORT || '5173';
const backendUrl = process.env.VITE_PRODUCTOS_SERVER_URL || `http://localhost:${nodeServerPort}`;

const children = [];

function shutdown(code = 0) {
  for (const child of children) {
    try {
      child.kill('SIGTERM');
    } catch {}
  }
  process.exit(code);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

const nodeBackend = spawn('node', ['node-backend/server.mjs'], {
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    PRODUCTOS_NODE_SERVER_PORT: nodeServerPort,
  },
});
children.push(nodeBackend);

nodeBackend.on('exit', (code) => {
  if (code && code !== 0) {
    console.error(`[node-prototype] backend exited with code ${code}`);
    shutdown(code);
  }
});

const vite = spawn('npx', ['vite', '--port', vitePort, '--strictPort'], {
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    VITE_PRODUCTOS_SERVER_URL: backendUrl,
  },
});
children.push(vite);

vite.on('exit', (code) => {
  shutdown(code || 0);
});
