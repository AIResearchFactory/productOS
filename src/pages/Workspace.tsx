import { useState, useEffect, useRef } from 'react';
import TopBar from '../components/workspace/TopBar';
import Sidebar from '../components/workspace/Sidebar';
import MainPanel from '../components/workspace/MainPanel';
import Onboarding from './Onboarding';
import MenuBar from '../components/workspace/MenuBar';


import ImportSkillDialog from '../components/workspace/ImportSkillDialog';
import FileFormDialog from '../components/workspace/FileFormDialog';
import FindReplaceDialog, { FindOptions } from '../components/workspace/FindReplaceDialog';
import CreateArtifactDialog from '../components/workspace/CreateArtifactDialog';
import WorkflowResultDialog from '../components/workflow/WorkflowResultDialog';
import WorkflowProgressOverlay from '../components/workflow/WorkflowProgressOverlay';
import WorkflowBuilderDialog from '../components/workflow/WorkflowBuilderDialog';
import { tauriApi } from '../api/tauri';
import { useToast } from '@/hooks/use-toast';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { listen } from '@tauri-apps/api/event';
import { check } from '@tauri-apps/plugin-updater';
import { ask, message, open, save } from '@tauri-apps/plugin-dialog';
import { relaunch, exit } from '@tauri-apps/plugin-process';
import { Bell, X } from 'lucide-react';
import { Button } from '@/components/ui/button';


import { Project, Skill, Workflow, Artifact, ArtifactType, WorkflowExecution, WorkflowProgress } from '@/api/tauri';

interface Document {
  id: string;
  name: string;
  type: string;
  content: string;
}

interface WorkspaceProject extends Project {
  documents?: Document[];
  description?: string;
  created?: string;
}

// Welcome document that can be reopened
const welcomeDocument = {
  id: 'welcome',
  name: 'Welcome',
  type: 'welcome',
  content: ''
};

// Settings documents
const projectSettingsDocument = {
  id: 'project-settings',
  name: 'Project Settings',
  type: 'project-settings',
  content: ''
};

const globalSettingsDocument = {
  id: 'global-settings',
  name: 'Settings',
  type: 'global-settings',
  content: ''
};

