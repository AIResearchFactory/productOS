import { useEffect, useRef } from 'react';
import { appApi } from '../api/app';
import { checkServerHealth } from '../api/server';

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
    const retryTimerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        enforceUpdatePolicy();
        checkAppForUpdates(false);

        const init = async (retryCount = 0) => {
            if (didInitRef.current) return;

            let online = appApi.isServerOnline();
            if (online === null) {
                online = await checkServerHealth();
            }
            if (!online) {
                console.log(`[useWorkspaceInit] Server offline, retry ${retryCount + 1}/5 in 2s...`);
                if (retryCount < 5) {
                    retryTimerRef.current = setTimeout(() => init(retryCount + 1), 2000);
                }
                return;
            }

            try {
                // Use Promise.allSettled so a partial failure (e.g. skills or settings) doesn't prevent projects from loading
                const [skillsResult, settingsResult, projectsResult] = await Promise.allSettled([
                    appApi.getAllSkills(),
                    appApi.getGlobalSettings(),
                    appApi.getAllProjects()
                ]);

                const skills = skillsResult.status === 'fulfilled' ? skillsResult.value : [];
                const settings = settingsResult.status === 'fulfilled' ? settingsResult.value : ({} as any);
                const projectsList = projectsResult.status === 'fulfilled' ? projectsResult.value : [];

                if (skillsResult.status === 'fulfilled') {
                    setSkills(skills);
                }

                if (settingsResult.status === 'fulfilled') {
                    const normalizedSettings = { ...settings, theme: settings.theme || 'system' };
                    setGlobalSettings(normalizedSettings);
                    setTheme(normalizedSettings.theme);

                    document.documentElement.classList.remove('light', 'dark');
                    if (normalizedSettings.theme === 'system') {
                        const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                        document.documentElement.classList.add(systemTheme);
                    } else {
                        document.documentElement.classList.add(normalizedSettings.theme);
                    }
                }

                if (projectsResult.status === 'fulfilled') {
                    const workspaceProjects = projectsList.map((p: any) => ({
                        ...p,
                        description: p.goal || '',
                        created: p.created_at ? p.created_at.split('T')[0] : '',
                        documents: []
                    }));
                    setProjects(workspaceProjects);

                    const lastProject = settings?.lastProjectId
                        ? workspaceProjects.find((p: any) => p.id === settings.lastProjectId)
                        : null;

                    if (lastProject) {
                        setActiveProject(lastProject);
                    } else if (workspaceProjects.length > 0) {
                        setActiveProject(workspaceProjects[0]);
                    }

                    // Successfully loaded projects
                    didInitRef.current = true;
                    console.log(`[useWorkspaceInit] Successfully initialized ${workspaceProjects.length} projects`);
                } else {
                    console.warn('[useWorkspaceInit] Failed to load projects, retrying...', projectsResult.reason);
                    if (retryCount < 5) {
                        retryTimerRef.current = setTimeout(() => init(retryCount + 1), 2000);
                    }
                }
            } catch (error) {
                console.error('[useWorkspaceInit] Workspace init failed:', error);
                if (retryCount < 5) {
                    retryTimerRef.current = setTimeout(() => init(retryCount + 1), 2000);
                }
            }
        };

        init();

        const handleVisibilityChange = () => {
            if (!document.hidden && !didInitRef.current) {
                init();
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        const interval = setInterval(() => {
            if (document.hidden) return;
            if (appApi.isServerOnline()) {
                if (!didInitRef.current) {
                    init();
                } else {
                    refreshFallback().catch(() => {});
                }
            }
        }, 60000);

        const updateInterval = setInterval(() => {
            if (appApi.isServerOnline()) {
                checkAppForUpdates(false).catch(() => {});
            }
        }, 86400000);

        return () => {
            if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            clearInterval(interval);
            clearInterval(updateInterval);
        };
    }, []);
}
