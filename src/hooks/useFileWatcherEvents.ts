import { useEffect, useRef } from 'react';
import { appApi } from '../api/app';
import { useToast } from './use-toast';

interface UseFileWatcherEventsProps {
    activeProject: any | null;
    activeDocument: any | null;
    setProjects: React.Dispatch<React.SetStateAction<any[]>>;
    setActiveProject: React.Dispatch<React.SetStateAction<any | null>>;
    setActiveDocument: React.Dispatch<React.SetStateAction<any | null>>;
    setWorkflows: React.Dispatch<React.SetStateAction<any[]>>;
    setArtifacts: React.Dispatch<React.SetStateAction<any[]>>;
    highlightNewFiles: (projectId: string, files: string[], oldFiles: string[]) => void;
    handleImportDocument: () => Promise<void>;
    handleExportDocument: () => Promise<void>;
    onUpdateAvailable: (version: string) => void;
    enabled?: boolean;
}

export function useFileWatcherEvents({
    activeProject,
    activeDocument,
    setProjects,
    setActiveProject,
    setActiveDocument,
    setWorkflows,
    setArtifacts,
    highlightNewFiles,
    handleImportDocument,
    handleExportDocument,
    onUpdateAvailable,
    enabled = true
}: UseFileWatcherEventsProps) {
    const { toast } = useToast();
    
    // Use refs for listener stability
    const activeProjectRef = useRef(activeProject);
    const activeDocumentRef = useRef(activeDocument);
    const handleImportDocumentRef = useRef(handleImportDocument);
    const handleExportDocumentRef = useRef(handleExportDocument);
    const onUpdateAvailableRef = useRef(onUpdateAvailable);
    const highlightNewFilesRef = useRef(highlightNewFiles);
    const toastRef = useRef(toast);

    const fileDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
    const artifactsDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
    const workflowsDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
    const projectGenerationRef = useRef(0);

    const clearProjectDebounceTimers = () => {
        if (fileDebounceTimerRef.current) {
            clearTimeout(fileDebounceTimerRef.current);
            fileDebounceTimerRef.current = null;
        }
        if (artifactsDebounceTimerRef.current) {
            clearTimeout(artifactsDebounceTimerRef.current);
            artifactsDebounceTimerRef.current = null;
        }
        if (workflowsDebounceTimerRef.current) {
            clearTimeout(workflowsDebounceTimerRef.current);
            workflowsDebounceTimerRef.current = null;
        }
    };

    useEffect(() => {
        activeProjectRef.current = activeProject;
        activeDocumentRef.current = activeDocument;
        handleImportDocumentRef.current = handleImportDocument;
        handleExportDocumentRef.current = handleExportDocument;
        onUpdateAvailableRef.current = onUpdateAvailable;
        highlightNewFilesRef.current = highlightNewFiles;
        toastRef.current = toast;
    });

    useEffect(() => {
        projectGenerationRef.current += 1;
        clearProjectDebounceTimers();
    }, [activeProject?.id]);

    useEffect(() => {
        if (!enabled) return;
        const projectId = activeProject?.id;
        if (!projectId || projectId === 'new-project') return;
        const generation = projectGenerationRef.current;

        // Poll less aggressively (every 120 seconds) for robustness since we already have real-time SSE listeners
        const interval = setInterval(() => {
            if (document.hidden) return; // Skip background fallback when tab is hidden/inactive
            if (activeProjectRef.current?.id !== projectId || projectGenerationRef.current !== generation) return;
            if (appApi.isServerOnline()) {
                appApi.getProjectWorkflows(projectId).then(workflows => {
                    if (activeProjectRef.current?.id === projectId && projectGenerationRef.current === generation) {
                        setWorkflows(workflows);
                    }
                }).catch(() => {});
                appApi.listArtifacts(projectId).then(artifacts => {
                    if (activeProjectRef.current?.id === projectId && projectGenerationRef.current === generation) {
                        setArtifacts(artifacts);
                    }
                }).catch(() => {});
            }
        }, 120000);

        return () => clearInterval(interval);
    }, [enabled, activeProject?.id, setWorkflows, setArtifacts]);

    useEffect(() => {
        appApi.setEventStreamEnabled?.(enabled);
        if (!enabled) {
            clearProjectDebounceTimers();
            return;
        }
        let cancelled = false;
        let unlistenAdded: (() => void) | undefined;
        let unlistenModified: (() => void) | undefined;
        let unlistenFileChanged: (() => void) | undefined;
        let unlistenWorkflowChanged: (() => void) | undefined;
        let unlistenArtifactsChanged: (() => void) | undefined;
        let unlistenUpdate: (() => void) | undefined;
        let unlistenImport: (() => void) | undefined;
        let unlistenExport: (() => void) | undefined;
        let unlistenClose: (() => void) | undefined;

        const registerUnlisten = (fn: (() => void) | undefined) => {
            if (!fn) return undefined;
            if (cancelled) {
                fn();
                return undefined;
            }
            return fn;
        };

        const setupListeners = async () => {
            try {
                // Project Lifecycle
                unlistenAdded = registerUnlisten(await appApi.onProjectAdded((project) => {
                    const workspaceProject = {
                        ...project,
                        description: project.goal || '',
                        created: project.created_at.split('T')[0],
                        documents: []
                    };
                    setProjects(prev => {
                        if (prev.some(p => p.id === workspaceProject.id)) return prev;
                        return [...prev, workspaceProject];
                    });
                    toastRef.current({ title: 'New Project', description: `Project "${project.name}" was created` });
                }));

                unlistenModified = registerUnlisten(await appApi.onProjectModified((projectId) => {
                    appApi.getProject(projectId).then(updated => {
                        if (!updated) return;
                        const workspaceProject = {
                            ...updated,
                            description: updated.goal || '',
                            created: updated.created_at.split('T')[0],
                            documents: []
                        };
                        setProjects(prev => prev.map(p => p.id === projectId ? workspaceProject : p));
                        if (activeProjectRef.current?.id === projectId) {
                            setActiveProject(workspaceProject);
                        }
                    }).catch(console.error);
                }));

                // File/Project Changes - debounced & diffed to avoid infinite loops and active editor clobbering
                unlistenFileChanged = registerUnlisten(await appApi.listen('file-changed', (event: any) => {
                    const { projectId } = event.payload as { projectId: string; fileName: string; baseName?: string };
                    if (activeProjectRef.current?.id !== projectId) return;
                    const generation = projectGenerationRef.current;

                    if (fileDebounceTimerRef.current) {
                        clearTimeout(fileDebounceTimerRef.current);
                    }
                    fileDebounceTimerRef.current = setTimeout(() => {
                        if (activeProjectRef.current?.id !== projectId || projectGenerationRef.current !== generation) return;
                        appApi.getProjectFiles(projectId, 'mtime').then(files => {
                            if (activeProjectRef.current?.id !== projectId || projectGenerationRef.current !== generation) return;
                            const currentDocs = activeProjectRef.current?.documents || [];
                            const currentDocIds = currentDocs.map((d: any) => d.id);

                            // Only update project document tree if file list actually changed
                            const isSame = files.length === currentDocIds.length && files.every((f, i) => f === currentDocIds[i]);
                            if (!isSame) {
                                highlightNewFilesRef.current(projectId, files, currentDocIds);
                                const newDocs = files.map(f => ({ id: f, name: f, type: 'document', content: '' }));
                                setProjects(prev => prev.map(p => p.id === projectId ? { ...p, documents: newDocs } : p));
                                setActiveProject((prev: any) => prev?.id === projectId ? { ...prev, documents: newDocs } : prev);
                            }
                        }).catch(console.error);
                    }, 300);
                }));

                // Workflow changes - debounced
                unlistenWorkflowChanged = registerUnlisten(await appApi.listen('workflow-changed', (event: any) => {
                    const projectId = event?.payload?.projectId ?? event?.payload;
                    if (activeProjectRef.current?.id === projectId) {
                        const generation = projectGenerationRef.current;
                        if (workflowsDebounceTimerRef.current) clearTimeout(workflowsDebounceTimerRef.current);
                        workflowsDebounceTimerRef.current = setTimeout(() => {
                            if (activeProjectRef.current?.id !== projectId || projectGenerationRef.current !== generation) return;
                            appApi.getProjectWorkflows(projectId).then(workflows => {
                                if (activeProjectRef.current?.id === projectId && projectGenerationRef.current === generation) {
                                    setWorkflows(workflows);
                                }
                            }).catch(console.error);
                            appApi.listArtifacts(projectId).then(artifacts => {
                                if (activeProjectRef.current?.id === projectId && projectGenerationRef.current === generation) {
                                    setArtifacts(artifacts);
                                }
                            }).catch(console.error);
                        }, 300);
                    }
                }));

                // Artifacts changed - debounced
                unlistenArtifactsChanged = registerUnlisten(await appApi.listen('artifacts-changed', (event: any) => {
                    const projectId = event?.payload?.projectId ?? event?.payload;
                    if (activeProjectRef.current?.id === projectId) {
                        const generation = projectGenerationRef.current;
                        if (artifactsDebounceTimerRef.current) clearTimeout(artifactsDebounceTimerRef.current);
                        artifactsDebounceTimerRef.current = setTimeout(() => {
                            if (activeProjectRef.current?.id !== projectId || projectGenerationRef.current !== generation) return;
                            appApi.listArtifacts(projectId).then(artifacts => {
                                if (activeProjectRef.current?.id === projectId && projectGenerationRef.current === generation) {
                                    setArtifacts(artifacts);
                                }
                            }).catch(console.error);
                        }, 300);
                    }
                }));

                // System events
                unlistenUpdate = registerUnlisten(await appApi.listen('update-available', (event: any) => {
                    onUpdateAvailableRef.current(event.payload.version);
                }));

                unlistenImport = registerUnlisten(await appApi.listen('menu:import-document', () => handleImportDocumentRef.current()));
                unlistenExport = registerUnlisten(await appApi.listen('menu:export-document', () => handleExportDocumentRef.current()));
                unlistenClose = registerUnlisten(await appApi.listen('app:close-requested', async () => {
                    if (activeProjectRef.current) {
                        const s = await appApi.getGlobalSettings();
                        s.lastProjectId = activeProjectRef.current.id;
                        await appApi.saveGlobalSettings(s);
                    }
                }));

            } catch (error) {
                console.error('Failed to setup listeners:', error);
            }
        };

        setupListeners();

        return () => {
            cancelled = true;
            clearProjectDebounceTimers();

            if (unlistenAdded) unlistenAdded();
            if (unlistenModified) unlistenModified();
            if (unlistenFileChanged) unlistenFileChanged();
            if (unlistenWorkflowChanged) unlistenWorkflowChanged();
            if (unlistenArtifactsChanged) unlistenArtifactsChanged();
            if (unlistenUpdate) unlistenUpdate();
            if (unlistenImport) unlistenImport();
            if (unlistenExport) unlistenExport();
            if (unlistenClose) unlistenClose();
        };
    }, [enabled, setProjects, setActiveProject, setActiveDocument, setWorkflows, setArtifacts]);
}
