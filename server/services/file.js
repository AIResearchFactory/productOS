import fs from 'fs';
import path from 'path';
import { resolveProjectPath } from './project.js';

/**
 * Port of Rust FileService.
 */

/**
 * Get the safe file path within a project directory.
 * Validates against path traversal.
 */
function getFilePath(projectId, fileName) {
  if (fileName.includes('..')) throw new Error("Invalid file name: must not contain '..'");

  const isAllowedHiddenDir = fileName.startsWith('.templates/') || fileName.startsWith('.assets/');
  if (!fileName || (!isAllowedHiddenDir && fileName.startsWith('.') && !fileName.includes('/'))) {
    throw new Error('Invalid file name: must not be empty or a hidden file in the project root');
  }

  const projectDir = resolveProjectPath(projectId);
  const filePath = path.resolve(projectDir, fileName);

  // Path traversal check
  if (!filePath.startsWith(path.resolve(projectDir))) {
    throw new Error('File path escapes project directory');
  }
  return filePath;
}

export function fileExists(projectId, fileName) {
  try {
    return fs.existsSync(getFilePath(projectId, fileName));
  } catch { return false; }
}

export function readFile(projectId, fileName) {
  const filePath = getFilePath(projectId, fileName);
  if (!fs.existsSync(filePath)) throw new Error(`File does not exist: ${fileName}`);
  return fs.readFileSync(filePath, 'utf-8');
}

export function writeFile(projectId, fileName, content) {
  const filePath = getFilePath(projectId, fileName);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf-8');
}

export function renameFile(projectId, oldName, newName) {
  const oldPath = getFilePath(projectId, oldName);
  const newPath = getFilePath(projectId, newName);
  if (!fs.existsSync(oldPath)) throw new Error(`Source file does not exist: ${oldName}`);
  if (fs.existsSync(newPath)) throw new Error(`Destination file already exists: ${newName}`);
  fs.mkdirSync(path.dirname(newPath), { recursive: true });
  fs.renameSync(oldPath, newPath);
}

export function deleteFile(projectId, fileName) {
  const filePath = getFilePath(projectId, fileName);
  if (!fs.existsSync(filePath)) throw new Error(`File does not exist: ${fileName}`);
  fs.unlinkSync(filePath);
}

export function searchInFiles(projectId, searchText, caseSensitive, useRegex) {
  const projectDir = resolveProjectPath(projectId);
  if (!fs.existsSync(projectDir)) return [];

  const flags = caseSensitive ? 'g' : 'gi';
  const regex = useRegex ? new RegExp(searchText, flags) : new RegExp(searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);

  const matches = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(fullPath); continue; }
      const ext = path.extname(entry.name).slice(1).toLowerCase();
      if (!['md', 'txt', 'csv', 'json', 'yaml', 'yml', 'js', 'ts', 'py', 'rs'].includes(ext)) continue;
      try {
        const content = fs.readFileSync(fullPath, 'utf-8');
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          let match;
          regex.lastIndex = 0;
          while ((match = regex.exec(lines[i])) !== null) {
            const relPath = path.relative(projectDir, fullPath).replace(/\\/g, '/');
            matches.push({ file_name: relPath, line_number: i + 1, line_content: lines[i], match_start: match.index, match_end: match.index + match[0].length });
            if (!regex.global) break;
          }
        }
      } catch { /* skip binary/unreadable files */ }
    }
  }
  walk(projectDir);
  return matches;
}

export function replaceInFiles(projectId, searchText, replaceText, caseSensitive, fileNames = []) {
  const projectDir = resolveProjectPath(projectId);
  const flags = caseSensitive ? 'g' : 'gi';
  const regex = new RegExp(searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
  let totalReplacements = 0;

  const filesToProcess = fileNames.length > 0
    ? fileNames.map(f => path.join(projectDir, f))
    : getAllTextFiles(projectDir);

  for (const filePath of filesToProcess) {
    if (!fs.existsSync(filePath)) continue;
    const content = fs.readFileSync(filePath, 'utf-8');
    const newContent = content.replace(regex, () => { totalReplacements++; return replaceText; });
    if (content !== newContent) fs.writeFileSync(filePath, newContent, 'utf-8');
  }
  return totalReplacements;
}

function getAllTextFiles(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) { files.push(...getAllTextFiles(fullPath)); continue; }
    const ext = path.extname(entry.name).slice(1).toLowerCase();
    if (['md', 'txt', 'csv', 'json', 'yaml', 'yml', 'js', 'ts', 'py', 'rs'].includes(ext)) files.push(fullPath);
  }
  return files;
}

export function importDocument(projectId, sourcePath) {
  if (!fs.existsSync(sourcePath)) throw new Error(`Source file does not exist: ${sourcePath}`);
  const fileName = path.basename(sourcePath);
  const content = fs.readFileSync(sourcePath, 'utf-8');
  writeFile(projectId, fileName, content);
  return fileName;
}

export function exportDocument(projectId, fileName, targetPath, _exportFormat) {
  const content = readFile(projectId, fileName);
  fs.writeFileSync(targetPath, content, 'utf-8');
}
