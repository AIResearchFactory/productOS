import type { 
    ClaudeCodeInfo, OllamaInfo, GeminiInfo, OpenAiCliInfo, 
    Project, GlobalSettings, 
    CustomCliConfig, ProviderType,
    ChatMessage,
    ChatResponse,
    GoogleAuthStatus,
    OpenAiAuthStatus
} from './tauri';

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
    detectClaude: () => serverFetch<ClaudeCodeInfo | null>('/api/system/detect/claude'),
    detectOllama: () => serverFetch<OllamaInfo | null>('/api/system/detect/ollama'),
    detectGemini: () => serverFetch<GeminiInfo | null>('/api/system/detect/gemini'),
    detectOpenAi: () => serverFetch<OpenAiCliInfo | null>('/api/system/detect/openai'),
    clearAllCaches: () => serverFetch<void>('/api/system/detect/clear-cache', { method: 'POST' }),
    shutdown: () => serverFetch<void>('/api/system/shutdown', { method: 'POST' }),
    getAppDataDirectory: () => serverFetch<string>('/api/system/data-directory')
};

export const chatApi = {
    sendMessage: (messages: ChatMessage[], projectId?: string, skillId?: string) => serverFetch<ChatResponse>('/api/chat/send', {
        method: 'POST',
        body: JSON.stringify({ messages, projectId, skillId })
    }),
    getCompletion: (messages: ChatMessage[], projectId?: string) => serverFetch<ChatResponse>('/api/chat/completion', {
        method: 'POST',
        body: JSON.stringify({ messages, projectId })
    })
};

export const authApi = {
    authenticateGemini: () => serverFetch<string>('/api/auth/gemini/login', { method: 'POST' }),
    getGoogleAuthStatus: () => serverFetch<GoogleAuthStatus>('/api/auth/gemini/status'),
    logoutGoogle: () => serverFetch<string>('/api/auth/gemini/logout', { method: 'POST' }),
    authenticateOpenAI: () => serverFetch<string>('/api/auth/openai/login', { method: 'POST' }),
    getOpenAIAuthStatus: () => serverFetch<OpenAiAuthStatus>('/api/auth/openai/status'),
    logoutOpenAI: () => serverFetch<string>('/api/auth/openai/logout', { method: 'POST' })
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
    getAllProjects: () => serverFetch<Project[]>('/api/projects/')
};

export const settingsApi = {
    getGlobalSettings: () => serverFetch<GlobalSettings>('/api/settings/global'),
    saveGlobalSettings: (settings: GlobalSettings) => serverFetch<void>('/api/settings/global', {
        method: 'POST',
        body: JSON.stringify(settings)
    }),
    getUsageStatistics: () => serverFetch<any>('/api/settings/usage'),
    addCustomCli: (config: CustomCliConfig) => serverFetch<void>('/api/settings/custom_cli', {
        method: 'POST',
        body: JSON.stringify(config)
    }),
    removeCustomCli: (name: string) => serverFetch<void>(`/api/settings/custom_cli?name=${name}`, {
        method: 'DELETE'
    }),
    listAvailableProviders: () => serverFetch<ProviderType[]>('/api/settings/providers')
};
