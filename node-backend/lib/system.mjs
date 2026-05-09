import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import { getAppDataDir } from './paths.mjs';

const execFilePromise = promisify(execFile);

// Read version from package.json at the package root
const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
let _version = 'unknown';
try {
  const pkg = require(path.join(__dirname, '../../package.json'));
  _version = pkg.version ?? 'unknown';
} catch { /* ignore */ }

const WINDOWS_EXTENSIONS = ['.exe', '.cmd', '.bat', '.ps1', ''];
const POSIX_EXTENSIONS = [''];

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function pathEntries() {
  const entries = (process.env.PATH || process.env.Path || process.env.path || '')
    .split(path.delimiter)
    .filter(Boolean);

  const home = os.homedir();
  const appData = process.env.APPDATA;
  const localAppData = process.env.LOCALAPPDATA;

  // GUI-launched apps and Windows services often miss the user's npm/global bin
  // directory in PATH, which made Codex/Claude/Gemini look absent even when they
  // were installed for the current user.
  const extra = process.platform === 'win32'
    ? [
        appData && path.join(appData, 'npm'),
        localAppData && path.join(localAppData, 'Programs'),
        localAppData && path.join(localAppData, 'Microsoft', 'WindowsApps'),
      ]
    : [
        path.join(home, '.local', 'bin'),
        path.join(home, '.npm-global', 'bin'),
        path.join(home, '.bun', 'bin'),
        path.join(home, '.cargo', 'bin'),
        path.join(home, 'bin'),
        '/opt/homebrew/bin',
        '/usr/local/bin',
      ];

  return unique([...entries, ...extra]);
}

async function isExecutable(filePath) {
  try {
    await fs.access(filePath, process.platform === 'win32' ? fs.constants.F_OK : fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

async function findExecutable(command) {
  if (!command) return null;

  if (path.isAbsolute(command) || command.includes(path.sep) || (path.posix.sep !== path.sep && command.includes(path.posix.sep))) {
    return await isExecutable(command) ? { path: command, in_path: false } : null;
  }

  const extensions = process.platform === 'win32' ? WINDOWS_EXTENSIONS : POSIX_EXTENSIONS;
  const names = path.extname(command) ? [command] : extensions.map(ext => `${command}${ext}`);

  for (const dir of pathEntries()) {
    for (const name of names) {
      const candidate = path.join(dir, name);
      if (await isExecutable(candidate)) {
        const inPath = (process.env.PATH || process.env.Path || process.env.path || '')
          .split(path.delimiter)
          .some(entry => entry && path.resolve(entry).toLowerCase() === path.resolve(dir).toLowerCase());
        return { path: candidate, in_path: inPath };
      }
    }
  }

  return null;
}

function quoteCmdArg(value) {
  const text = String(value);
  return /\s/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

async function runCliForVersion(executablePath, args) {
  const isWindowsShim = process.platform === 'win32' && /\.(cmd|bat)$/i.test(executablePath);
  if (!isWindowsShim) {
    return execFilePromise(executablePath, args, { timeout: 2500, windowsHide: true });
  }

  const commandLine = [quoteCmdArg(executablePath), ...args.map(quoteCmdArg)].join(' ');
  return execFilePromise(process.env.ComSpec || 'cmd.exe', ['/d', '/c', commandLine], { timeout: 2500, windowsHide: true });
}

async function getCliVersion(executablePath) {
  if (!executablePath) return undefined;
  for (const args of [['--version'], ['version']]) {
    try {
      const { stdout, stderr } = await runCliForVersion(executablePath, args);
      const output = `${stdout || ''}${stderr || ''}`.trim().split(/\r?\n/)[0]?.trim();
      if (output) return output;
    } catch {
      // Some CLIs do not support one of the common version flags.
    }
  }
  return undefined;
}

export async function checkCli(command) {
  const found = await findExecutable(command);
  if (!found) return { installed: false, in_path: false };

  return {
    installed: true,
    in_path: found.in_path,
    path: found.path,
    version: await getCliVersion(found.path),
  };
}

export async function resolveCliCommand(...commands) {
  for (const command of commands) {
    const status = await checkCli(command);
    if (status.installed) return status;
  }
  return { installed: false, in_path: false };
}

export async function getAppConfig() {
  const appDataDir = await getAppDataDir();
  const claude = await checkCli('claude');
  const ollama = await checkCli('ollama');
  const gemini = await checkCli('gemini');
  const openai = await resolveCliCommand('codex', 'openai');

  return {
    app_data_directory: appDataDir,
    installation_date: new Date().toISOString(),
    version: _version,
    claude_code_enabled: claude.installed,
    ollama_enabled: ollama.installed,
    gemini_enabled: gemini.installed,
    openai_enabled: openai.installed,
    claude_code_path: claude.path,
    ollama_path: ollama.path,
    gemini_path: gemini.path,
    openai_path: openai.path,
    last_update_check: new Date().toISOString(),
  };
}
