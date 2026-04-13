export const SERVER_URL = 'http://localhost:51423';
export let serverOnline: boolean | null = null;

export const checkServerHealth = async (): Promise<boolean> => {
    try {
        const response = await fetch(`${SERVER_URL}/api/health`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(1000)
        });
        if (response.ok) {
            serverOnline = true;
            return true;
        }
    } catch (e) {
        // failed to fetch -> server offline
    }
    serverOnline = false;
    return false;
};

export const serverFetch = async <T>(path: string, options?: RequestInit): Promise<T> => {
    if (serverOnline === null) {
        await checkServerHealth();
    }
    if (!serverOnline) {
        throw new Error("Server offline");
    }
    try {
        const res = await fetch(`${SERVER_URL}${path}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...(options?.headers || {})
            }
        });

        if (!res.ok) {
            const errorData = await res.json().catch(() => null);
            throw new Error(errorData?.error || `Request failed with status ${res.status}`);
        }

        if (res.status === 204) {
            return null as unknown as T;
        }

        return res.json();
    } catch (e) {
        // If request fails, reset status so we re-probe next time
        serverOnline = null;
        throw e;
    }
};

export const systemApi = {
    detectClaude: () => serverFetch<any>('/api/system/detect/claude'),
    detectOllama: () => serverFetch<any>('/api/system/detect/ollama'),
    detectGemini: () => serverFetch<any>('/api/system/detect/gemini'),
    detectOpenAi: () => serverFetch<any>('/api/system/detect/openai'),
    clearAllCaches: () => serverFetch<void>('/api/system/detect/clear-cache', { method: 'POST' })
};

export const secretsApi = {
    hasSecret: (id: string) => serverFetch<{has_secret: boolean}>(`/api/secrets/has?id=${id}`),
    setSecret: (id: string, value: string) => serverFetch<void>('/api/secrets/set', {
        method: 'POST',
        body: JSON.stringify({ id, value }),
    }),
    listSecrets: () => serverFetch<string[]>('/api/secrets/list')
};

export const projectsApi = {
    getAllProjects: () => serverFetch<any[]>('/api/projects/')
};

export const settingsApi = {
    getGlobalSettings: () => serverFetch<any>('/api/settings/global'),
    saveGlobalSettings: (settings: any) => serverFetch<void>('/api/settings/global', {
        method: 'POST',
        body: JSON.stringify(settings)
    }),
    getUsageStatistics: () => serverFetch<any>('/api/settings/usage'),
    addCustomCli: (config: any) => serverFetch<void>('/api/settings/custom_cli', {
        method: 'POST',
        body: JSON.stringify(config)
    }),
    removeCustomCli: (name: string) => serverFetch<void>(`/api/settings/custom_cli?name=${name}`, {
        method: 'DELETE'
    }),
    listAvailableProviders: () => serverFetch<string[]>('/api/settings/providers')
};