export default function Workspace() {
  // Check if onboarding is complete - default to true to skip onboarding initially
  const [showOnboarding, setShowOnboarding] = useState(
    typeof window !== 'undefined' && localStorage.getItem('productOS_mock_onboarding') === 'true'
  );

  const [projects, setProjects] = useState<WorkspaceProject[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [activeProject, setActiveProject] = useState<WorkspaceProject | null>(null);
  const [activeWorkflow, setActiveWorkflow] = useState<Workflow | null>(null);
  const [activeTab, setActiveTab] = useState('projects');
  const [openDocuments, setOpenDocuments] = useState<Document[]>([]);
  const [activeDocument, setActiveDocument] = useState<Document | null>(null);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [activeArtifactId, setActiveArtifactId] = useState<string | undefined>();
  const [platform, setPlatform] = useState<string>(() => {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('mac')) return 'macos';
    if (ua.includes('win')) return 'windows';
    if (ua.includes('linux')) return 'linux';
    return '';
  });

  // Refs to access current state in event listeners
  const activeProjectRef = useRef(activeProject);
  const activeDocumentRef = useRef(activeDocument);

  // Update refs when state changes
  useEffect(() => { activeProjectRef.current = activeProject; }, [activeProject]);
  useEffect(() => { activeDocumentRef.current = activeDocument; }, [activeDocument]);

  const [theme, setTheme] = useState('dark');
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('dark');

  // Resolved theme for UI components
  useEffect(() => {
    if (theme === 'system') {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setResolvedTheme(isDark ? 'dark' : 'light');
    } else {
      setResolvedTheme(theme as 'light' | 'dark');
    }
  }, [theme]);
  const [showChat, setShowChat] = useState(true);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  const [showFileDialog, setShowFileDialog] = useState(false);

  const [showFindDialog, setShowFindDialog] = useState(false);
  const [findMode, setFindMode] = useState<'find' | 'replace'>('find');
  const [showFindInFilesDialog, setShowFindInFilesDialog] = useState(false);
  const [showReplaceInFilesDialog, setShowReplaceInFilesDialog] = useState(false);
  const [pendingReplaceData, setPendingReplaceData] = useState<{
    searchText: string;
    replaceText: string;
    matches: any[];
    fileNames: string[];
  } | null>(null);
  const [isCheckingForUpdates, setIsCheckingForUpdates] = useState(false);
  const [lastUpdateCheck, setLastUpdateCheck] = useState<number | null>(null);
  const [showImportSkillDialog, setShowImportSkillDialog] = useState(false);
  const [showCreateArtifactDialog, setShowCreateArtifactDialog] = useState(false);
  const [selectedArtifactTypeToCreate, setSelectedArtifactTypeToCreate] = useState<ArtifactType>('insight');
  const [isWorkflowRunning, setIsWorkflowRunning] = useState(false);
  const [workflowProgress, setWorkflowProgress] = useState<WorkflowProgress | null>(null);
  const [workflowResult, setWorkflowResult] = useState<WorkflowExecution | null>(null);
  const [showWorkflowResult, setShowWorkflowResult] = useState(false);
  const [lastRunWorkflowName, setLastRunWorkflowName] = useState('');
  const [recentlyChangedFiles, setRecentlyChangedFiles] = useState<Set<string>>(new Set());
  const [showWorkflowBuilder, setShowWorkflowBuilder] = useState(false);
  const [workflowBuilderMode, setWorkflowBuilderMode] = useState<'create' | 'edit'>('create');
  const [builderWorkflow, setBuilderWorkflow] = useState<Workflow | null>(null);
  const [openScheduleNonce, setOpenScheduleNonce] = useState(0);
  const { toast } = useToast();

  const highlightNewFiles = (projectId: string, files: string[], oldFiles: string[]) => {
    const newFiles = files.filter(f => !oldFiles.includes(f));
    if (newFiles.length > 0) {
      setRecentlyChangedFiles(prev => {
        const next = new Set(prev);
        newFiles.forEach(f => next.add(`${projectId}:${f}`));
        return next;
      });
      // Clear highlight after 10 seconds
      setTimeout(() => {
        setRecentlyChangedFiles(prev => {
          const next = new Set(prev);
          newFiles.forEach(f => next.delete(`${projectId}:${f}`));
          return next;
        });
      }, 10000);
    }
  };

  // Constants for update checking
  const UPDATE_CHECK_TIMEOUT = 30000; // 30 seconds
  const MIN_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes between checks
  const RETRY_DELAYS = [1000, 2000, 4000]; // Exponential backoff: 1s, 2s, 4s
  const UPDATE_POLICY_URL = 'https://github.com/AIResearchFactory/productOS/releases/latest/download/policy.json';

  const compareVersions = (a: string, b: string): number => {
    const normalize = (v: string) => v.replace(/^v/i, '').split('-')[0].split('.').map(n => parseInt(n, 10) || 0);
    const av = normalize(a);
    const bv = normalize(b);
    const len = Math.max(av.length, bv.length);
    for (let i = 0; i < len; i++) {
      const ai = av[i] || 0;
      const bi = bv[i] || 0;
      if (ai > bi) return 1;
      if (ai < bi) return -1;
    }
    return 0;
  };

  const enforceUpdatePolicy = async (): Promise<void> => {
    try {
      const response = await fetch(`${UPDATE_POLICY_URL}?t=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) return;

      const policy = await response.json();
      const minSupported = policy?.min_supported_version as string | undefined;
      if (!minSupported) return;

      const currentVersion = await tauriApi.getAppVersion();
      if (currentVersion === 'Unknown') return;

      const isOutdated = compareVersions(currentVersion, minSupported) < 0;
      if (!isOutdated) return;

      await message(
        policy?.message || `This version (${currentVersion}) is no longer supported. Please update to ${minSupported}.`,
        { title: 'Update Required', kind: 'warning' }
      );

      const shouldUpdateNow = await ask(
        `Your version (${currentVersion}) is below the minimum supported version (${minSupported}).\n\nDo you want to check for updates now?`,
        { title: 'Update Required', kind: 'warning' }
      );

      if (shouldUpdateNow) {
        await checkAppForUpdates(true);
      }
    } catch (error) {
      console.warn('Failed to enforce update policy:', error);
    }
  };

  // Extracted helper function for update prompt and installation
  const handleUpdatePrompt = async (update: any): Promise<void> => {
    const shouldUpdate = await ask(
      `A new version ${update.version} is available!\n\nWould you like to download and install it now?`,
      {
        title: 'Update Available',
        kind: 'info'
      }
    );

    if (!shouldUpdate) {
      return;
    }

    // Use local retry count (standardized to 2)
    let attemptsRemaining = 2;
    let success = false;

    while (attemptsRemaining > 0 && !success) {
      try {
        const attemptNumber = 3 - attemptsRemaining; // 1 then 2
        console.log(`Downloading and installing update (attempt ${attemptNumber}/2)...`);

        toast({
          title: attemptNumber === 1 ? 'Downloading Update' : 'Retrying Download',
          description: attemptNumber === 1
            ? 'Please wait while the update is being downloaded and installed...'
            : 'The first attempt failed. Retrying one more time...',
        });

        await update.downloadAndInstall();
        success = true;

        const shouldRelaunch = await ask(
          'Update installed successfully!\n\nWould you like to restart the application now?',
          {
            title: 'Update Installed',
            kind: 'info'
          }
        );

        if (shouldRelaunch) {
          await relaunch();
        }
      } catch (error) {
        attemptsRemaining--;
        console.error(`Attempt ${2 - attemptsRemaining} failed:`, error);

        if (attemptsRemaining > 0) {
          const tryAgain = await ask(
            'The update download failed. Would you like to try one more time?',
            {
              title: 'Update Failed',
              kind: 'warning'
            }
          );
          if (!tryAgain) break;
        } else {
          toast({
            title: 'Update Failed',
            description: 'Failed to download or install after 2 attempts. Please download the latest version manually from our website.',
            variant: 'destructive',
            duration: 10000
          });

          await message(
            'The automatic update failed twice. To ensure you have the latest features and security fixes, please download and install the new version manually.',
            {
              title: 'Manual Update Required',
              kind: 'error'
            }
          );
        }
      }
    }
  };

  // Check for app updates with improved error handling and user experience
  const checkAppForUpdates = async (showNoUpdateMessage = true): Promise<void> => {
    // Early return if update check is already in progress
    if (isCheckingForUpdates) {
      console.log('Update check already in progress, skipping...');
      return;
    }

    // Check if enough time has passed since last check (for automatic checks)
    if (!showNoUpdateMessage) {
      try {
        const config = await tauriApi.getAppConfig();
        if (config?.last_update_check) {
          const lastCheck = new Date(config.last_update_check).getTime();
          const timeSinceLastCheck = Date.now() - lastCheck;
          const ONE_DAY = 24 * 60 * 60 * 1000;

          if (timeSinceLastCheck < ONE_DAY) {
            console.log(`Skipping automatic update check - last check was ${Math.round(timeSinceLastCheck / (60 * 60 * 1000))} hours ago`);
            return;
          }
        }
      } catch (error) {
        console.warn('Failed to get app config for update check:', error);
        // Fallback to memory-based check if backend fails
        if (lastUpdateCheck) {
          const timeSinceLastCheck = Date.now() - lastUpdateCheck;
          if (timeSinceLastCheck < MIN_CHECK_INTERVAL) {
            console.log(`Skipping update check - last check was ${Math.round(timeSinceLastCheck / 1000)}s ago`);
            return;
          }
        }
      }
    }

    setIsCheckingForUpdates(true);

    // Retry logic with exponential backoff for the CHECK itself (initial + 1 retry)
    let lastError: Error | null = null;
    const maxAttempts = 2;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        console.log(`Checking for updates... (attempt ${attempt + 1}/${maxAttempts})`);

        // Add timeout to prevent hanging
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Update check timed out')), UPDATE_CHECK_TIMEOUT)
        );

        const update = await Promise.race([check(), timeoutPromise]);

        // Success - update last check time in both memory and backend
        setLastUpdateCheck(Date.now());
        try {
          await tauriApi.updateLastCheck();
        } catch (e) {
          console.warn('Failed to update last check timestamp in backend:', e);
        }

        if (update?.available) {
          console.log(`Update available: ${update.version} (current: ${update.currentVersion || 'unknown'})`);
          setUpdateAvailable(true);

          // Only prompt user with dialog if manual check
          if (showNoUpdateMessage) {
            await handleUpdatePrompt(update);
          }
        } else {
          console.log('No update available - running latest version');
          setUpdateAvailable(false);

          // Show "no update" message only for manual checks
          if (showNoUpdateMessage) {
            await message('You are running the latest version!', {
              title: 'No Updates Available',
              kind: 'info'
            });
          }
        }

        // Success - exit retry loop
        setIsCheckingForUpdates(false);
        return;

      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        console.error(`Error checking for updates (attempt ${attempt + 1}):`, lastError);

        // If not the last attempt, wait before retrying
        if (attempt < maxAttempts - 1) {
          const delay = RETRY_DELAYS[attempt] || RETRY_DELAYS[RETRY_DELAYS.length - 1];
          console.log(`Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // All retries failed
    setUpdateAvailable(false);
    setIsCheckingForUpdates(false);

    // Only show error for manual checks to avoid spam
    if (showNoUpdateMessage && lastError) {
      toast({
        title: 'Update Check Failed',
        description: lastError.message.includes('timed out')
          ? 'Update check timed out. Please check your internet connection and try again.'
          : `Failed to check for updates: ${lastError.message}`,
        variant: 'destructive'
      });
    }
  };

  // Setup file watcher event listeners

  // Setup file watcher event listeners
  useEffect(() => {
    let unlistenAdded: (() => void) | undefined;
    let unlistenModified: (() => void) | undefined;
    let unlistenFileChanged: (() => void) | undefined;
    let unlistenWorkflowChanged: (() => void) | undefined;
    let unlistenUpdate: (() => void) | undefined;
    let unlistenImport: (() => void) | undefined;
    let unlistenExport: (() => void) | undefined;

    const setupListeners = async () => {
      try {
        // Listen for project added
        unlistenAdded = await tauriApi.onProjectAdded((project) => {
          console.log('New project detected:', project);
          const workspaceProject: WorkspaceProject = {
            ...project,
            description: project.goal || '',
            created: project.created_at.split('T')[0],
            documents: []
          };
          setProjects(prev => [...prev, workspaceProject]);
          toast({
            title: 'New Project',
            description: `Project "${project.name}" was created`
          });
        });

        // Listen for project modified
        unlistenModified = await tauriApi.onProjectModified((projectId) => {
          console.log('Project modified:', projectId);
          // Refresh the project metadata
          tauriApi.getProject(projectId).then(updated => {
            const workspaceProject: WorkspaceProject = {
              ...updated,
              description: updated.goal || '',
              created: updated.created_at.split('T')[0],
              documents: []
            };
            setProjects(prev => prev.map(p => p.id === projectId ? workspaceProject : p));

            const currentActiveProject = activeProjectRef.current;
            if (currentActiveProject?.id === projectId) {
              setActiveProject(workspaceProject);
            }
          });

          const currentActiveProject = activeProjectRef.current;
          const currentActiveDocument = activeDocumentRef.current;

          if (currentActiveProject?.id === projectId && currentActiveDocument?.type === 'document') {
            tauriApi.readMarkdownFile(projectId, currentActiveDocument.id).then(content => {
              if (content && content !== currentActiveDocument.content) {
                console.log('Reloading active document content due to external change');
                setActiveDocument(prev => {
                  if (prev && prev.id === currentActiveDocument.id) {
                    return { ...prev, content };
                  }
                  return prev;
                });
              }
            }).catch(err => {
              console.error("Failed to reload active document:", err);
            });
          }
        });

        // Listen for file changes within projects
        unlistenFileChanged = await listen('file-changed', (event: any) => {
          const [projectId, fileName] = event.payload as [string, string];
          console.log('File changed:', projectId, fileName);

          const currentActiveProject = activeProjectRef.current;

          // Refresh project files list if this is the active project
          if (currentActiveProject?.id === projectId) {
            tauriApi.getProjectFiles(projectId).then(files => {
              // Update projects list so sidebar is updated
              setProjects(prev => prev.map(p => {
                if (p.id === projectId) {
                  // Find new files to highlight
                  const oldFiles = p.documents?.map(d => d.id) || [];
                  highlightNewFiles(projectId, files, oldFiles);

                  return { ...p, documents: files.map(f => ({ id: f, name: f, type: 'document', content: '' })) };
                }
                return p;
              }));

              // Update active project
              setActiveProject(prev => {
                if (prev && prev.id === projectId) {
                  return { ...prev, documents: files.map(f => ({ id: f, name: f, type: 'document', content: '' })) };
                }
                return prev;
              });
            }).catch(err => {
              console.error("Failed to refresh project files:", err);
            });
          }
        });

        // Listen for workflow changes
        unlistenWorkflowChanged = await listen('workflow-changed', (event: any) => {
          const projectId = event.payload as string;
          console.log('Workflow changed for project:', projectId);

          const currentActiveProject = activeProjectRef.current;

          // Refresh workflows list if this is the active project
          if (currentActiveProject?.id === projectId) {
            tauriApi.getProjectWorkflows(projectId).then(updatedWorkflows => {
              setWorkflows(updatedWorkflows);
            }).catch(err => {
              console.error("Failed to refresh workflows:", err);
            });
          }
        });

        // Listen for background update detection
        unlistenUpdate = await listen('update-available', (event: any) => {
          const version = event.payload;
          setUpdateAvailable(true);
          toast({
            title: 'Update Available',
            description: `A new version (${version}) of productOS is available. Go to Settings to update.`,
            variant: 'default',
          });
        });

        // Listen for native menu import/export
        unlistenImport = await listen('menu:import-document', () => {
          handleImportDocument(activeProjectRef.current?.id).catch(console.error);
        });

        unlistenExport = await listen('menu:export-document', () => {
          handleExportDocument(activeProjectRef.current?.id, activeDocumentRef.current || undefined).catch(console.error);
        });
      } catch (error) {
        console.error('Failed to setup listeners:', error);
      }
    };

    setupListeners();

    return () => {
      if (unlistenAdded) unlistenAdded();
      if (unlistenModified) unlistenModified();
      if (unlistenFileChanged) unlistenFileChanged();
      if (unlistenWorkflowChanged) unlistenWorkflowChanged();
      if (unlistenUpdate) unlistenUpdate();
      if (unlistenImport) unlistenImport();
      if (unlistenExport) unlistenExport();
    };
  }, [toast]);

  // Listen for workflow progress events
  useEffect(() => {
    let unlistenProgress: (() => void) | undefined;
    let unlistenFinished: (() => void) | undefined;

    const setup = async () => {
      unlistenProgress = await tauriApi.onWorkflowProgress((progress) => {
        setWorkflowProgress(progress);
      });

      unlistenFinished = await listen('workflow-finished', (event: any) => {
        const { project_id, workflow_id, run_id, status, error } = event.payload;
        console.log('Workflow finished:', event.payload);

        // Only handle if this is the workflow we're tracking
        if (isWorkflowRunning) {
          setIsWorkflowRunning(false);
          setWorkflowProgress(null);

          // Fetch the full execution result from history
          tauriApi.getWorkflowHistory(project_id, workflow_id).then(history => {
            const execution = history.find(h => h.id === run_id);
            if (execution) {
              setWorkflowResult(execution as any);
              setShowWorkflowResult(true);

              // Show summary toast
              const stepEntries = Object.entries(execution.step_results || {});
              const completedSteps = stepEntries.filter(([, r]) => r.status === 'Completed').length;
              const allOutputFiles = stepEntries.flatMap(([, r]) => r.output_files || []);

              if (status === 'Completed') {
                toast({
                  title: '✓ Workflow Completed',
                  description: `${completedSteps}/${stepEntries.length} steps completed${allOutputFiles.length > 0 ? `, ${allOutputFiles.length} file${allOutputFiles.length > 1 ? 's' : ''} created` : ''}`
                });
              } else if (status === 'PartialSuccess') {
                toast({
                  title: '⚠ Partially Completed',
                  description: `${completedSteps}/${stepEntries.length} steps completed. Some steps failed.`,
                  variant: 'destructive'
                });
              } else {
                toast({
                  title: '✗ Workflow Failed',
                  description: error || 'Execution failed. Check the results for details.',
                  variant: 'destructive'
                });
              }
            }
          }).catch(err => {
            console.error('Failed to fetch workflow result:', err);
            toast({
              title: 'Workflow Finished',
              description: error || 'Workflow execution completed',
              variant: status === 'Failed' ? 'destructive' : 'default'
            });
          });
        }
      });
    };
    setup();

    return () => {
      if (unlistenProgress) unlistenProgress();
      if (unlistenFinished) unlistenFinished();
    };
  }, [isWorkflowRunning, toast]);

  // Automatic update checks - on mount and every 6 hours
  useEffect(() => {
    // Enforce minimum supported version policy first, then perform normal update check.
    enforceUpdatePolicy();

    // Check for updates on startup (silently)
    checkAppForUpdates(false);

    // Initial load of skills and settings
    const initWorkspace = async () => {
      try {
        const [loadedSkills, settings] = await Promise.all([
          tauriApi.getAllSkills(),
          tauriApi.getGlobalSettings()
        ]);
        setSkills(loadedSkills);
        if (settings.theme) {
          setTheme(settings.theme);
        }
      } catch (error) {
        console.error('Failed to initialize workspace settings:', error);
      }
    };
    initWorkspace();

    // Setup periodic refresh every 30 seconds
    const refreshInterval = setInterval(async () => {
      const currentActiveProject = activeProjectRef.current;
      if (currentActiveProject?.id) {
        try {
          // Refresh project files
          const files = await tauriApi.getProjectFiles(currentActiveProject.id);
          const docs = files.map(f => ({ id: f, name: f, type: 'document', content: '' }));

          setProjects(prev => prev.map(p => {
            if (p.id === currentActiveProject.id) {
              const oldFiles = p.documents?.map(d => d.id) || [];
              highlightNewFiles(currentActiveProject.id, files, oldFiles);
              return { ...p, documents: docs };
            }
            return p;
          }));

          setActiveProject(prev => {
            if (prev && prev.id === currentActiveProject.id) {
              return { ...prev, documents: docs };
            }
            return prev;
          });

          // Refresh workflows
          const projectWorkflows = await tauriApi.getProjectWorkflows(currentActiveProject.id);
          setWorkflows(projectWorkflows);

          // Refresh artifacts
          const projectArtifacts = await tauriApi.listArtifacts(currentActiveProject.id);
          setArtifacts(projectArtifacts);
        } catch (error) {
          console.error('Failed to perform periodic refresh:', error);
        }
      }
    }, 60000); // 1 minute (60 seconds)

    // Set up periodic check every 24 hours (86,400,000 milliseconds)
    const updateCheckInterval = setInterval(() => {
      console.log('Running periodic update check...');
      checkAppForUpdates(false);
    }, 86400000); // 24 hours

    // Cleanup interval on unmount
    return () => {
      clearInterval(refreshInterval);
      clearInterval(updateCheckInterval);
    };
  }, []); // Empty dependency array - only run on mount

  useEffect(() => {
    const root = window.document.documentElement;
    const applyTheme = (currentTheme: string) => {
      root.classList.remove('light', 'dark');
      if (currentTheme === 'system') {
        const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        root.classList.add(systemTheme);
      } else {
        root.classList.add(currentTheme);
      }
    };

    applyTheme(theme);

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = (e: MediaQueryListEvent) => {
        root.classList.remove('light', 'dark');
        root.classList.add(e.matches ? 'dark' : 'light');
      };
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    }
  }, [theme]);

  // Keyboard shortcuts
  useEffect(() => {
    const isModifierPressed = (e: KeyboardEvent, isMac: boolean): boolean => {
      return isMac ? e.metaKey : e.ctrlKey;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

      if (!isModifierPressed(e, isMac)) {
        return;
      }

      const keyMap: Record<string, { handler: () => void; shiftRequired: boolean; macOnly?: boolean }> = {
        'n': { handler: handleNewProject, shiftRequired: false },
        'N': { handler: handleNewFile, shiftRequired: true },
        'w': { handler: handleCloseFile, shiftRequired: false },
        'W': { handler: handleCloseProject, shiftRequired: true },
        ',': { handler: handleGlobalSettings, shiftRequired: false },
        'q': { handler: handleExit, shiftRequired: false, macOnly: true }
      };

      const action = keyMap[e.key];

      if (!action) {
        return;
      }

      if (action.macOnly && !isMac) {
        return;
      }

      if (action.shiftRequired !== e.shiftKey) {
        return;
      }

      e.preventDefault();
      action.handler();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeProject, activeDocument]); // Include dependencies for handlers

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
    // Open welcome page after onboarding
    setOpenDocuments([welcomeDocument]);
    setActiveDocument(welcomeDocument);
  };

  const handleProjectSelect = async (project: WorkspaceProject) => {
    setActiveProject(project);

    try {
      // Load project files from backend
      const files = await tauriApi.getProjectFiles(project.id);
      console.log('Loaded project files:', files);

      // Update project with loaded files
      const projectWithDocs: WorkspaceProject = {
        ...project,
        documents: files.map(fileName => ({
          id: fileName,
          name: fileName,
          type: fileName.startsWith('chat-') ? 'chat' : 'document',
          content: '' // Will be loaded when opened
        }))
      };

      setProjects(prev => prev.map(p => p.id === project.id ? projectWithDocs : p));
      setActiveProject(projectWithDocs);

      // Open the first document (chat if available) if current active is welcome or nothing
      if (projectWithDocs.documents && projectWithDocs.documents.length > 0) {
        if (!activeDocument || activeDocument.id === 'welcome') {
          const firstChat = projectWithDocs.documents.find(d => d.type === 'chat');
          const docToOpen = firstChat || projectWithDocs.documents[0];
          setOpenDocuments([docToOpen]);
          setActiveDocument(docToOpen);
        }
      }
    } catch (error) {
      console.error('Failed to load project files:', error);
      toast({
        title: 'Error Loading Files',
        description: error instanceof Error ? error.message : String(error),
        variant: 'destructive'
      });
    }

    // Load workflows for the project
    try {
      const projectWorkflows = await tauriApi.getProjectWorkflows(project.id);
      setWorkflows(projectWorkflows);
    } catch (error) {
      console.error('Failed to load workflows:', error);
      setWorkflows([]);
    }

    // Load artifacts for the project
    try {
      const projectArtifacts = await tauriApi.listArtifacts(project.id);
      setArtifacts(projectArtifacts);
    } catch (error) {
      console.error('Failed to load artifacts:', error);
      setArtifacts([]);
    }


  };

  const handleWorkflowSelect = (workflow: Workflow) => {
    setActiveWorkflow(workflow);
    // Switch to workflow tab if not already there (optional, but good UX)
    setActiveDocument(null); // Clear active document to show workflow canvas
  };

  const handleNewWorkflow = async () => {
    setWorkflowBuilderMode('create');
    setBuilderWorkflow(null);
    setShowWorkflowBuilder(true);
    setActiveTab('workflows');
  };

  const handleEditWorkflowDetails = (workflow: Workflow) => {
    setWorkflowBuilderMode('edit');
    setBuilderWorkflow(workflow);
    setShowWorkflowBuilder(true);
  };

  const handleQuickScheduleWorkflow = (workflow: Workflow) => {
    setActiveWorkflow(workflow);
    setActiveDocument(null);
    setActiveTab('workflows');
    setOpenScheduleNonce((n) => n + 1);
  };

  const handleWorkflowBuilderSubmit = async (payload: {
    name: string;
    description: string;
    projectId: string;
    schedule: any | null;
  }) => {
    const now = new Date().toISOString();

    if (workflowBuilderMode === 'create') {
      const id = payload.name
        .toLowerCase()
        .replace(/ /g, '-')
        .replace(/[^a-z0-9-_]/g, '');

      const createdWorkflow: Workflow = {
        id,
        project_id: payload.projectId,
        name: payload.name,
        description: payload.description,
        steps: [{
          id: `step_${Date.now()}`,
          name: 'Step 1',
          step_type: 'agent' as any,
          config: { parameters: {} } as any,
          depends_on: []
        }],
        version: '1.0.0',
        created: now,
        updated: now,
      };

      await tauriApi.saveWorkflow(createdWorkflow);

      if (payload.schedule) {
        await tauriApi.setWorkflowSchedule(createdWorkflow.project_id, createdWorkflow.id, payload.schedule);
      }

      const updated = await tauriApi.getProjectWorkflows(createdWorkflow.project_id);
      setWorkflows(updated);
      const created = updated.find(w => w.id === createdWorkflow.id) || createdWorkflow;
      setActiveWorkflow(created);
      setActiveDocument(null);
      toast({ title: 'Workflow created', description: `${created.name} is ready` });
      return;
    }

    if (!builderWorkflow) return;

    const updatedWorkflow: Workflow = {
      ...builderWorkflow,
      name: payload.name,
      description: payload.description,
      project_id: payload.projectId,
      updated: now,
    };

    await tauriApi.saveWorkflow(updatedWorkflow);

    if (payload.schedule) {
      await tauriApi.setWorkflowSchedule(updatedWorkflow.project_id, updatedWorkflow.id, payload.schedule);
    } else {
      await tauriApi.clearWorkflowSchedule(updatedWorkflow.project_id, updatedWorkflow.id);
    }

    const refreshed = await tauriApi.getProjectWorkflows(updatedWorkflow.project_id);
    setWorkflows(refreshed);
    const active = refreshed.find(w => w.id === updatedWorkflow.id) || updatedWorkflow;
    setActiveWorkflow(active);
    toast({ title: 'Workflow updated', description: `${active.name} details saved` });
  };

  const handleSaveWorkflow = async (workflow: Workflow) => {
    try {
      console.log('Saving workflow:', JSON.stringify(workflow, null, 2));
      if (workflow.id.startsWith('draft-')) {
        if (!workflow.project_id) {
          console.error('Save failed: No project ID');
          toast({ title: 'Error', description: 'Please select a project for the workflow', variant: 'destructive' });
          return;
        }
        if (!workflow.name) {
          console.error('Save failed: No name');
          toast({ title: 'Error', description: 'Please name your workflow', variant: 'destructive' });
          return;
        }

        // Generate slug-based ID similar to backend logic
        const id = workflow.name
          .toLowerCase()
          .replace(/ /g, '-')
          .replace(/[^a-z0-9-_]/g, '');

        const now = new Date().toISOString();

        const newWorkflow: Workflow = {
          ...workflow,
          id,
          steps: workflow.steps, // Preserve steps!
          created: now,
          updated: now,
          status: 'Saved'
        };

        // Bypass tauriApi.createWorkflow because it fails validation on empty steps
        // Use upsert behavior of saveWorkflow instead
        await tauriApi.saveWorkflow(newWorkflow);

        setWorkflows([...workflows, newWorkflow]);
        setActiveWorkflow(newWorkflow);
      } else {
        const savedWorkflow = { ...workflow, status: 'Saved', updated: new Date().toISOString() };
        await tauriApi.saveWorkflow(savedWorkflow);
        setWorkflows(workflows.map(w => w.id === workflow.id ? savedWorkflow : w));
      }
      console.log('Workflow saved successfully');
      toast({ title: 'Success', description: 'Workflow saved' });
    } catch (error) {
      console.error('Failed to save workflow. Error details:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : String(error),
        variant: 'destructive'
      });
    }
  };

  const handleRunWorkflow = async (workflow: Workflow, parameters?: Record<string, string>) => {
    try {
      // Save first
      await tauriApi.saveWorkflow(workflow);

      setIsWorkflowRunning(true);
      setWorkflowProgress(null);
      setLastRunWorkflowName(workflow.name);

      // Execute workflow in background - returns run_id immediately
      const runId = await tauriApi.executeWorkflow(workflow.project_id, workflow.id, parameters);
      console.log("Workflow execution started with run_id:", runId);

      toast({
        title: 'Workflow Started',
        description: `${workflow.name} is now running in the background...`
      });

      // The workflow-finished event listener will handle completion
    } catch (error) {
      setIsWorkflowRunning(false);
      console.error('Failed to start workflow:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : String(error),
        variant: 'destructive'
      });
    }
  };

  const handleDeleteWorkflow = async (workflow: Workflow) => {
    try {
      await tauriApi.deleteWorkflow(workflow.project_id, workflow.id);

      setWorkflows(prev => prev.filter(w => w.id !== workflow.id));

      if (activeWorkflow?.id === workflow.id) {
        setActiveWorkflow(null);
      }

      toast({
        title: 'Workflow Deleted',
        description: `Workflow "${workflow.name}" has been deleted.`
      });
    } catch (error) {
      console.error('Failed to delete workflow:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : String(error),
        variant: 'destructive'
      });
    }
  };


  const handleDocumentOpen = (doc: Document) => {
    if (!openDocuments.find(d => d.id === doc.id)) {
      setOpenDocuments([...openDocuments, doc]);
    }
    setActiveDocument(doc);
    setActiveWorkflow(null); // Clear active workflow when opening a document
  };

  const handleDocumentClose = (docId: string) => {
    const newDocs = openDocuments.filter(d => d.id !== docId);
    setOpenDocuments(newDocs);
    if (activeDocument?.id === docId && newDocs.length > 0) {
      setActiveDocument(newDocs[newDocs.length - 1]);
    } else if (newDocs.length === 0) {
      setActiveDocument(null);
    }
  };

  const handleNewProject = () => {
    setActiveProject({ id: 'new-project', name: 'New Product', goal: '', description: '', created_at: '', skills: [], documents: [] });
    handleDocumentOpen(projectSettingsDocument);
  };

  const handleProjectCreated = (project: Project) => {
    const adaptedProject: WorkspaceProject = {
      ...project,
      description: project.goal,
      created: new Date().toISOString().split('T')[0],
      documents: []
    };
    setProjects(prev => [...prev, adaptedProject]);
    setActiveProject(adaptedProject);

    // Update the project-settings document name
    setOpenDocuments(prev => prev.map(doc => {
      if (doc.type === 'project-settings') {
        return {
          ...doc,
          name: project.name
        };
      }
      return doc;
    }));
  };

  const handleProjectUpdated = (projectData: any) => {
    setProjects(prev => prev.map(p => p.id === projectData.id ? { ...p, name: projectData.name, description: projectData.description } : p));
    if (activeProject?.id === projectData.id) {
      setActiveProject(prev => prev ? { ...prev, name: projectData.name, description: projectData.description } : null);
    }
  };
  const handleNewSkill = () => {
    const now = new Date().toISOString();
    const draftSkill: Skill = {
      id: 'draft-' + Date.now(),
      name: 'New Skill',
      description: '',
      prompt_template: '',
      capabilities: [],
      parameters: [],
      examples: [],
      version: '1.0.0',
      created: now,
      updated: now
    };
    handleSkillSelect(draftSkill);
  };

  const handleSkillSelect = (skill: Skill) => {
    // Open skill as a document
    const skillDoc: Document = {
      id: `skill-${skill.id}`,
      name: skill.name,
      type: 'skill',
      content: JSON.stringify(skill) // Pass skill data via content
    };
    handleDocumentOpen(skillDoc);
  };

  const handleCreatePresentationFromFile = async (projectId: string, doc: { id: string; name: string }) => {
    try {
      const [fileContent, settings] = await Promise.all([
        tauriApi.readMarkdownFile(projectId, doc.id),
        tauriApi.getProjectSettings(projectId)
      ]);
      const brandSection = settings?.brand_settings
        ? `Brand Rules:\n${settings.brand_settings}`
        : 'Brand Rules:\nNo brand rules defined. Use the default Neutral Corporate theme (Primary: #2C3E50, Accent: #2980B9, Font: Arial).';
      const prompt = `Use the pptx-pitch-architect skill to create a presentation based on the following file content.\n\nFile: ${doc.name}\n\n${fileContent}\n\n${brandSection}`;
      await tauriApi.emit('chat:send-user-message', { content: prompt });
    } catch (error) {
      console.error('Failed to create presentation from file:', error);
    }
  };

  const handleSkillSave = async (updatedSkill: Skill) => {
    // Update local state
    setSkills(prev => {
      const exists = prev.some(s => s.id === updatedSkill.id);
      if (exists) {
        return prev.map(s => s.id === updatedSkill.id ? updatedSkill : s);
      }
      // If it's a new skill, add it
      return [...prev, updatedSkill];
    });

    // Update the open document if it exists (to keep name in sync)
    setOpenDocuments(prev => prev.map(doc => {
      // If this document is a skill, check if it's the one we just saved
      // We check for ID match OR if it's a draft document (assuming only one draft can be saved at a time from its own editor)
      if (doc.type === 'skill' && (doc.id === `skill-${updatedSkill.id}` || doc.id.includes('draft-'))) {
        return {
          ...doc,
          id: `skill-${updatedSkill.id}`,
          name: updatedSkill.name,
          content: JSON.stringify(updatedSkill)
        };
      }
      return doc;
    }));

    // Update active document if it's this skill
    setActiveDocument(prev => {
      if (prev?.type === 'skill' && (prev.id === `skill-${updatedSkill.id}` || prev.id.includes('draft-'))) {
        return {
          ...prev,
          id: `skill-${updatedSkill.id}`,
          name: updatedSkill.name,
          content: JSON.stringify(updatedSkill)
        };
      }
      return prev;
    });
  };

  const handleProjectSettings = () => {
    handleDocumentOpen(projectSettingsDocument);
  };

  const handleGlobalSettings = () => {
    handleDocumentOpen(globalSettingsDocument);
  };

  const handleOpenWelcome = () => {
    handleDocumentOpen(welcomeDocument);
  };

  const handleNewFile = () => {
    if (!activeProject) {
      toast({
        title: 'Error',
        description: 'No active project selected',
        variant: 'destructive'
      });
      return;
    }

    setShowFileDialog(true);
  };

  const handleAddFileToProject = (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (project) {
      setActiveProject(project);
      setShowFileDialog(true);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    const confirmed = await ask('Are you sure you want to delete this project? This cannot be undone.', { title: 'Delete Project', kind: 'warning' });
    if (confirmed) {
      try {
        await tauriApi.deleteProject(projectId);
        // Optimistic update
        setProjects(prev => prev.filter(p => p.id !== projectId));
        if (activeProject?.id === projectId) {
          setActiveProject(null);
          setOpenDocuments([]);
          setActiveDocument(null);
        }
        toast({ title: 'Success', description: 'Project deleted' });
      } catch (error) {
        console.error('Failed to delete project:', error);
        toast({
          title: 'Error',
          description: error instanceof Error ? error.message : String(error),
          variant: 'destructive'
        });
      }
    }
  };

  const handleImportDocument = async (projectId?: string) => {
    const targetProjectId = projectId || activeProjectRef.current?.id;
    if (!targetProjectId) {
      toast({
        title: 'No Project Selected',
        description: 'Please select a project before importing a document.',
        variant: 'destructive'
      });
      return;
    }

    try {
      const selected = await open({
        multiple: false,
        filters: [{
          name: 'Documents',
          extensions: ['docx', 'pdf', 'vtt', 'md', 'txt']
        }]
      });

      if (!selected || typeof selected !== 'string') return;

      toast({ title: 'Importing...', description: 'Importing document into project' });

      let newFileName: string;
      if (selected.toLowerCase().endsWith('.vtt')) {
        toast({ title: 'Summarizing...', description: 'Analyzing transcript with AI' });
        newFileName = await tauriApi.importTranscript(targetProjectId, selected);
      } else {
        newFileName = await tauriApi.importDocument(targetProjectId, selected);
      }

      // Refresh project files optimistically
      const files = await tauriApi.getProjectFiles(targetProjectId);
      const docs = files.map(f => ({ id: f, name: f, type: 'document', content: '' }));

      setProjects(prev => prev.map(p => p.id === targetProjectId ? { ...p, documents: docs } : p));
      if (activeProject?.id === targetProjectId) {
        setActiveProject(prev => prev ? { ...prev, documents: docs } : null);
        // Open the imported document
        const newDoc: Document = { id: newFileName, name: newFileName, type: 'document', content: '' };
        handleDocumentOpen(newDoc);
      }

      toast({ title: 'Success', description: `Document imported as ${newFileName}` });
    } catch (error) {
      console.error('Import failed:', error);
      const errMsg = error instanceof Error ? error.message : String(error);

      if (errMsg.includes('PANDOC_MISSING')) {
        // Emit an event to ChatPanel
        await tauriApi.emit('chat:add-message', {
          role: 'assistant',
          content: 'I noticed that **Pandoc** is missing on your system. It is required for importing and exporting documents.\n\n<PROPOSE_CONFIG>{"type":"install_pandoc"}</PROPOSE_CONFIG>'
        });
        toast({
          title: 'Pandoc Required',
          description: 'Check the chat for installation instructions.',
          variant: 'destructive'
        });
      } else {
        toast({
          title: 'Import Failed',
          description: errMsg,
          variant: 'destructive'
        });
      }
    }
  };

  const handleExportDocument = async (projectId?: string, doc?: Document) => {
    const targetProjectId = projectId || activeProjectRef.current?.id;
    const documentToExport = doc || activeDocumentRef.current;

    if (!targetProjectId || !documentToExport || documentToExport.type !== 'document') {
      toast({
        title: 'Nothing to Export',
        description: 'Please open a document to export it.',
        variant: 'destructive'
      });
      return;
    }

    try {
      const suggestedName = documentToExport.name.replace(/\.[^/.]+$/, "");
      const selected = await save({
        filters: [
          { name: 'Word Document', extensions: ['docx'] },
          { name: 'PDF Document', extensions: ['pdf'] }
        ],
        defaultPath: suggestedName
      });

      if (!selected) return;

      toast({ title: 'Exporting...', description: 'Exporting document to target format' });

      const format = selected.endsWith('.pdf') ? 'pdf' : 'docx';
      await tauriApi.exportDocument(targetProjectId, documentToExport.id, selected, format);

      toast({ title: 'Success', description: `Document exported successfully to ${selected}` });
    } catch (error) {
      console.error('Export failed:', error);
      const errMsg = error instanceof Error ? error.message : String(error);

      if (errMsg.includes('PANDOC_MISSING')) {
        await tauriApi.emit('chat:add-message', {
          role: 'assistant',
          content: 'I noticed that **Pandoc** is missing on your system. It is required for exporting documents.\n\n<PROPOSE_CONFIG>{"type":"install_pandoc"}</PROPOSE_CONFIG>'
        });
        toast({
          title: 'Pandoc Required',
          description: 'Check the chat for installation instructions.',
          variant: 'destructive'
        });
      } else {
        toast({
          title: 'Export Failed',
          description: errMsg,
          variant: 'destructive'
        });
      }
    }
  };

  const handleInstallPandoc = async () => {
    try {
      toast({ title: 'Installing Pandoc', description: 'Starting installation via homebrew...' });

      // Simulating a real installation that would trigger a tauri command
      await tauriApi.runInstallation();
      toast({ title: 'Success', description: 'Pandoc installed successfully. You can now import/export files.' });
    } catch (error) {
      console.error('Failed to install Pandoc:', error);
      toast({ title: 'Installation Failed', description: String(error), variant: 'destructive' });
    }
  };


  const handleDeleteFile = async (projectId: string, fileName: string) => {
    const confirmed = await ask(`Are you sure you want to delete ${fileName}?`, { title: 'Delete File', kind: 'warning' });
    if (confirmed) {
      try {
        await tauriApi.deleteMarkdownFile(projectId, fileName);
        // Close if open
        handleDocumentClose(fileName);
        toast({ title: 'Success', description: 'File deleted' });
      } catch (error) {
        console.error('Failed to delete file:', error);
        toast({
          title: 'Error',
          description: error instanceof Error ? error.message : String(error),
          variant: 'destructive'
        });
      }
    }
  };

  const handleRenameProject = async (projectId: string, newName: string) => {
    try {
      await tauriApi.renameProject(projectId, newName);
      // Optimistic update
      setProjects(prev => prev.map(p => p.id === projectId ? { ...p, name: newName } : p));
      toast({ title: 'Success', description: 'Project renamed' });
    } catch (error) {
      console.error('Failed to rename project:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : String(error),
        variant: 'destructive'
      });
    }
  };

  const handleRenameFile = async (projectId: string, fileId: string, newName: string) => {
    try {
      if (fileId === newName) return;

      await tauriApi.renameFile(projectId, fileId, newName);

      // Update open documents if the renamed file is open
      setOpenDocuments(prev => prev.map(doc => {
        if (doc.id === fileId) {
          return { ...doc, id: newName, name: newName };
        }
        return doc;
      }));

      // Update active document if it's the one being renamed
      if (activeDocument?.id === fileId) {
        setActiveDocument(prev => prev ? { ...prev, id: newName, name: newName } : prev);
      }

      // Re-fetch project to update sidebar file list
      const updatedProjectList = await tauriApi.getAllProjects();
      const workspaceProjects: WorkspaceProject[] = updatedProjectList.map(p => ({
        ...p,
        description: p.goal || '',
        created: p.created_at.split('T')[0],
        documents: []
      }));
      setProjects(workspaceProjects);

      toast({ title: 'Success', description: 'File renamed successfully' });
    } catch (error) {
      console.error('Failed to rename file:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : String(error),
        variant: 'destructive'
      });
    }
  };

  const handleImportSkill = async (npxCommand: string) => {
    try {
      const importedSkill = await tauriApi.importSkill(npxCommand);

      toast({
        title: 'Success',
        description: `Skill "${importedSkill.name}" imported successfully!`
      });

      // Refresh skills list
      const loadedSkills = await tauriApi.getAllSkills();
      setSkills(loadedSkills);
    } catch (error) {
      console.error('Failed to import skill:', error);
      throw error; // Re-throw so dialog can show error
    }
  };

  const handleFileFormSubmit = async (fileName: string) => {
    if (!activeProject) {
      return;
    }

    try {
      // Create an empty file
      await tauriApi.writeMarkdownFile(activeProject.id, fileName, '# New Document\n\n');

      // Create document object and open it
      const newDoc: Document = {
        id: fileName,
        name: fileName,
        type: 'document',
        content: '# New Document\n\n'
      };

      handleDocumentOpen(newDoc);

      toast({
        title: 'Success',
        description: `File "${fileName}" created successfully`
      });

      // Update project files optimistically
      const updatedDocuments = [
        ...(activeProject.documents || []),
        newDoc
      ];

      const projectWithDocs: WorkspaceProject = {
        ...activeProject,
        documents: updatedDocuments
      };

      // Update both projects list and active project reference
      setProjects(prev => prev.map(p => p.id === activeProject.id ? projectWithDocs : p));
      setActiveProject(projectWithDocs);

      // Close the dialog
      setShowFileDialog(false);
    } catch (error) {
      console.error('Failed to create new file:', error);
      toast({
        title: 'Error',
        description: `Failed to create file: ${error}`,
        variant: 'destructive'
      });
    }
  };

  const handleCloseFile = () => {
    if (activeDocument) {
      handleDocumentClose(activeDocument.id);
    }
  };

  const handleCloseOthers = (docId: string) => {
    const doc = openDocuments.find(d => d.id === docId);
    if (doc) {
      setOpenDocuments([doc]);
      setActiveDocument(doc);
    }
  };

  const handleCloseRight = (docId: string) => {
    const index = openDocuments.findIndex(d => d.id === docId);
    if (index !== -1) {
      const newDocs = openDocuments.slice(0, index + 1);
      setOpenDocuments(newDocs);
      // If active doc was closed (it was to the right), set active to the current doc
      if (activeDocument && !newDocs.find(d => d.id === activeDocument.id)) {
        setActiveDocument(openDocuments[index]);
      }
    }
  };

  const handleCloseAll = () => {
    setOpenDocuments([]);
    setActiveDocument(null);
  };

  const handleCloseProject = () => {
    if (!activeProject) {
      toast({
        title: 'Info',
        description: 'No project is currently open',
      });
      return;
    }

    // Close all open documents
    setOpenDocuments([welcomeDocument]);
    setActiveDocument(welcomeDocument);

    // Clear active project
    setActiveProject(null);

    toast({
      title: 'Project Closed',
      description: `"${activeProject.name}" has been closed`
    });
  };

  const handleExit = async () => {
    try {
      console.log("Clicked on Exit");
      await exit(0);
    } catch (error) {
      console.error('Failed to exit:', error);
      try {
        const window = getCurrentWindow();
        await window.close();
      } catch (e) {
        console.error('Failed to close window:', e);
      }
    }
  };

  // Edit menu handlers
  const handleUndo = () => {
    document.execCommand('undo');
  };

  const handleRedo = () => {
    document.execCommand('redo');
  };

  const handleCut = () => {
    document.execCommand('cut');
  };

  const handleCopy = () => {
    document.execCommand('copy');
  };

  const handlePaste = () => {
    document.execCommand('paste');
  };

  const handleFind = () => {
    setFindMode('find');
    setShowFindDialog(true);
  };

  const handleReplace = () => {
    setFindMode('replace');
    setShowFindDialog(true);
  };

  const handleFindText = (searchText: string, options: FindOptions) => {
    try {
      if (!searchText) return;

      // Get the main content area
      const contentArea = document.querySelector('.main-panel') || document.body;
      const textContent = contentArea.textContent || '';

      // Prepare search text based on options
      let searchPattern = searchText;
      if (!options.caseSensitive) {
        searchPattern = searchPattern.toLowerCase();
      }

      // Build regex pattern for whole word matching
      let regex: RegExp;
      if (options.wholeWord) {
        const escapedSearch = searchPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        regex = new RegExp(`\\b${escapedSearch}\\b`, options.caseSensitive ? 'g' : 'gi');
      } else {
        const escapedSearch = searchPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        regex = new RegExp(escapedSearch, options.caseSensitive ? 'g' : 'gi');
      }

      // Search for matches in text content
      const compareText = options.caseSensitive ? textContent : textContent.toLowerCase();
      const matches = compareText.match(regex);

      if (!matches || matches.length === 0) {
        toast({
          title: 'Not Found',
          description: `No matches found for "${searchText}"`,
        });
        return;
      }

      // Use CSS.highlights API if available (modern browsers)
      if ('highlights' in CSS) {
        const cssHighlights = CSS.highlights as any;

        // Clear previous highlights
        cssHighlights.clear();

        // Create ranges for all matches
        const ranges: Range[] = [];
        const walker = document.createTreeWalker(
          contentArea,
          NodeFilter.SHOW_TEXT,
          null
        );

        let node: Node | null;
        while ((node = walker.nextNode())) {
          const text = node.textContent || '';
          const compareNodeText = options.caseSensitive ? text : text.toLowerCase();
          let match;
          regex.lastIndex = 0; // Reset regex

          while ((match = regex.exec(compareNodeText)) !== null) {
            const range = new Range();
            range.setStart(node, match.index);
            range.setEnd(node, match.index + match[0].length);
            ranges.push(range);
          }
        }

        if (ranges.length > 0) {
          const highlight = new (window as any).Highlight(...ranges);
          cssHighlights.set('search-results', highlight);

          // Scroll to first match
          ranges[0].startContainer.parentElement?.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
          });

          toast({
            title: 'Found',
            description: `Found ${matches.length} match${matches.length > 1 ? 'es' : ''}`,
          });
        }
      } else {
        // Fallback: Use CSS classes and DOM manipulation for older browsers
        // Clear previous highlights
        contentArea.querySelectorAll('.search-highlight').forEach(el => {
          const parent = el.parentNode;
          if (parent) {
            parent.replaceChild(document.createTextNode(el.textContent || ''), el);
            parent.normalize(); // Merge adjacent text nodes
          }
        });

        const walker = document.createTreeWalker(
          contentArea,
          NodeFilter.SHOW_TEXT,
          null
        );

        let node: Node | null;
        let firstMatch: Node | null = null;

        while ((node = walker.nextNode())) {
          const text = node.textContent || '';
          const compareNodeText = options.caseSensitive ? text : text.toLowerCase();
          let match;
          regex.lastIndex = 0;

          const matches: { index: number; length: number }[] = [];
          while ((match = regex.exec(compareNodeText)) !== null) {
            matches.push({ index: match.index, length: match[0].length });
          }

          if (matches.length > 0 && node.parentElement) {
            const parent = node.parentElement;
            const fragment = document.createDocumentFragment();
            let lastIndex = 0;

            matches.forEach(({ index, length }) => {
              // Add text before match
              if (index > lastIndex) {
                fragment.appendChild(document.createTextNode(text.substring(lastIndex, index)));
              }

              // Add highlighted match
              const mark = document.createElement('mark');
              mark.className = 'search-highlight';
              mark.style.backgroundColor = '#ffeb3b';
              mark.style.color = '#000';
              mark.textContent = text.substring(index, index + length);
              fragment.appendChild(mark);

              if (!firstMatch) firstMatch = mark;
              lastIndex = index + length;
            });

            // Add remaining text
            if (lastIndex < text.length) {
              fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
            }

            parent.replaceChild(fragment, node);
          }
        }

        // Scroll to first match
        if (firstMatch) {
          (firstMatch as HTMLElement).scrollIntoView({
            behavior: 'smooth',
            block: 'center'
          });
        }

        toast({
          title: 'Found',
          description: `Found ${matches.length} match${matches.length > 1 ? 'es' : ''}`,
        });
      }
    } catch (error) {
      console.error('Find error:', error);
      toast({
        title: 'Find Failed',
        description: error instanceof Error ? error.message : 'Failed to search text',
        variant: 'destructive'
      });
    }
  };

  const handleReplaceText = (searchText: string, replaceText: string, replaceAll: boolean) => {
    try {
      const selection = window.getSelection();
      if (!selection) {
        toast({
          title: 'Replace Failed',
          description: 'Could not access text selection',
          variant: 'destructive'
        });
        return;
      }

      if (replaceAll) {
        // For replace all, we need to work with the document content
        // This is a simplified implementation - in production you'd want to work with the editor's content
        toast({
          title: 'Replace All',
          description: 'Replace all functionality requires editor integration. Please use find and replace individually for now.',
        });
      } else {
        // Replace current selection if it matches
        const selectedText = selection.toString();
        if (selectedText === searchText) {
          // Use modern Selection API instead of deprecated execCommand
          const range = selection.getRangeAt(0);
          range.deleteContents();
          range.insertNode(document.createTextNode(replaceText));

          // Collapse selection to end of inserted text
          range.collapse(false);
          selection.removeAllRanges();
          selection.addRange(range);

          toast({
            title: 'Replaced',
            description: `Replaced "${searchText}" with "${replaceText}"`,
          });
          // Find next occurrence
          const CASE_SENSITIVE = false;
          const BACKWARDS = false;
          const WRAP_AROUND = true;
          const WHOLE_WORD = false;
          const SEARCH_IN_FRAMES = false;
          const SHOW_DIALOG = false;
          const windowWithFind = window as any;
          windowWithFind.find(searchText, CASE_SENSITIVE, BACKWARDS, WRAP_AROUND, WHOLE_WORD, SEARCH_IN_FRAMES, SHOW_DIALOG);
        } else {
          toast({
            title: 'No Match',
            description: 'Current selection does not match search text',
          });
        }
      }
    } catch (error) {
      console.error('Replace error:', error);
      toast({
        title: 'Replace Failed',
        description: error instanceof Error ? error.message : 'Failed to replace text',
        variant: 'destructive'
      });
    }
  };

  const handleFindNext = () => {
    try {
      // Use browser's native find functionality to go to next match
      const CASE_SENSITIVE = false;
      const BACKWARDS = false;
      const WRAP_AROUND = true;
      const WHOLE_WORD = false;
      const SEARCH_IN_FRAMES = false;
      const SHOW_DIALOG = false;

      const windowWithFind = window as any;
      const found = windowWithFind.find('', CASE_SENSITIVE, BACKWARDS, WRAP_AROUND, WHOLE_WORD, SEARCH_IN_FRAMES, SHOW_DIALOG);

      if (!found) {
        toast({
          title: 'No More Matches',
          description: 'No more matches found',
        });
      }
    } catch (error) {
      console.error('Find next error:', error);
      toast({
        title: 'Find Next Failed',
        description: error instanceof Error ? error.message : 'Failed to find next match',
        variant: 'destructive'
      });
    }
  };

  const handleFindPrevious = () => {
    try {
      // Use browser's native find functionality to go to previous match
      const CASE_SENSITIVE = false;
      const BACKWARDS = true;
      const WRAP_AROUND = true;
      const WHOLE_WORD = false;
      const SEARCH_IN_FRAMES = false;
      const SHOW_DIALOG = false;

      const windowWithFind = window as any;
      const found = windowWithFind.find('', CASE_SENSITIVE, BACKWARDS, WRAP_AROUND, WHOLE_WORD, SEARCH_IN_FRAMES, SHOW_DIALOG);

      if (!found) {
        toast({
          title: 'No More Matches',
          description: 'No more matches found',
        });
      }
    } catch (error) {
      console.error('Find previous error:', error);
      toast({
        title: 'Find Previous Failed',
        description: error instanceof Error ? error.message : 'Failed to find previous match',
        variant: 'destructive'
      });
    }
  };

  const handleFindInFiles = async () => {
    if (!activeProject) {
      toast({
        title: 'No Project Selected',
        description: 'Please select a project to search in files',
        variant: 'destructive'
      });
      return;
    }

    // Open the find-in-files dialog
    setShowFindInFilesDialog(true);
  };

  const handleFindInFilesSearch = async (searchText: string, options: FindOptions) => {
    if (!activeProject) return;

    try {
      const matches = await tauriApi.searchInFiles(
        activeProject.id,
        searchText,
        options.caseSensitive,
        options.useRegex
      );

      if (matches.length === 0) {
        toast({
          title: 'No Matches Found',
          description: `No matches found for "${searchText}" in project files`,
        });
      } else {
        // Show results in a toast
        const fileCount = new Set(matches.map(m => m.file_name)).size;
        toast({
          title: 'Search Complete',
          description: `Found ${matches.length} matches in ${fileCount} files. Opening first match...`,
        });
        console.log('Search results:', matches);

        // Open the first file with the match
        if (matches.length > 0) {
          const firstMatch = matches[0];
          try {
            // Read the file content
            const content = await tauriApi.readMarkdownFile(activeProject.id, firstMatch.file_name);

            // Create a document for the file
            const doc: Document = {
              id: firstMatch.file_name,
              name: firstMatch.file_name,
              type: 'document',
              content: content
            };

            // Open the document
            handleDocumentOpen(doc);

            // After a short delay to allow the document to render, scroll to the line
            setTimeout(() => {
              // Try to find and highlight the line in the rendered content
              const lineNumber = firstMatch.line_number;

              // Find all text nodes and locate the line
              const contentArea = document.querySelector('.main-panel');
              if (contentArea) {
                // Split content by lines and find the target line
                const lines = content.split('\n');
                if (lineNumber > 0 && lineNumber <= lines.length) {
                  const targetLine = lines[lineNumber - 1];

                  // Use CSS.highlights API if available
                  if ('highlights' in CSS) {
                    const cssHighlights = CSS.highlights as any;
                    cssHighlights.clear();

                    // Create a tree walker to find text nodes
                    const walker = document.createTreeWalker(
                      contentArea,
                      NodeFilter.SHOW_TEXT,
                      null
                    );

                    let node: Node | null;
                    const ranges: Range[] = [];

                    while ((node = walker.nextNode())) {
                      const text = node.textContent || '';
                      if (text.includes(targetLine.trim()) || text.includes(searchText)) {
                        const range = new Range();
                        range.selectNodeContents(node);
                        ranges.push(range);

                        // Scroll to this node
                        node.parentElement?.scrollIntoView({
                          behavior: 'smooth',
                          block: 'center'
                        });
                        break;
                      }
                    }

                    if (ranges.length > 0) {
                      const highlight = new (window as any).Highlight(...ranges);
                      cssHighlights.set('search-results', highlight);
                    }
                  } else {
                    // Fallback: Use CSS classes for older browsers
                    // Clear previous highlights
                    contentArea.querySelectorAll('.search-highlight').forEach(el => {
                      const parent = el.parentNode;
                      if (parent) {
                        parent.replaceChild(document.createTextNode(el.textContent || ''), el);
                        parent.normalize();
                      }
                    });

                    const walker = document.createTreeWalker(
                      contentArea,
                      NodeFilter.SHOW_TEXT,
                      null
                    );

                    let node: Node | null;
                    while ((node = walker.nextNode())) {
                      const text = node.textContent || '';
                      if (text.includes(targetLine.trim()) || text.includes(searchText)) {
                        const parent = node.parentElement;
                        if (parent) {
                          const mark = document.createElement('mark');
                          mark.className = 'search-highlight';
                          mark.style.backgroundColor = '#ffeb3b';
                          mark.style.color = '#000';
                          mark.textContent = text;
                          parent.replaceChild(mark, node);

                          // Scroll to highlighted element
                          mark.scrollIntoView({
                            behavior: 'smooth',
                            block: 'center'
                          });
                        }
                        break;
                      }
                    }
                  }
                }
              }
            }, 500);

          } catch (error) {
            console.error('Failed to open file:', error);
            toast({
              title: 'Error',
              description: `Failed to open file: ${firstMatch.file_name}`,
              variant: 'destructive'
            });
          }
        }
      }
    } catch (error) {
      console.error('Search in files error:', error);
      toast({
        title: 'Search Failed',
        description: error instanceof Error ? error.message : 'Failed to search in files',
        variant: 'destructive'
      });
    } finally {
      setShowFindInFilesDialog(false);
    }
  };

  const handleReplaceInFiles = async () => {
    if (!activeProject) {
      toast({
        title: 'No Project Selected',
        description: 'Please select a project to replace in files',
        variant: 'destructive'
      });
      return;
    }

    // Open the replace-in-files dialog
    setShowReplaceInFilesDialog(true);
  };

  const handleReplaceInFilesSearch = async (searchText: string, replaceText: string) => {
    if (!activeProject) return;

    try {
      // First, find all matches
      const matches = await tauriApi.searchInFiles(activeProject.id, searchText, false, false);

      if (matches.length === 0) {
        toast({
          title: 'No Matches Found',
          description: `No matches found for "${searchText}" in project files`,
        });
        return;
      }

      // Get unique file names
      const fileNames = Array.from(new Set(matches.map(m => m.file_name)));

      // Store data and show confirmation via toast with action
      setPendingReplaceData({ searchText, replaceText, matches, fileNames });

      toast({
        title: 'Confirm Replacement',
        description: `Replace ${matches.length} occurrences in ${fileNames.length} files?`,
        action: (
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => confirmReplaceInFiles()}
            >
              Replace
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPendingReplaceData(null)}
            >
              Cancel
            </Button>
          </div>
        ),
      });

      setShowReplaceInFilesDialog(false);
    } catch (error) {
      console.error('Replace in files error:', error);
      toast({
        title: 'Replace Failed',
        description: error instanceof Error ? error.message : 'Failed to search for replacements',
        variant: 'destructive'
      });
      setShowReplaceInFilesDialog(false);
    }
  };

  const confirmReplaceInFiles = async () => {
    if (!pendingReplaceData || !activeProject) return;

    const { searchText, replaceText, fileNames } = pendingReplaceData;

    try {
      // Perform replacement
      const replacementCount = await tauriApi.replaceInFiles(
        activeProject.id,
        searchText,
        replaceText,
        false,
        fileNames
      );

      toast({
        title: 'Replace Complete',
        description: `Replaced ${replacementCount} occurrences in ${fileNames.length} files`,
      });
    } catch (error) {
      console.error('Replace in files error:', error);
      toast({
        title: 'Replace Failed',
        description: error instanceof Error ? error.message : 'Failed to replace in files',
        variant: 'destructive'
      });
    } finally {
      setPendingReplaceData(null);
    }
  };

  // Selection menu handlers
  const handleSelectAll = () => {
    document.execCommand('selectAll');
  };

  const handleExpandSelection = () => {
    try {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) {
        toast({
          title: 'No Selection',
          description: 'Please select some text first',
          variant: 'destructive'
        });
        return;
      }

      const range = selection.getRangeAt(0);
      const container = range.commonAncestorContainer;

      // If we're in a text node, expand to the parent element
      if (container.nodeType === Node.TEXT_NODE && container.parentElement) {
        const newRange = document.createRange();
        newRange.selectNodeContents(container.parentElement);
        selection.removeAllRanges();
        selection.addRange(newRange);
      } else if (container.parentElement) {
        // Expand to parent element
        const newRange = document.createRange();
        newRange.selectNodeContents(container.parentElement);
        selection.removeAllRanges();
        selection.addRange(newRange);
      }
    } catch (error) {
      console.error('Failed to expand selection:', error);
      toast({
        title: 'Expand Selection Failed',
        description: error instanceof Error ? error.message : 'Failed to expand selection',
        variant: 'destructive'
      });
    }
  };

  const handleCopyAsMarkdown = async () => {
    try {
      // Get the current selection
      const selection = window.getSelection();
      if (!selection || selection.toString().length === 0) {
        toast({
          title: 'No Selection',
          description: 'Please select some text to copy as markdown',
          variant: 'destructive'
        });
        return;
      }

      // Try to find the chat message element that contains the selection
      let markdownContent = selection.toString();

      // Check if selection is within a chat message
      const range = selection.getRangeAt(0);
      let container: Node | null = range.commonAncestorContainer;

      // Traverse up to find the message container
      while (container && container !== document.body) {
        const element = container.nodeType === Node.ELEMENT_NODE ? container as Element : container.parentElement;
        if (element) {
          // Look for the message content attribute or data attribute
          const messageElement = element.closest('[data-message-content]');
          if (messageElement) {
            const content = messageElement.getAttribute('data-message-content');
            if (content) {
              // If we found the full message content, check if user selected part of it
              const selectedText = selection.toString();
              if (content.includes(selectedText) || selectedText.length > 20) {
                // If selection is substantial or matches, use the markdown content
                markdownContent = content;
              } else {
                // For partial selections, try to preserve markdown formatting
                markdownContent = selectedText;
              }
              break;
            }
          }
        }
        container = container.parentNode as Node | null;
      }

      // Copy to clipboard
      await navigator.clipboard.writeText(markdownContent);

      toast({
        title: 'Copied',
        description: 'Selection copied to clipboard as markdown'
      });
    } catch (error) {
      console.error('Failed to copy as markdown:', error);
      toast({
        title: 'Copy Failed',
        description: error instanceof Error ? error.message : 'Failed to copy selection to clipboard',
        variant: 'destructive'
      });
    }
  };

  // Help menu handlers
  const handleReleaseNotes = () => {
    window.open('https://github.com/AIResearchFactory/ai-researcher/releases', '_blank');
  };

  const handleDocumentation = () => {
    window.open('https://github.com/AIResearchFactory/ai-researcher/blob/main/docs/README.md', '_blank');
  };

  const handleCheckForUpdates = () => {
    checkAppForUpdates(true);
  };

  const toggleTheme = async () => {
    // If we are currently in system mode, the next toggle should be the opposite of the resolved theme
    const nextTheme = resolvedTheme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);

    try {
      const currentSettings = await tauriApi.getGlobalSettings();
      await tauriApi.saveGlobalSettings({ ...currentSettings, theme: nextTheme });
    } catch (error) {
      console.error('Failed to save theme setting:', error);
    }
  };

  // Detect platform on mount
  useEffect(() => {
    const detectPlatform = async () => {
      const platformType = await tauriApi.getOsType();
      setPlatform(platformType);
    };
    detectPlatform();
  }, []);

  // Listen for menu events from native macOS menu
  useEffect(() => {
    if (platform !== 'macos') return;

    const unlisten: Promise<() => void>[] = [];

    const setupListeners = async () => {
      unlisten.push(listen('menu:new-project', () => handleNewProject()));
      unlisten.push(listen('menu:new-file', () => handleNewFile()));
      unlisten.push(listen('menu:close-file', () => handleCloseFile()));
      unlisten.push(listen('menu:close-project', () => handleCloseProject()));
      unlisten.push(listen('menu:find', () => handleFind()));
      unlisten.push(listen('menu:replace', () => handleReplace()));
      unlisten.push(listen('menu:find-in-files', () => handleFindInFiles()));
      unlisten.push(listen('menu:replace-in-files', () => handleReplaceInFiles()));
      unlisten.push(listen('menu:expand-selection', () => handleExpandSelection()));
      unlisten.push(listen('menu:copy-as-markdown', () => handleCopyAsMarkdown()));
      unlisten.push(listen('menu:welcome', () => handleOpenWelcome()));
      unlisten.push(listen('menu:release-notes', () => handleReleaseNotes()));
      unlisten.push(listen('menu:documentation', () => handleDocumentation()));
      unlisten.push(listen('menu:check-for-updates', () => handleCheckForUpdates()));
      unlisten.push(listen('menu:settings', () => handleGlobalSettings()));
    };

    setupListeners();

    return () => {
      unlisten.forEach(async (unlistenFn) => {
        const fn = await unlistenFn;
        fn();
      });
    };
  }, [platform]);

  // Load initial data on mount
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        // Load projects
        const loadedProjects = await tauriApi.getAllProjects();
        // Convert Project to WorkspaceProject
        const workspaceProjects: WorkspaceProject[] = loadedProjects.map(p => ({
          ...p,
          description: p.goal || '',
          created: p.created_at.split('T')[0],
          documents: []
        }));
        setProjects(workspaceProjects);

        // Load skills
        const loadedSkills = await tauriApi.getAllSkills();
        setSkills(loadedSkills);

        // Load global settings to get theme
        const settings = await tauriApi.getGlobalSettings();
        if (settings.theme) {
          setTheme(settings.theme);
          document.documentElement.classList.toggle('dark', settings.theme === 'dark');
        }

        // If no projects, open welcome
        if (workspaceProjects.length === 0) {
          setOpenDocuments([welcomeDocument]);
          setActiveDocument(welcomeDocument);
        } else {
          // Select first project by default
          await handleProjectSelect(workspaceProjects[0]);
        }

        // Check for updates automatically on startup (silent, no message if no update)
        checkAppForUpdates(false);

      } catch (error) {
        console.error('Failed to load initial data:', error);
        toast({
          title: 'Error Loading Data',
          description: error instanceof Error ? error.message : String(error),
          variant: 'destructive'
        });
        setProjects([]);
        setSkills([]);
        setActiveProject(null);
      }
    };

    loadInitialData();
  }, []); // Run once on mount

  // Show onboarding if requested
  if (showOnboarding) {
    return <Onboarding onComplete={handleOnboardingComplete} onSkip={handleOnboardingComplete} />;
  }

  return (
    <div className="h-full w-full overflow-hidden bg-background text-foreground flex flex-col relative">
      {/* Ambient Background (shared with Onboarding look) */}
      <div className="absolute inset-0 bg-[url(&quot;data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.05'/%3E%3C/svg%3E&quot;)] opacity-40 pointer-events-none z-0" />
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-background to-blue-500/5 pointer-events-none z-0" />

      <div className="relative z-10 flex flex-col h-full overflow-hidden">
        {/* Only show custom MenuBar on non-macOS platforms */}
        {platform !== 'macos' && (
          <MenuBar
            onNewProject={handleNewProject}
            onNewFile={handleNewFile}
            onCloseFile={handleCloseFile}
            onCloseProject={handleCloseProject}
            onOpenWelcome={handleOpenWelcome}
            onOpenGlobalSettings={handleGlobalSettings}
            onFind={handleFind}
            onReplace={handleReplace}
            onExit={handleExit}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onCut={handleCut}
            onCopy={handleCopy}
            onPaste={handlePaste}
            onFindInFiles={handleFindInFiles}
            onReplaceInFiles={handleReplaceInFiles}
            onSelectAll={handleSelectAll}
            onExpandSelection={handleExpandSelection}
            onCopyAsMarkdown={handleCopyAsMarkdown}
            onReleaseNotes={handleReleaseNotes}
            onDocumentation={handleDocumentation}
            onCheckForUpdates={handleCheckForUpdates}
            onImportDocument={() => handleImportDocument()}
            onExportDocument={() => handleExportDocument()}
          />
        )}

        {/* Update notification banner */}
        {updateAvailable && (
          <div className="bg-blue-600 dark:bg-blue-700 text-white px-4 py-2 flex items-center justify-between shadow-md">
            <div className="flex items-center gap-3">
              <Bell className="w-5 h-5 animate-pulse" />
              <span className="text-sm font-medium">
                A new update is available! Click "Check for Updates" to install it.
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setUpdateAvailable(false)}
              className="text-white hover:bg-blue-700 dark:hover:bg-blue-800"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        )}

        <TopBar
          activeProject={activeProject}
          onProjectSettings={handleProjectSettings}
          theme={resolvedTheme}
          onToggleTheme={toggleTheme}
        />

        <div className="flex flex-1 overflow-hidden">
          <Sidebar
            projects={projects}
            skills={skills}
            activeProject={activeProject}
            activeTab={activeTab}
            onProjectSelect={handleProjectSelect}
            onTabChange={setActiveTab}
            onDocumentOpen={handleDocumentOpen}
            onNewProject={handleNewProject}
            onNewSkill={handleNewSkill}
            onSkillSelect={handleSkillSelect}
            onImportSkill={() => setShowImportSkillDialog(true)}
            workflows={workflows}
            activeWorkflowId={activeWorkflow?.id}
            onWorkflowSelect={handleWorkflowSelect}
            onNewWorkflow={handleNewWorkflow}
            onRunWorkflow={handleRunWorkflow}
            onDeleteWorkflow={handleDeleteWorkflow}
            onEditWorkflow={handleEditWorkflowDetails}
            onQuickScheduleWorkflow={handleQuickScheduleWorkflow}

            onDeleteProject={handleDeleteProject}
            onRenameProject={handleRenameProject}
            onAddFileToProject={handleAddFileToProject}
            onDeleteFile={handleDeleteFile}
            onRenameFile={handleRenameFile}
            onImportDocument={handleImportDocument}
            onExportDocument={handleExportDocument}
            onCreatePresentationFromFile={handleCreatePresentationFromFile}
            artifacts={artifacts}
            activeArtifactId={activeArtifactId}
            recentlyChangedFiles={recentlyChangedFiles}
            onArtifactSelect={(artifact) => {
              setActiveArtifactId(artifact.id);
              // Map artifact type to folder
              const getArtifactDirectory = (type: ArtifactType): string => {
                switch (type) {
                  case 'insight': return 'insights';
                  case 'evidence': return 'evidence';
                  case 'decision': return 'decisions';
                  case 'requirement': return 'requirements';
                  case 'metric_definition': return 'metrics';
                  case 'experiment': return 'experiments';
                  case 'poc_brief': return 'poc-briefs';
                  case 'initiative': return 'initiatives';
                  default: return 'artifacts';
                }
              };
              const fileName = `${getArtifactDirectory(artifact.artifactType)}/${artifact.id}.md`;
              const doc: Document = {
                id: fileName,
                name: fileName,
                type: 'document',
                content: artifact.content,
              };
              handleDocumentOpen(doc);
            }}
            onCreateArtifact={async (artifactType: ArtifactType) => {
              if (!activeProject) {
                toast({ title: 'No Project Selected', description: 'Please select a project first.', variant: 'destructive' });
                return;
              }
              setSelectedArtifactTypeToCreate(artifactType);
              setShowCreateArtifactDialog(true);
            }}
            onDeleteArtifact={async (artifact: Artifact) => {
              try {
                await tauriApi.deleteArtifact(artifact.projectId, artifact.artifactType, artifact.id);
                setArtifacts(prev => prev.filter(a => a.id !== artifact.id));
                if (activeArtifactId === artifact.id) setActiveArtifactId(undefined);
                toast({ title: 'Deleted', description: `Artifact "${artifact.title}" deleted` });
              } catch (error) {
                toast({ title: 'Error', description: String(error), variant: 'destructive' });
              }
            }}
            onOpenSettings={handleGlobalSettings}
            onOpenModelsCost={() => {
              setActiveTab('models');
              setTimeout(() => {
                setActiveDocument(globalSettingsDocument);
              }, 50);
            }}
          />

          {/* Workflow Progress Overlay */}
          <WorkflowProgressOverlay
            isRunning={isWorkflowRunning}
            progress={workflowProgress}
          />

          <MainPanel
            activeProject={activeProject}
            openDocuments={openDocuments}
            activeDocument={activeDocument}
            showChat={showChat}
            onDocumentSelect={setActiveDocument}
            onDocumentClose={handleDocumentClose}
            onCloseOthers={handleCloseOthers}
            onCloseRight={handleCloseRight}
            onCloseAll={handleCloseAll}
            onToggleChat={() => setShowChat(!showChat)}
            onTabChange={setActiveTab}
            onCreateProject={handleNewProject}
            activeWorkflow={activeWorkflow}
            workflows={workflows}
            projects={projects}
            skills={skills}
            onWorkflowSave={handleSaveWorkflow}
            onWorkflowRun={handleRunWorkflow}
            onNewSkill={handleNewSkill}
            onEditWorkflowDetails={handleEditWorkflowDetails}
            openScheduleNonce={openScheduleNonce}
            onSkillSave={handleSkillSave}
            onProjectCreated={handleProjectCreated}
            onProjectUpdated={handleProjectUpdated}
            theme={resolvedTheme}
            onInstallPandoc={handleInstallPandoc}
          />
        </div>

        {/* Dialogs */}
        <FileFormDialog
          open={showFileDialog}
          onOpenChange={setShowFileDialog}
          onSubmit={handleFileFormSubmit}
          projectName={activeProject?.name}
        />

        <ImportSkillDialog
          open={showImportSkillDialog}
          onOpenChange={setShowImportSkillDialog}
          onImport={handleImportSkill}
        />
        <FindReplaceDialog
          open={showFindDialog}
          onClose={() => setShowFindDialog(false)}
          mode={findMode}
          onFind={handleFindText}
          onReplace={handleReplaceText}
          onNext={handleFindNext}
          onPrevious={handleFindPrevious}
        />
        <FindReplaceDialog
          open={showFindInFilesDialog}
          onClose={() => setShowFindInFilesDialog(false)}
          mode="find"
          onFind={handleFindInFilesSearch}
          onReplace={() => { }}
        />
        <FindReplaceDialog
          open={showReplaceInFilesDialog}
          onClose={() => setShowReplaceInFilesDialog(false)}
          mode="replace"
          onFind={() => { }}
          onReplace={handleReplaceInFilesSearch}
        />

        <CreateArtifactDialog
          open={showCreateArtifactDialog}
          onOpenChange={setShowCreateArtifactDialog}
          artifactType={selectedArtifactTypeToCreate}
          onSubmit={async (title) => {
            if (!activeProject) return;
            try {
              const artifact = await tauriApi.createArtifact(activeProject.id, selectedArtifactTypeToCreate, title);
              setArtifacts(prev => [...prev, artifact]);
              setActiveArtifactId(artifact.id);

              const getArtifactDirectory = (type: ArtifactType): string => {
                switch (type) {
                  case 'insight': return 'insights';
                  case 'evidence': return 'evidence';
                  case 'decision': return 'decisions';
                  case 'requirement': return 'requirements';
                  case 'metric_definition': return 'metrics';
                  case 'experiment': return 'experiments';
                  case 'poc_brief': return 'poc-briefs';
                  case 'initiative': return 'initiatives';
                  default: return 'artifacts';
                }
              };
              const fileName = `${getArtifactDirectory(artifact.artifactType)}/${artifact.id}.md`;
              const doc: Document = {
                id: fileName,
                name: fileName,
                type: 'document',
                content: artifact.content,
              };
              handleDocumentOpen(doc);
              toast({ title: 'Artifact Created', description: `Created "${title}"` });
            } catch (e: any) {
              console.error(e);
              toast({ title: 'Failed to create artifact', description: e.toString(), variant: 'destructive' });
            }
          }}
        />

        <WorkflowBuilderDialog
          open={showWorkflowBuilder}
          mode={workflowBuilderMode}
          projects={projects.map(p => ({ id: p.id, name: p.name }))}
          initialProjectId={activeProject?.id}
          initialWorkflow={builderWorkflow}
          onOpenChange={setShowWorkflowBuilder}
          onSubmit={handleWorkflowBuilderSubmit}
        />

        <WorkflowResultDialog
          open={showWorkflowResult}
          onOpenChange={setShowWorkflowResult}
          execution={workflowResult}
          workflowName={lastRunWorkflowName}
          onOpenFile={(fileName) => {
            if (activeProject) {
              const doc = { id: fileName, name: fileName, type: 'document', content: '' };
              handleDocumentOpen(doc);
              setShowWorkflowResult(false);
            }
          }}
        />
      </div>
    </div>
  );
}


