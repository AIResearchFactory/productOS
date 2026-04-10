import { useEffect } from 'react';
import { tauriApi } from '../api/tauri';

interface WorkspaceInitProps {
    setSkills: (skills: any[]) => void;
    setGlobalSettings: (settings: any) => void;
    setTheme: (theme: string) => void;
    setProjects: (projects: any[]) => void;
    setActiveProject: (project: any) => void;
    enforceUpdatePolicy: () => Promise<void>;
    checkAppForUpdates: (show: boolean) => Promise<void>;
    refreshFallback: () => Promise<void>;
}

export function useWorkspaceInit({
    setSkills, setGlobalSettings, setTheme, setProjects, setActiveProject,
    enforceUpdatePolicy, checkAppForUpdates, refreshFallback
}: WorkspaceInitProps) {
    useEffect(() => {
        // 1. Policy and Updates
        enforceUpdatePolicy();
        checkAppForUpdates(false);

        // 2. Initial Data Load
        const init = async () => {
            try {
                const [skills, settings, projectsList] = await Promise.all([
                    tauriApi.getAllSkills(),
                    tauriApi.getGlobalSettings(),
                    tauriApi.getAllProjects()
                ]);

                setSkills(skills);
                setGlobalSettings(settings);
                if (settings.theme) setTheme(settings.theme);

                const workspaceProjects = projectsList.map(p => ({
                    ...p,
                    description: p.goal || '',
                    created: p.created_at.split('T')[0],
                    documents: []
                }));
                setProjects(workspaceProjects);

                // Auto-select last project
                if (settings.lastProjectId) {
                    const lastProject = workspaceProjects.find(p => p.id === settings.lastProjectId);
                    if (lastProject) {
                        setActiveProject(lastProject);
                    }
                }
            } catch (error) {
                console.error('Workspace init failed:', error);
            }
        };
        init();

        // 3. Fallback Periodic Refresh (5 mins)
        const interval = setInterval(refreshFallback, 300000);
        
        // 4. Update Polling (24 hours)
        const updateInterval = setInterval(() => checkAppForUpdates(false), 86400000);

        return () => {
            clearInterval(interval);
            clearInterval(updateInterval);
        };
    }, []);
}
