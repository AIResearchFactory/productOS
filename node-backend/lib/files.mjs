import { execSync, spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { getProjectById } from './projects.mjs';

export class FileService {
  static async importDocument(projectId, sourcePath) {
    const project = await getProjectById(projectId);
    const fileStem = path.parse(sourcePath).name;
    const ext = path.parse(sourcePath).ext.toLowerCase();
    const newFileName = `${fileStem}.md`;
    const targetPath = path.join(project.path, newFileName);

    let markdownContent = '';

    // Simplified PDF extraction: try pandoc first, if fails, throw error
    // (Rust implementation has a fallback but let's keep it simple for now)
    try {
      markdownContent = execSync(`pandoc -t markdown -- "${sourcePath}"`, { encoding: 'utf8' });
    } catch (error) {
      throw new Error(`Pandoc conversion failed: ${error.message}. Make sure pandoc is installed.`);
    }

    await fs.writeFile(targetPath, markdownContent, 'utf8');
    return newFileName;
  }

  static async exportDocument(projectId, fileName, targetPath, exportFormat) {
    const project = await getProjectById(projectId);
    const sourcePath = path.resolve(project.path, fileName);
    
    // Ensure target path is absolute or resolve relative to downloads
    let finalTargetPath = targetPath;
    if (!path.isAbsolute(targetPath)) {
        // Default to home Downloads if not absolute
        finalTargetPath = path.join(process.env.HOME || '', 'Downloads', targetPath);
    }

    const args = ['-f', 'markdown', '-o', finalTargetPath];
    
    if (exportFormat.toLowerCase() === 'pdf') {
        // Try to detect pdf engines similar to Rust implementation
        try {
            execSync('wkhtmltopdf --version', { stdio: 'ignore' });
            args.push('--pdf-engine=wkhtmltopdf');
        } catch {
            args.push('--pdf-engine=weasyprint'); // Fallback/Default
        }
    }

    return new Promise((resolve, reject) => {
      const child = spawn('pandoc', args);
      const content = fs.readFile(sourcePath); // We could stream this but for now read all
      
      content.then(data => {
          child.stdin.write(data);
          child.stdin.end();
      }).catch(reject);

      let stderr = '';
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Pandoc export failed with code ${code}: ${stderr}`));
        } else {
          resolve();
        }
      });
    });
  }
}
