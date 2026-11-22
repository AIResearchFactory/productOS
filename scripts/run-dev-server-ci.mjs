import { spawn } from 'node:child_process';
import path from 'node:path';

// This script is used by E2E tests in CI to start the Node.js backend.

const child = spawn('node', ['node-backend/server.mjs'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    PRODUCTOS_NODE_SERVER_PORT: process.env.PRODUCTOS_NODE_SERVER_PORT || '51423',
    NODE_ENV: 'test',
  },
});

child.on('exit', (code) => process.exit(code ?? 0));
child.on('error', (err) => {
  console.error(err);
  process.exit(1);
});
