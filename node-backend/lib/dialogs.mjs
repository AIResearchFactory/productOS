/**
 * dialogs.mjs
 * Cross-platform native OS file/folder dialog utility.
 *   - macOS:   osascript  (Cocoa NSOpenPanel / NSSavePanel via argv)
 *   - Windows: PowerShell System.Windows.Forms (-EncodedCommand + env vars)
 *   - Linux:   zenity / kdialog (GTK / KDE dialog wrappers via argv)
 */

import { execFile } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/** @param {unknown} val */
function sanitizeDialogText(val) {
  return String(val ?? '').replace(/\0/g, '');
}

/**
 * Execute a binary cleanly without shell interpolation.
 * @param {string} cmd
 * @param {string[]} args
 * @param {import('node:child_process').ExecFileOptions} [options]
 */
async function runFile(cmd, args, options = {}) {
  try {
    const { stdout } = await execFileAsync(cmd, args, {
      timeout: 60_000,
      ...options,
    });
    const trimmed = String(stdout ?? '').trim();
    return trimmed || null;
  } catch {
    return null;
  }
}

function encodePowerShell(script) {
  return Buffer.from(script, 'utf16le').toString('base64');
}

function buildFilterString(filters) {
  let filterStr = 'All Files (*.*)|*.*';
  if (Array.isArray(filters) && filters.length > 0) {
    const validFilters = filters
      .filter((f) => f && typeof f.name === 'string' && Array.isArray(f.extensions) && f.extensions.length > 0)
      .map((f) => {
        const cleanName = sanitizeDialogText(f.name).replace(/\|/g, ' ');
        const cleanExts = f.extensions
          .map((ext) => String(ext).replace(/[^a-zA-Z0-9._-]/g, ''))
          .filter(Boolean);
        return cleanExts.length > 0 ? `${cleanName} (*.${cleanExts[0]})|*.${cleanExts.join(';*.')}` : null;
      })
      .filter(Boolean);
    if (validFilters.length > 0) {
      filterStr = `${validFilters.join('|')}|All Files (*.*)|*.*`;
    }
  }
  return filterStr;
}

// ---------------------------------------------------------------------------
// macOS helpers (osascript / AppleScript with argv)
// ---------------------------------------------------------------------------

async function macPickFolder({ defaultPath, title } = {}) {
  const script = [
    'on run argv',
    '  set dlgPrompt to item 1 of argv',
    '  set defLoc to item 2 of argv',
    '  if dlgPrompt is not "" and defLoc is not "" then',
    '    return POSIX path of (choose folder with prompt dlgPrompt default location (POSIX file defLoc))',
    '  else if dlgPrompt is not "" then',
    '    return POSIX path of (choose folder with prompt dlgPrompt)',
    '  else if defLoc is not "" then',
    '    return POSIX path of (choose folder default location (POSIX file defLoc))',
    '  else',
    '    return POSIX path of (choose folder)',
    '  end if',
    'end run',
  ].join('\n');

  const raw = await runFile('osascript', [
    '-e',
    script,
    sanitizeDialogText(title || ''),
    sanitizeDialogText(defaultPath || ''),
  ]);
  if (!raw) return null;
  return raw.replace(/\/$/, '');
}

async function macSaveFile({ defaultPath, title } = {}) {
  const cleanDefault = defaultPath ? sanitizeDialogText(defaultPath) : '';
  const fileName = cleanDefault ? path.basename(cleanDefault) : 'export.txt';
  const dirPath = cleanDefault && cleanDefault.includes('/') ? path.dirname(cleanDefault) : '';

  const script = [
    'on run argv',
    '  set dlgPrompt to item 1 of argv',
    '  set defName to item 2 of argv',
    '  set defLoc to item 3 of argv',
    '  if dlgPrompt is not "" and defLoc is not "" then',
    '    return POSIX path of (choose file name with prompt dlgPrompt default name defName default location (POSIX file defLoc))',
    '  else if dlgPrompt is not "" then',
    '    return POSIX path of (choose file name with prompt dlgPrompt default name defName)',
    '  else if defLoc is not "" then',
    '    return POSIX path of (choose file name default name defName default location (POSIX file defLoc))',
    '  else',
    '    return POSIX path of (choose file name default name defName)',
    '  end if',
    'end run',
  ].join('\n');

  return runFile('osascript', [
    '-e',
    script,
    sanitizeDialogText(title || ''),
    sanitizeDialogText(fileName),
    sanitizeDialogText(dirPath),
  ]);
}

