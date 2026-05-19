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
    onUpdateAvailable
}: UseFileWatcherEventsProps) {
    const { toast } = useToast();
    
    // Use refs for listener stability
    const activeProjectRef = useRef(activeProject);
    const activeDocumentRef = useRef(activeDocument);

    useEffect(() => {
        activeProjectRef.current = activeProject;
        activeDocumentRef.current = activeDocument;
    }, [activeProject, activeDocument]);

    useEffect(() => {
        if (!activeProject) return;

        const interval = setInterval(() => {
            if (appApi.isServerOnline()) {
                appApi.getProjectWorkflows(activeProject.id).then(setWorkflows).catch(() => {});
                appApi.listArtifacts(activeProject.id).then(setArtifacts).catch(() => {});
            }
        }, 5000); // Poll every 5 seconds for robustness

        return () => clearInterval(interval);
    }, [activeProject, setWorkflows, setArtifacts]);

    useEffect(() => {
        let unlistenAdded: (() => void) | undefined;
        let unlistenModified: (() => void) | undefined;
        let unlistenFileChanged: (() => void) | undefined;
        let unlistenWorkflowChanged: (() => void) | undefined;
        let unlistenArtifactsChanged: (() => void) | undefined;
        let unlistenUpdate: (() => void) | undefined;
        let unlistenImport: (() => void) | undefined;
        let unlistenExport: (() => void) | undefined;
        let unlistenClose: (() => void) | undefined;

        const setupListeners = async () => {
            try {
                // Project Lifecycle
                unlistenAdded = await appApi.onProjectAdded((project) => {
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
                    toast({ title: 'New Project', description: `Project "${project.name}" was created` });
                });

                unlistenModified = await appApi.onProjectModified((projectId) => {
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
                    });
                });

                // File/Project Changes
                unlistenFileChanged = await appApi.listen('file-changed', (event: any) => {
                    const { projectId, fileName } = event.payload as { projectId: string; fileName: string };
                    if (activeProjectRef.current?.id === projectId) {
                        appApi.getProjectFiles(projectId).then(files => {
                            setProjects(prev => prev.map(p => {
                                if (p.id === projectId) {
                                    highlightNewFiles(projectId, files, p.documents?.map((d: any) => d.id) || []);
                                    return { ...p, documents: files.map(f => ({ id: f, name: f, type: 'document', content: '' })) };
                                }
                                return p;
                            }));
                            setActiveProject((prev: any) => {
                                if (prev?.id === projectId) {
                                    return { ...prev, documents: files.map(f => ({ id: f, name: f, type: 'document', content: '' })) };
                                }
                                return prev;
                            });
                        });
                        
                        // If active document changed externally, reload it
                        if (activeDocumentRef.current?.id === fileName && activeDocumentRef.current?.type === 'document') {
                            appApi.readMarkdownFile(projectId, fileName).then(content => {
                                if (content !== activeDocumentRef.current?.content) {
                                    setActiveDocument((prev: any) => prev && prev.id === fileName ? { ...prev, content } : prev);
                                }
                            });
                        }
                    }
                });

                // Workflow changes
                unlistenWorkflowChanged = await appApi.listen('workflow-changed', (event: any) => {
                    const projectId = event?.payload?.projectId ?? event?.payload;
                    if (activeProjectRef.current?.id === projectId) {
                        appApi.getProjectWorkflows(projectId).then(setWorkflows);
                        appApi.listArtifacts(projectId).then(setArtifacts);
                    }
                });

                unlistenArtifactsChanged = await appApi.listen('artifacts-changed', (event: any) => {
                    const projectId = event?.payload?.projectId ?? event?.payload;
                    if (activeProjectRef.current?.id === projectId) {
                        appApi.listArtifacts(projectId).then(setArtifacts);
                    }
                });

                // System events
                unlistenUpdate = await appApi.listen('update-available', (event: any) => {
                    onUpdateAvailable(event.payload.version);
                });

                unlistenImport = await appApi.listen('menu:import-document', handleImportDocument);
                unlistenExport = await appApi.listen('menu:export-document', handleExportDocument);
                unlistenClose = await appApi.listen('app:close-requested', async () => {
                    if (activeProjectRef.current) {
                        const s = await appApi.getGlobalSettings();
                        s.lastProjectId = activeProjectRef.current.id;
                        await appApi.saveGlobalSettings(s);
                    }
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
            if (unlistenArtifactsChanged) unlistenArtifactsChanged();
            if (unlistenUpdate) unlistenUpdate();
            if (unlistenImport) unlistenImport();
            if (unlistenExport) unlistenExport();
            if (unlistenClose) unlistenClose();
        };
    }, [handleImportDocument, handleExportDocument, onUpdateAvailable, setProjects, setActiveProject, setActiveDocument, setWorkflows, setArtifacts, highlightNewFiles, toast]);
}
