import chokidar from 'chokidar';
import path from 'node:path';
import fs from 'node:fs/promises';
import { getProjectById } from './projects.mjs';
import * as ArtifactService from './artifacts.mjs';

class FileWatcherService {
  constructor() {
    this.watchers = new Map(); // projectId -> chokidar instance
    this.orchestrator = null;
    this.reconcileLocks = new Map(); // projectId -> boolean (is running)
    this.reconcilePending = new Map(); // projectId -> boolean (is another run needed)
    this.reconcileTimers = new Map(); // projectId -> timeout
  }

  setOrchestrator(orchestrator) {
    this.orchestrator = orchestrator;
  }

  async watchProject(projectId) {
    if (this.watchers.has(projectId)) {
        // Already watching, but maybe the path changed? (unlikely for the same ID)
        return;
    }

    try {
      const project = await getProjectById(projectId);
      if (!project || !project.path) return;
      
      const projectPath = path.resolve(project.path);

      const watcher = chokidar.watch(projectPath, {
        ignored: [
          '**/node_modules/**',
          '**/.git/**',
          '**/.metadata/**',
          '**/.DS_Store',
          '**/dist/**',
          '**/build/**',
          '**/*.json',
          '**/*.tmp',
          '**/.*'
        ],
        persistent: true,
        ignoreInitial: true,
        depth: 5, // Avoid infinite recursion or very deep trees for performance
        awaitWriteFinish: {
            stabilityThreshold: 500,
            pollInterval: 100
        }
      });

      let isReady = false;
      watcher.on('ready', () => {
        isReady = true;
      });

      watcher
        .on('add', (filePath) => {
          if (!isReady) return;
          this.handleFileEvent('add', projectId, filePath);
        })
        .on('change', (filePath) => {
          if (!isReady) return;
          this.handleFileEvent('change', projectId, filePath);
        })
        .on('unlink', (filePath) => {
          if (!isReady) return;
          this.handleFileEvent('unlink', projectId, filePath);
        })
        .on('error', (error) => console.error(`[Watcher] Error for project ${projectId}:`, error));

      this.watchers.set(projectId, watcher);
      console.log(`[Watcher] Started watching project: ${projectId} at ${projectPath}`);
    } catch (err) {
      console.error(`[Watcher] Failed to start watcher for project ${projectId}:`, err);
    }
  }

  async setActiveProject(projectId) {
    if (!projectId) return;

    // If we are already watching ONLY this project, do nothing
    if (this.watchers.has(projectId) && this.watchers.size === 1) {
      return;
    }

    console.log(`[Watcher] Switching active project watcher to: ${projectId}`);

    // Unwatch all other projects
    for (const [id, watcher] of this.watchers) {
      if (id !== projectId) {
        try {
          await watcher.close();
        } catch (err) {
          console.error(`[Watcher] Failed to close watcher for project ${id}:`, err);
        }
        this.watchers.delete(id);
        console.log(`[Watcher] Stopped watching non-active project: ${id}`);
      }
    }

    // Start watching the active project
    await this.watchProject(projectId);
  }

  unwatchProject(projectId) {
    const watcher = this.watchers.get(projectId);
    if (watcher) {
      watcher.close();
      this.watchers.delete(projectId);
      console.log(`[Watcher] Stopped watching project: ${projectId}`);
    }
    if (this.reconcileTimers.has(projectId)) {
      clearTimeout(this.reconcileTimers.get(projectId));
      this.reconcileTimers.delete(projectId);
    }
  }

  async handleFileEvent(event, projectId, filePath) {
    // Only markdown files are managed project files in productOS
    if (!filePath || !filePath.endsWith('.md')) return;

    try {
      const project = await getProjectById(projectId);
      if (!project || !project.path) return;

      const relativePath = path.relative(path.resolve(project.path), path.resolve(filePath)).replace(/\\/g, '/');
      const baseName = path.basename(filePath);

      // Emit generic file-changed event with both full relativePath and baseName
      if (this.orchestrator) {
        this.orchestrator.emit('file-changed', { projectId, fileName: relativePath, baseName, event });
      }

      // Auto-resolve comments that are no longer present in the updated file content
      if (event === 'change' || event === 'add') {
        try {
          const commentsDir = path.resolve(project.path, '.metadata', 'comments');
          const sanitizedName = relativePath.replace(/\//g, '__') + '.json';
          const commentsFilePath = path.resolve(commentsDir, sanitizedName);

          let fileContentComments;
          try {
            fileContentComments = await fs.readFile(commentsFilePath, 'utf8');
          } catch (e) {
            // File doesn't exist, no comments to resolve
          }

          if (fileContentComments) {
            const content = await fs.readFile(filePath, 'utf8');
            const comments = JSON.parse(fileContentComments);
            let changed = false;
            const updatedComments = comments.map(c => {
              if (c.status === 'open' && c.anchorText) {
                if (!content.includes(c.anchorText)) {
                  changed = true;
                  return {
                    ...c,
                    status: 'resolved',
                    resolvedAt: new Date().toISOString(),
                    resolvedBy: 'ai'
                  };
                }
              }
              return c;
            });

            if (changed) {
              await fs.writeFile(commentsFilePath, JSON.stringify(updatedComments, null, 2), 'utf8');
              console.log(`[Watcher] Auto-resolved comments in ${relativePath} because their anchor text was removed or changed.`);
            }
          }
        } catch (err) {
          console.error('[Watcher] Failed to auto-resolve comments on file event:', err.message);
        }
      }

      // Check if it's an artifact folder
      const folder = relativePath.split('/')[0];
      const isArtifactFolder = ArtifactService.isArtifactFolder(folder);

      if (isArtifactFolder) {
        console.log(`[Watcher] Artifact change (${event}) detected in ${folder}: ${baseName}`);
        this.enqueueReconcile(projectId);
      }
    } catch (err) {
      console.error(`[Watcher] Error handling file event:`, err);
    }
  }

  enqueueReconcile(projectId) {
    if (this.reconcileTimers.has(projectId)) {
      clearTimeout(this.reconcileTimers.get(projectId));
    }
    this.reconcileTimers.set(projectId, setTimeout(() => {
      this.reconcileTimers.delete(projectId);
      this.runReconcile(projectId).catch(err => {
        console.error(`[Watcher] Reconcile error for ${projectId}:`, err);
      });
    }, 400));
  }

  async runReconcile(projectId) {
    if (this.reconcileLocks.get(projectId)) {
      this.reconcilePending.set(projectId, true);
      return;
    }

    this.reconcileLocks.set(projectId, true);
    try {
      do {
        this.reconcilePending.set(projectId, false);
        await ArtifactService.reconcileArtifacts(projectId);
        if (this.orchestrator) {
          this.orchestrator.emit('artifacts-changed', { projectId });
        }
      } while (this.reconcilePending.get(projectId));
    } finally {
      this.reconcileLocks.set(projectId, false);
    }
  }

  stopAll() {
    for (const [, timer] of this.reconcileTimers) {
      clearTimeout(timer);
    }
    this.reconcileTimers.clear();
    for (const [projectId, watcher] of this.watchers) {
      watcher.close();
    }
    this.watchers.clear();
  }
}

export const watcherService = new FileWatcherService();