async function macPickFile({ defaultPath, title, multiple } = {}) {
  const script = multiple
    ? [
        'on run argv',
        '  set dlgPrompt to item 1 of argv',
        '  set defLoc to item 2 of argv',
        '  if dlgPrompt is not "" and defLoc is not "" then',
        '    set chosenFiles to choose file with prompt dlgPrompt default location (POSIX file defLoc) with multiple selections allowed',
        '  else if dlgPrompt is not "" then',
        '    set chosenFiles to choose file with prompt dlgPrompt with multiple selections allowed',
        '  else if defLoc is not "" then',
        '    set chosenFiles to choose file default location (POSIX file defLoc) with multiple selections allowed',
        '  else',
        '    set chosenFiles to choose file with multiple selections allowed',
        '  end if',
        '  set outPaths to ""',
        '  repeat with f in chosenFiles',
        '    set outPaths to outPaths & (POSIX path of f) & linefeed',
        '  end repeat',
        '  return outPaths',
        'end run',
      ].join('\n')
    : [
        'on run argv',
        '  set dlgPrompt to item 1 of argv',
        '  set defLoc to item 2 of argv',
        '  if dlgPrompt is not "" and defLoc is not "" then',
        '    return POSIX path of (choose file with prompt dlgPrompt default location (POSIX file defLoc))',
        '  else if dlgPrompt is not "" then',
        '    return POSIX path of (choose file with prompt dlgPrompt)',
        '  else if defLoc is not "" then',
        '    return POSIX path of (choose file default location (POSIX file defLoc))',
        '  else',
        '    return POSIX path of (choose file)',
        '  end if',
        'end run',
      ].join('\n');

  const raw = await runFile('osascript', [
    '-e',
    script,
    sanitizeDialogText(title || ''),
    sanitizeDialogText(defaultPath || ''),
  ]);
  if (!raw) return null;
  if (multiple) {
    return raw.split(/\r?\n/).map((p) => p.trim()).filter(Boolean);
  }
  return raw;
}

// ---------------------------------------------------------------------------
// Windows helpers (PowerShell -EncodedCommand reading environment variables)
// ---------------------------------------------------------------------------

async function winPickFolder({ defaultPath, title } = {}) {
  const script = `
Add-Type -AssemblyName System.Windows.Forms
$d = New-Object System.Windows.Forms.FolderBrowserDialog
$d.Description = $env:PRODUCTOS_DLG_TITLE
$d.ShowNewFolderButton = $true
if ($env:PRODUCTOS_DLG_DEFAULT) { $d.SelectedPath = $env:PRODUCTOS_DLG_DEFAULT }
$r = $d.ShowDialog()
if ($r -eq 'OK') { Write-Output $d.SelectedPath }
`.trim();

  return runFile(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-STA', '-EncodedCommand', encodePowerShell(script)],
    {
      env: {
        ...process.env,
        PRODUCTOS_DLG_TITLE: sanitizeDialogText(title || 'Select Folder'),
        PRODUCTOS_DLG_DEFAULT: sanitizeDialogText(defaultPath || ''),
      },
    }
  );
}

async function winSaveFile({ defaultPath, title, filters } = {}) {
  const cleanDefault = defaultPath ? sanitizeDialogText(defaultPath) : '';
  const fileName = cleanDefault ? path.win32.basename(cleanDefault) : 'export.txt';
  const dirPath = cleanDefault ? path.win32.dirname(cleanDefault) : '';
  const script = `
Add-Type -AssemblyName System.Windows.Forms
$d = New-Object System.Windows.Forms.SaveFileDialog
$d.Title = $env:PRODUCTOS_DLG_TITLE
$d.FileName = $env:PRODUCTOS_DLG_FILENAME
$d.Filter = $env:PRODUCTOS_DLG_FILTER
if ($env:PRODUCTOS_DLG_DIR -and $env:PRODUCTOS_DLG_DIR -ne '.') { $d.InitialDirectory = $env:PRODUCTOS_DLG_DIR }
$r = $d.ShowDialog()
if ($r -eq 'OK') { Write-Output $d.FileName }
`.trim();

  return runFile(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-STA', '-EncodedCommand', encodePowerShell(script)],
    {
      env: {
        ...process.env,
        PRODUCTOS_DLG_TITLE: sanitizeDialogText(title || 'Save File'),
        PRODUCTOS_DLG_FILENAME: sanitizeDialogText(fileName),
        PRODUCTOS_DLG_DIR: sanitizeDialogText(dirPath === '.' ? '' : dirPath),
        PRODUCTOS_DLG_FILTER: buildFilterString(filters),
      },
    }
  );
}

