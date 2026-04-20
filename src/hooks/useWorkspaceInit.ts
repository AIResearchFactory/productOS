import { useEffect, useRef } from 'react';
import { appApi } from '../api/app';

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
    const didInitRef = useRef(false);

    useEffect(() => {
        if (didInitRef.current) {
            return;
        }
        didInitRef.current = true;

        enforceUpdatePolicy();
        checkAppForUpdates(false);

        const init = async () => {
            try {
                const [skills, settings, projectsList] = await Promise.all([
                    appApi.getAllSkills(),
                    appApi.getGlobalSettings(),
                    appApi.getAllProjects()
                ]);

                setSkills(skills);
                setGlobalSettings(settings);
                if (settings.theme) setTheme(settings.theme);

                const workspaceProjects = projectsList.map((p: any) => ({
                    ...p,
                    description: p.goal || '',
                    created: p.created_at.split('T')[0],
                    documents: []
                }));
                setProjects(workspaceProjects);

                if (settings.theme) {
                    document.documentElement.classList.toggle('dark', settings.theme === 'dark');
                }

                const lastProject = settings.lastProjectId
                    ? workspaceProjects.find((p: any) => p.id === settings.lastProjectId)
                    : null;

                if (lastProject) {
                    setActiveProject(lastProject);
                } else if (workspaceProjects.length > 0) {
                    setActiveProject(workspaceProjects[0]);
                }
            } catch (error) {
                console.error('Workspace init failed:', error);
            }
        };

        init();

        const interval = setInterval(refreshFallback, 300000);
        const updateInterval = setInterval(() => checkAppForUpdates(false), 86400000);

        return () => {
            clearInterval(interval);
            clearInterval(updateInterval);
        };
    }, []);
}
