import { execSync } from 'child_process';
import os from 'os';

/**
 * Fix the PATH environment variable on macOS when running as a bundled app.
 * GUI apps on macOS don't inherit the shell PATH, which breaks CLI tool detection.
 */
export function fixMacosEnv() {
  if (os.platform() !== 'darwin') return;

  const currentPath = process.env.PATH || '';
  if (currentPath.includes('/opt/homebrew/bin') || currentPath.includes('/usr/local/bin')) {
    return;
  }

  const shell = process.env.SHELL || '/bin/zsh';
  try {
    const fullPath = execSync(`${shell} -l -c "echo $PATH"`, { encoding: 'utf-8' }).trim();
    if (fullPath) {
      process.env.PATH = fullPath;
      console.log('[env] Fixed macOS PATH environment');
    }
  } catch (e) {
    // Silently fail — PATH will remain as-is
  }
}
