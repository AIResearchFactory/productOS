import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';
import { getAppDataDir } from './paths.mjs';

const execPromise = promisify(exec);

// Read version from package.json at the package root
const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
let _version = 'unknown';
try {
  const pkg = require(path.join(__dirname, '../../package.json'));
  _version = pkg.version ?? 'unknown';
} catch { /* ignore */ }

export async function checkCli(command) {
  if (!command) return { installed: false, in_path: false };

  try {
    // If it's an absolute path, check if it exists and is executable
    if (path.isAbsolute(command)) {
      await fs.access(command, fs.constants.X_OK);
      return { installed: true, in_path: false };
    }

    // On Unix-like systems, 'which' checks if a command is in PATH
    // On Windows, 'where' is the equivalent
    const checkCmd = process.platform === 'win32' ? `where ${command}` : `which ${command}`;
    await execPromise(checkCmd);
    return { installed: true, in_path: true };
  } catch (error) {
    return { installed: false, in_path: false };
  }
}

export async function getAppConfig() {
  const appDataDir = await getAppDataDir();
  return {
    app_data_directory: appDataDir,
    installation_date: new Date().toISOString(),
    version: _version,
    claude_code_enabled: (await checkCli('claude')).installed,
    ollama_enabled: (await checkCli('ollama')).installed,
    gemini_enabled: (await checkCli('gemini')).installed,
    openai_enabled: (await checkCli('openai')).installed,
    last_update_check: new Date().toISOString(),
  };
}
