/**
 * dialogs.mjs
 * Cross-platform native OS file/folder dialog utility.
 *
 * This mirrors the approach used by the previous Rust backend which used the
 * `rfd` (Rusty File Dialogs) crate. That crate internally calls the exact same
 * native OS dialog APIs we invoke here:
 *   - macOS:   osascript  (Cocoa NSOpenPanel / NSSavePanel)
 *   - Windows: PowerShell System.Windows.Forms (FolderBrowserDialog / SaveFileDialog)
 *   - Linux:   zenity / kdialog (GTK / KDE dialog wrappers)
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

/** @param {string} cmd */
async function run(cmd) {
  try {
    const { stdout } = await execAsync(cmd, { timeout: 60_000 });
    return stdout.trim();
  } catch {
    return null;
  }
}

/**
 * Escape a string for safe embedding inside single-quoted AppleScript text.
 * @param {string} str
 */
function escapeAppleScript(str = '') {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * Escape a string for safe embedding inside a PowerShell double-quoted string.
 * @param {string} str
 */
function escapePowerShell(str = '') {
  return str.replace(/`/g, '``').replace(/"/g, '`"').replace(/\$/g, '`$');
}

// ---------------------------------------------------------------------------
// macOS helpers (osascript / AppleScript)
// ---------------------------------------------------------------------------

async function macPickFolder({ defaultPath, title } = {}) {
  const prompt = title ? `with prompt "${escapeAppleScript(title)}"` : '';
  const defLoc = defaultPath ? `default location "${escapeAppleScript(defaultPath)}"` : '';
  const script = `choose folder ${prompt} ${defLoc}`.trim();
  const raw = await run(`osascript -e 'POSIX path of (${script})'`);
  if (!raw) return null;
  return raw.replace(/\/$/, ''); // strip trailing slash
}

async function macSaveFile({ defaultPath, title } = {}) {
  const prompt = title ? `with prompt "${escapeAppleScript(title)}"` : '';
  const fileName = defaultPath ? defaultPath.split('/').pop() : 'export.txt';
  const dirPath = defaultPath && defaultPath.includes('/')
    ? defaultPath.substring(0, defaultPath.lastIndexOf('/'))
    : '';
  const defName = `default name "${escapeAppleScript(fileName)}"`;
  const defLoc = dirPath ? `default location "${escapeAppleScript(dirPath)}"` : '';
  const script = `choose file name ${prompt} ${defName} ${defLoc}`.trim();
  const raw = await run(`osascript -e 'POSIX path of (${script})'`);
  return raw || null;
}

async function macPickFile({ defaultPath, title, multiple } = {}) {
  const prompt = title ? `with prompt "${escapeAppleScript(title)}"` : '';
  const defLoc = defaultPath ? `default location "${escapeAppleScript(defaultPath)}"` : '';
  const multiFlag = multiple ? 'with multiple selections allowed' : '';
  const script = `choose file ${prompt} ${defLoc} ${multiFlag}`.trim();
  const raw = await run(`osascript -e 'POSIX path of (${script})'`);
  if (!raw) return null;
  if (multiple) {
    return raw.split(', ').map(p => p.trim()).filter(Boolean);
  }
  return raw;
}

// ---------------------------------------------------------------------------
// Windows helpers (PowerShell + System.Windows.Forms)
// ---------------------------------------------------------------------------

function buildPowerShellPickFolder({ defaultPath, title } = {}) {
  const safeTitle = escapePowerShell(title || 'Select Folder');
  const safeDefault = escapePowerShell(defaultPath || '');
  return `powershell -NonInteractive -Command "& {
Add-Type -AssemblyName System.Windows.Forms;
$d = New-Object System.Windows.Forms.FolderBrowserDialog;
$d.Description = '${safeTitle}';
$d.ShowNewFolderButton = $true;
if ('${safeDefault}') { $d.SelectedPath = '${safeDefault}' };
$r = $d.ShowDialog();
if ($r -eq 'OK') { Write-Output $d.SelectedPath }
}"`;
}

function buildPowerShellSaveFile({ defaultPath, title, filters } = {}) {
  const safeTitle = escapePowerShell(title || 'Save File');
  const fileName = defaultPath ? defaultPath.replace(/\\/g, '\\\\').split(/[\\/]/).pop() : 'export.txt';
  const dirPath = defaultPath ? defaultPath.replace(/[\\/][^\\/]*$/, '') : '';
  const safeFileName = escapePowerShell(fileName);
  const safeDir = escapePowerShell(dirPath);

  let filterStr = 'All Files (*.*)|*.*';
  if (filters && filters.length > 0) {
    filterStr = filters.map(f => `${f.name} (*.${f.extensions[0]})|*.${f.extensions.join(';*.')}`).join('|');
    filterStr += '|All Files (*.*)|*.*';
  }
  const safeFilter = escapePowerShell(filterStr);

  return `powershell -NonInteractive -Command "& {
Add-Type -AssemblyName System.Windows.Forms;
$d = New-Object System.Windows.Forms.SaveFileDialog;
$d.Title = '${safeTitle}';
$d.FileName = '${safeFileName}';
$d.Filter = '${safeFilter}';
if ('${safeDir}') { $d.InitialDirectory = '${safeDir}' };
$r = $d.ShowDialog();
if ($r -eq 'OK') { Write-Output $d.FileName }
}"`;
}

function buildPowerShellPickFile({ defaultPath, title, multiple, filters } = {}) {
  const safeTitle = escapePowerShell(title || 'Select File');
  const safeDir = escapePowerShell(defaultPath || '');
  const multiFlag = multiple ? '$d.Multiselect = $true;' : '';

  let filterStr = 'All Files (*.*)|*.*';
  if (filters && filters.length > 0) {
    filterStr = filters.map(f => `${f.name} (*.${f.extensions[0]})|*.${f.extensions.join(';*.')}`).join('|');
    filterStr += '|All Files (*.*)|*.*';
  }
  const safeFilter = escapePowerShell(filterStr);

  return `powershell -NonInteractive -Command "& {
Add-Type -AssemblyName System.Windows.Forms;
$d = New-Object System.Windows.Forms.OpenFileDialog;
$d.Title = '${safeTitle}';
$d.Filter = '${safeFilter}';
${multiFlag}
if ('${safeDir}') { $d.InitialDirectory = '${safeDir}' };
$r = $d.ShowDialog();
if ($r -eq 'OK') { Write-Output ($d.FileNames -join '|') }
}"`;
}

// ---------------------------------------------------------------------------
// Linux helpers (zenity, fallback to kdialog)
// ---------------------------------------------------------------------------

async function linuxPickFolder({ defaultPath, title } = {}) {
  const titleFlag = title ? `--title="${title}"` : '';
  const dirFlag = defaultPath ? `--filename="${defaultPath}/"` : '';
  const zenityCmd = `zenity --file-selection --directory ${titleFlag} ${dirFlag} 2>/dev/null`;
  const result = await run(zenityCmd);
  if (result) return result;

  // Fallback to kdialog
  const kCmd = `kdialog --getexistingdirectory ${defaultPath ? `"${defaultPath}"` : '$HOME'} 2>/dev/null`;
  return await run(kCmd);
}

async function linuxSaveFile({ defaultPath, title } = {}) {
  const titleFlag = title ? `--title="${title}"` : '';
  const fileFlag = defaultPath ? `--filename="${defaultPath}"` : '';
  const zenityCmd = `zenity --file-selection --save --confirm-overwrite ${titleFlag} ${fileFlag} 2>/dev/null`;
  const result = await run(zenityCmd);
  if (result) return result;

  const kCmd = `kdialog --getsavefilename ${defaultPath ? `"${defaultPath}"` : '$HOME'} 2>/dev/null`;
  return await run(kCmd);
}

async function linuxPickFile({ defaultPath, title, multiple } = {}) {
  const titleFlag = title ? `--title="${title}"` : '';
  const fileFlag = defaultPath ? `--filename="${defaultPath}"` : '';
  const multiFlag = multiple ? '--multiple --separator="|"' : '';
  const zenityCmd = `zenity --file-selection ${titleFlag} ${fileFlag} ${multiFlag} 2>/dev/null`;
  const result = await run(zenityCmd);
  if (!result) return null;
  if (multiple) return result.split('|').filter(Boolean);
  return result;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Open a native OS folder picker dialog.
 * @param {{ defaultPath?: string, title?: string }} options
 * @returns {Promise<string|null>}
 */
export async function pickFolder(options = {}) {
  if (process.platform === 'darwin') return macPickFolder(options);
  if (process.platform === 'win32') {
    const cmd = buildPowerShellPickFolder(options);
    return run(cmd);
  }
  return linuxPickFolder(options);
}

/**
 * Open a native OS save-file dialog.
 * @param {{ defaultPath?: string, title?: string, filters?: Array<{name:string,extensions:string[]}> }} options
 * @returns {Promise<string|null>}
 */
export async function saveFile(options = {}) {
  if (process.platform === 'darwin') return macSaveFile(options);
  if (process.platform === 'win32') {
    const cmd = buildPowerShellSaveFile(options);
    return run(cmd);
  }
  return linuxSaveFile(options);
}

/**
 * Open a native OS file picker dialog.
 * @param {{ defaultPath?: string, title?: string, multiple?: boolean, filters?: Array<{name:string,extensions:string[]}> }} options
 * @returns {Promise<string|string[]|null>}
 */
export async function pickFile(options = {}) {
  if (process.platform === 'darwin') return macPickFile(options);
  if (process.platform === 'win32') {
    const cmd = buildPowerShellPickFile(options);
    const raw = await run(cmd);
    if (!raw) return null;
    if (options.multiple) return raw.split('|').filter(Boolean);
    return raw;
  }
  return linuxPickFile(options);
}
