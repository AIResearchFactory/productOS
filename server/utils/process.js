import { execSync, execFileSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';

/**
 * Parse a command string into program + args, handling quotes and escapes.
 * Port of Rust parse_command_string.
 */
export function parseCommandString(input) {
  const trimmed = input.trim();
  const parts = [];
  let current = '';
  let quote = null;
  let escaped = false;

  for (const ch of trimmed) {
    if (escaped) {
      current += ch;
      escaped = false;
      continue;
    }
    if (ch === '\\' && quote) {
      escaped = true;
      continue;
    }
    if (ch === '"' || ch === "'") {
      if (quote === ch) {
        quote = null;
      } else if (!quote) {
        quote = ch;
      } else {
        current += ch;
      }
      continue;
    }
    if (/\s/.test(ch) && !quote) {
      if (current) {
        parts.push(current);
        current = '';
      }
      continue;
    }
    current += ch;
  }

  if (escaped) current += '\\';
  if (quote) throw new Error('Command contains an unmatched quote');
  if (current) parts.push(current);
  if (parts.length === 0) throw new Error('CLI command is empty');

  return { program: parts[0], args: parts.slice(1) };
}

/**
 * Check if a command exists in the system PATH or common fallback locations.
 */
export function commandExists(cmd) {
  return !!resolveCommandPath(cmd);
}

/**
 * Resolve the full path to a command.
 */
export function resolveCommandPath(cmd) {
  const trimmed = (cmd || '').trim();
  if (!trimmed) return null;

  // If it looks like a path (contains separator), check directly
  if (trimmed.includes('/') || trimmed.includes('\\') || path.isAbsolute(trimmed)) {
    if (fs.existsSync(trimmed)) return trimmed;
    if (os.platform() === 'win32') {
      for (const ext of ['exe', 'cmd', 'bat', 'ps1']) {
        const candidate = path.extname(trimmed) ? trimmed : `${trimmed}.${ext}`;
        if (fs.existsSync(candidate)) return candidate;
      }
    }
    return null;
  }

  // Use which/where to find in PATH
  const candidates = lookupCommandCandidates(trimmed);
  return candidates.length > 0 ? candidates[0] : null;
}

/**
 * Look up all candidate paths for a command.
 */
export function lookupCommandCandidates(cmd) {
  const paths = [];

  try {
    if (os.platform() === 'win32') {
      const output = execFileSync('where', [cmd], { encoding: 'utf-8', timeout: 5000 });
      for (const line of output.split('\n').map(l => l.trim()).filter(Boolean)) {
        paths.push(line);
      }
    } else {
      const output = execFileSync('which', [cmd], { encoding: 'utf-8', timeout: 5000 });
      for (const line of output.split('\n').map(l => l.trim()).filter(Boolean)) {
        paths.push(line);
      }
    }
  } catch {
    // Command not found
  }

  // Windows fallback paths
  if (os.platform() === 'win32') {
    const appData = process.env.APPDATA;
    const localAppData = process.env.LOCALAPPDATA;
    const userProfile = process.env.USERPROFILE;

    const candidates = [];
    if (appData) {
      const npmDir = path.join(appData, 'npm');
      candidates.push(path.join(npmDir, cmd), path.join(npmDir, `${cmd}.cmd`), path.join(npmDir, `${cmd}.exe`));
    }
    if (localAppData) {
      const npmDir = path.join(localAppData, 'npm');
      candidates.push(path.join(npmDir, cmd), path.join(npmDir, `${cmd}.cmd`), path.join(npmDir, `${cmd}.exe`));
      candidates.push(path.join(localAppData, 'Microsoft', 'WinGet', 'Links', `${cmd}.exe`));
      candidates.push(path.join(localAppData, 'Microsoft', 'WindowsApps', `${cmd}.exe`));
    }
    if (userProfile) {
      candidates.push(path.join(userProfile, '.local', 'bin', `${cmd}.exe`));
      candidates.push(path.join(userProfile, '.local', 'bin', cmd));
    }
    for (const c of candidates) {
      if (fs.existsSync(c) && !paths.includes(c)) {
        paths.push(c);
      }
    }
  }

  // Deduplicate
  const seen = new Set();
  return paths.filter(p => {
    const key = os.platform() === 'win32' ? p.toLowerCase() : p;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Open a URL in the default browser.
 */
export function openBrowserUrl(url) {
  try {
    const platform = os.platform();
    if (platform === 'darwin') {
      execSync(`open "${url}"`);
    } else if (platform === 'win32') {
      execSync(`start "" "${url}"`);
    } else {
      execSync(`xdg-open "${url}"`);
    }
  } catch (e) {
    console.error(`Failed to open browser: ${e.message}`);
  }
}
