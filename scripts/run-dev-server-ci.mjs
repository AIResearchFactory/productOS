import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const isWindows = process.platform === 'win32';
const serverPath = path.join(
  root,
  'src-tauri',
  'target',
  'release',
  isWindows ? 'productos-server.exe' : 'productos-server'
);

const cargoArgs = ['build', '--bin', 'productos-server', '--release'];

async function fileExists(filePath) {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: false,
      ...options,
    });

    child.on('error', reject);
    child.on('exit', code => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(' ')} exited with code ${code ?? 'unknown'}`));
    });
  });
}

const exists = await fileExists(serverPath);
if (!exists) {
  console.log(`[dev:server:ci] Companion server missing, building release binary at ${serverPath}`);
  await run('cargo', cargoArgs, { cwd: path.join(root, 'src-tauri') });
}

const child = spawn(serverPath, [], {
  stdio: 'inherit',
  shell: false,
});

child.on('error', err => {
  console.error(`[dev:server:ci] Failed to start companion server: ${err.message}`);
  process.exit(1);
});

child.on('exit', code => {
  process.exit(code ?? 0);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    if (!child.killed) child.kill(signal);
  });
}
