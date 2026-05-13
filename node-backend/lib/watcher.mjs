import chokidar from 'chokidar';
import path from 'node:path';
import fs from 'node:fs/promises';
import { getProjectById } from './projects.mjs';
import * as ArtifactService from './artifacts.mjs';

class FileWatcherService {
  constructor() {
    this.watchers = new Map(); // projectId -> chokidar instance
    this.orchestrator = null;
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
          '**/build/**'
        ],
        persistent: true,
        ignoreInitial: true,
        depth: 5, // Avoid infinite recursion or very deep trees for performance
        awaitWriteFinish: {
            stabilityThreshold: 500,
            pollInterval: 100
        }
      });

      watcher
        .on('add', (filePath) => this.handleFileEvent('add', projectId, filePath))
        .on('change', (filePath) => this.handleFileEvent('change', projectId, filePath))
        .on('unlink', (filePath) => this.handleFileEvent('unlink', projectId, filePath))
        .on('error', (error) => console.error(`[Watcher] Error for project ${projectId}:`, error));

      this.watchers.set(projectId, watcher);
      console.log(`[Watcher] Started watching project: ${projectId} at ${projectPath}`);
    } catch (err) {
      console.error(`[Watcher] Failed to start watcher for project ${projectId}:`, err);
    }
  }

  unwatchProject(projectId) {
    const watcher = this.watchers.get(projectId);
    if (watcher) {
      watcher.close();
      this.watchers.delete(projectId);
      console.log(`[Watcher] Stopped watching project: ${projectId}`);
    }
  }

  async handleFileEvent(event, projectId, filePath) {
    const fileName = path.basename(filePath);
    // console.log(`[Watcher] ${event} detected: ${filePath}`);

    // Emit generic file-changed event
    if (this.orchestrator) {
      this.orchestrator.emit('file-changed', { projectId, fileName, event });
    }

    // Check if it's an artifact folder
    try {
        const project = await getProjectById(projectId);
        const relativePath = path.relative(path.resolve(project.path), path.resolve(filePath));
        const folder = relativePath.split(path.sep)[0];

        const isArtifactFolder = ArtifactService.isArtifactFolder(folder);
        const isMarkdown = filePath.endsWith('.md');

        if (isArtifactFolder && isMarkdown) {
          console.log(`[Watcher] Artifact change (${event}) detected in ${folder}: ${fileName}`);
          await ArtifactService.reconcileArtifacts(projectId);
          if (this.orchestrator) {
            this.orchestrator.emit('artifacts-changed', { projectId });
          }
        }
    } catch (err) {
        // Project might have been deleted or path is weird
        console.error(`[Watcher] Error handling file event:`, err);
    }
  }

  stopAll() {
    for (const [projectId, watcher] of this.watchers) {
      watcher.close();
    }
    this.watchers.clear();
  }
}

export const watcherService = new FileWatcherService();