async function winPickFile({ defaultPath, title, multiple, filters } = {}) {
  const script = `
Add-Type -AssemblyName System.Windows.Forms
$d = New-Object System.Windows.Forms.OpenFileDialog
$d.Title = $env:PRODUCTOS_DLG_TITLE
$d.Filter = $env:PRODUCTOS_DLG_FILTER
if ($env:PRODUCTOS_DLG_MULTI -eq '1') { $d.Multiselect = $true }
if ($env:PRODUCTOS_DLG_DIR) { $d.InitialDirectory = $env:PRODUCTOS_DLG_DIR }
$r = $d.ShowDialog()
if ($r -eq 'OK') { Write-Output ($d.FileNames -join [Environment]::NewLine) }
`.trim();

  const raw = await runFile(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-STA', '-EncodedCommand', encodePowerShell(script)],
    {
      env: {
        ...process.env,
        PRODUCTOS_DLG_TITLE: sanitizeDialogText(title || 'Select File'),
        PRODUCTOS_DLG_DIR: sanitizeDialogText(defaultPath || ''),
        PRODUCTOS_DLG_FILTER: buildFilterString(filters),
        PRODUCTOS_DLG_MULTI: multiple ? '1' : '0',
      },
    }
  );
  if (!raw) return null;
  if (multiple) return raw.split(/\r?\n/).map((p) => p.trim()).filter(Boolean);
  return raw;
}

// ---------------------------------------------------------------------------
// Linux helpers (zenity, fallback to kdialog via argv)
// ---------------------------------------------------------------------------

async function linuxPickFolder({ defaultPath, title } = {}) {
  const zenityArgs = ['--file-selection', '--directory'];
  if (title) zenityArgs.push(`--title=${sanitizeDialogText(title)}`);
  if (defaultPath) {
    const clean = sanitizeDialogText(defaultPath).replace(/\/$/, '');
    zenityArgs.push(`--filename=${clean}/`);
  }
  const result = await runFile('zenity', zenityArgs);
  if (result) return result;

  const kArgs = ['--getexistingdirectory', sanitizeDialogText(defaultPath || os.homedir())];
  if (title) kArgs.push('--title', sanitizeDialogText(title));
  return runFile('kdialog', kArgs);
}

async function linuxSaveFile({ defaultPath, title } = {}) {
  const zenityArgs = ['--file-selection', '--save', '--confirm-overwrite'];
  if (title) zenityArgs.push(`--title=${sanitizeDialogText(title)}`);
  if (defaultPath) zenityArgs.push(`--filename=${sanitizeDialogText(defaultPath)}`);
  const result = await runFile('zenity', zenityArgs);
  if (result) return result;

  const kArgs = ['--getsavefilename', sanitizeDialogText(defaultPath || os.homedir())];
  if (title) kArgs.push('--title', sanitizeDialogText(title));
  return runFile('kdialog', kArgs);
}

async function linuxPickFile({ defaultPath, title, multiple } = {}) {
  const zenityArgs = ['--file-selection'];
  if (title) zenityArgs.push(`--title=${sanitizeDialogText(title)}`);
  if (defaultPath) zenityArgs.push(`--filename=${sanitizeDialogText(defaultPath)}`);
  if (multiple) zenityArgs.push('--multiple', '--separator=\n');
  const result = await runFile('zenity', zenityArgs);
  if (result) {
    if (multiple) return result.split(/\r?\n/).map((p) => p.trim()).filter(Boolean);
    return result;
  }

  const kArgs = ['--getopenfilename', sanitizeDialogText(defaultPath || os.homedir())];
  if (multiple) kArgs.push('--multiple', '--separate-output');
  if (title) kArgs.push('--title', sanitizeDialogText(title));
  const kResult = await runFile('kdialog', kArgs);
  if (!kResult) return null;
  if (multiple) return kResult.split(/\r?\n/).map((p) => p.trim()).filter(Boolean);
  return kResult;
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
  if (process.platform === 'win32') return winPickFolder(options);
  return linuxPickFolder(options);
}

/**
 * Open a native OS save-file dialog.
 * @param {{ defaultPath?: string, title?: string, filters?: Array<{name:string,extensions:string[]}> }} options
 * @returns {Promise<string|null>}
 */
export async function saveFile(options = {}) {
  if (process.platform === 'darwin') return macSaveFile(options);
  if (process.platform === 'win32') return winSaveFile(options);
  return linuxSaveFile(options);
}

/**
 * Open a native OS file picker dialog.
 * @param {{ defaultPath?: string, title?: string, multiple?: boolean, filters?: Array<{name:string,extensions:string[]}> }} options
 * @returns {Promise<string|string[]|null>}
 */
export async function pickFile(options = {}) {
  if (process.platform === 'darwin') return macPickFile(options);
  if (process.platform === 'win32') return winPickFile(options);
  return linuxPickFile(options);
}
