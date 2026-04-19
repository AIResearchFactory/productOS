import { spawn } from 'node:child_process';
import path from 'node:path';

const executable = process.platform === 'win32'
  ? path.join('src-tauri', 'target', 'release', 'productos-server.exe')
  : path.join('src-tauri', 'target', 'release', 'productos-server');

const child = spawn(executable, [], {
  stdio: 'inherit',
  env: process.env,
  shell: process.platform === 'win32',
});

child.on('exit', (code) => process.exit(code ?? 0));
child.on('error', (err) => {
  console.error(err);
  process.exit(1);
});
