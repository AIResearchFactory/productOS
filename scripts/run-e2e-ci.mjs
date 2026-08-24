import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

// Ensure PLAYWRIGHT_BROWSERS_PATH is preserved across child runner processes if not already configured
if (!process.env.PLAYWRIGHT_BROWSERS_PATH) {
  const originalHome = process.env.HOME || os.homedir();
  if (process.platform === 'linux') {
    process.env.PLAYWRIGHT_BROWSERS_PATH = process.env.XDG_CACHE_HOME
      ? path.join(process.env.XDG_CACHE_HOME, 'ms-playwright')
      : path.join(originalHome, '.cache', 'ms-playwright');
  } else if (process.platform === 'darwin') {
    process.env.PLAYWRIGHT_BROWSERS_PATH = path.join(originalHome, 'Library', 'Caches', 'ms-playwright');
  } else if (process.platform === 'win32') {
    process.env.PLAYWRIGHT_BROWSERS_PATH = process.env.LOCALAPPDATA
      ? path.join(process.env.LOCALAPPDATA, 'ms-playwright')
      : path.join(originalHome, 'AppData', 'Local', 'ms-playwright');
  }
}

const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const child = spawn(command, ['playwright', 'test', ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: {
    ...process.env,
    CI: 'true',
  },
  shell: process.platform === 'win32',
});

child.on('exit', (code) => process.exit(code ?? 0));
child.on('error', (err) => {
  console.error(err);
  process.exit(1);
});
