import type { 
    ClaudeCodeInfo, OllamaInfo, GeminiInfo, OpenAiCliInfo, 
    Project, GlobalSettings, 
    CustomCliConfig, ProviderType,
    ChatMessage,
    ChatResponse,
    GoogleAuthStatus,
    OpenAiAuthStatus,
    SearchMatch,
    Artifact,
    ArtifactType,
    Workflow,
    WorkflowSchedule,
    WorkflowRunRecord,
    Skill
} from './contracts';

export const SERVER_URL = 'http://127.0.0.1:51423';
export let serverOnline: boolean | null = null;

export const checkServerHealth = async (): Promise<boolean> => {
    try {
        const response = await fetch(`${SERVER_URL}/api/health`, {
            method: 'GET',
            signal: AbortSignal.timeout(10000)
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

type ServerFetchOptions = RequestInit & {
    allowNotFound?: boolean;
};

export const serverFetch = async <T>(path: string, options?: ServerFetchOptions): Promise<T> => {
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
            if (res.status === 404 && options?.allowNotFound) {
                return false as unknown as T;
            }
            const errorData = await res.json().catch(() => null);
            const errorMsg = errorData?.error || `Request to ${path} failed with status ${res.status}`;
            console.error(`[API ERROR] ${path}:`, errorMsg);
            throw new Error(errorMsg);
        }

        const text = await res.text();
        if (!text) return null as unknown as T;
        try {
            return JSON.parse(text);
        } catch (e) {
            console.error(`[API ERROR] Failed to parse JSON from ${path}:`, text);
            throw e;
        }
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
    shutdown: () => serverFetch<void>('/api/system/shutdown?source=ui', { method: 'POST' }),
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
    }),
    getOllamaModels: () => serverFetch<string[]>('/api/chat/ollama/models')
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
    getAllProjects: () => serverFetch<Project[]>('/api/projects')
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

export const filesApi = {
    getProjectFiles: (projectId: string) => serverFetch<string[]>(`/api/projects/files?project_id=${projectId}`),
    checkFileExists: (projectId: string, fileName: string) => serverFetch<boolean>(`/api/files/exists?project_id=${projectId}&file_name=${encodeURIComponent(fileName)}`, { allowNotFound: true }),
    readFile: (projectId: string, fileName: string) => serverFetch<string>(`/api/files/read?project_id=${projectId}&file_name=${encodeURIComponent(fileName)}`),
    writeFile: (projectId: string, fileName: string, content: string) => serverFetch<void>('/api/files/write', {
        method: 'PUT',
        body: JSON.stringify({ project_id: projectId, file_name: fileName, content })
    }),
    renameFile: (projectId: string, oldName: string, newName: string) => serverFetch<void>('/api/files/rename', {
        method: 'POST',
        body: JSON.stringify({ project_id: projectId, old_name: oldName, new_name: newName })
    }),
    deleteFile: (projectId: string, fileName: string) => serverFetch<void>(`/api/files/delete?project_id=${projectId}&file_name=${encodeURIComponent(fileName)}`, {
        method: 'DELETE'
    }),
    searchInFiles: (projectId: string, searchText: string, caseSensitive: boolean, useRegex: boolean) => serverFetch<SearchMatch[]>('/api/files/search', {
        method: 'POST',
        body: JSON.stringify({ project_id: projectId, search_text: searchText, case_sensitive: caseSensitive, use_regex: useRegex })
    }),
    replaceInFiles: (projectId: string, searchText: string, replaceText: string, caseSensitive: boolean) => serverFetch<number>('/api/files/replace', {
        method: 'POST',
        body: JSON.stringify({ project_id: projectId, search_text: searchText, replace_text: replaceText, case_sensitive: caseSensitive })
    }),
    importDocument: (projectId: string, sourcePath: string) => serverFetch<string>('/api/files/import', {
        method: 'POST',
        body: JSON.stringify({ project_id: projectId, source_path: sourcePath })
    })
};

export const artifactsApi = {
    listArtifacts: (projectId: string, type?: ArtifactType) => serverFetch<Artifact[]>(`/api/artifacts/list?project_id=${projectId}${type ? `&artifact_type=${type}` : ''}`),
    createArtifact: (projectId: string, type: ArtifactType, title: string) => serverFetch<Artifact>('/api/artifacts/create', {
        method: 'POST',
        body: JSON.stringify({ project_id: projectId, artifact_type: type, title })
    }),
    getArtifact: (projectId: string, type: ArtifactType, artifactId: string) => serverFetch<Artifact>(`/api/artifacts/get?project_id=${projectId}&artifact_type=${type}&artifact_id=${artifactId}`),
    saveArtifact: (artifact: Artifact) => serverFetch<void>('/api/artifacts/save', {
        method: 'PUT',
        body: JSON.stringify(artifact)
    }),
    deleteArtifact: (projectId: string, type: ArtifactType, artifactId: string) => serverFetch<void>(`/api/artifacts/delete?project_id=${projectId}&artifact_type=${type}&artifact_id=${artifactId}`, {
        method: 'DELETE'
    }),
    importArtifact: (projectId: string, type: ArtifactType, sourcePath: string) => serverFetch<Artifact>('/api/artifacts/import', {
        method: 'POST',
        body: JSON.stringify({ project_id: projectId, artifact_type: type, source_path: sourcePath })
    }),
    exportArtifact: (projectId: string, artifactId: string, type: ArtifactType, targetPath: string) => serverFetch<void>('/api/artifacts/export', {
        method: 'POST',
        body: JSON.stringify({ project_id: projectId, artifact_id: artifactId, artifact_type: type, target_path: targetPath })
    }),
};

export const workflowsApi = {
    getProjectWorkflows: (projectId: string) => serverFetch<Workflow[]>(`/api/workflows?project_id=${projectId}`),
    getWorkflow: (projectId: string, workflowId: string) => serverFetch<Workflow>(`/api/workflows/get?project_id=${projectId}&workflow_id=${workflowId}`),
    createWorkflow: (projectId: string, name: string, description: string) => serverFetch<Workflow>('/api/workflows/create', {
        method: 'POST',
        body: JSON.stringify({ project_id: projectId, name, description })
    }),
    saveWorkflow: (workflow: Workflow) => serverFetch<void>('/api/workflows/save', {
        method: 'PUT',
        body: JSON.stringify(workflow)
    }),
    deleteWorkflow: (projectId: string, workflowId: string) => serverFetch<void>(`/api/workflows/delete?project_id=${projectId}&workflow_id=${workflowId}`, {
        method: 'DELETE'
    }),
    setWorkflowSchedule: (projectId: string, workflowId: string, schedule: WorkflowSchedule) => serverFetch<Workflow>('/api/workflows/schedule/set', {
        method: 'POST',
        body: JSON.stringify({ project_id: projectId, workflow_id: workflowId, schedule })
    }),
    clearWorkflowSchedule: (projectId: string, workflowId: string) => serverFetch<Workflow>('/api/workflows/schedule/clear', {
        method: 'POST',
        body: JSON.stringify({ project_id: projectId, workflow_id: workflowId })
    }),
    getWorkflowHistory: (projectId: string, workflowId: string) => serverFetch<WorkflowRunRecord[]>(`/api/workflows/history?project_id=${projectId}&workflow_id=${workflowId}`),
    executeWorkflow: (projectId: string, workflowId: string, parameters?: Record<string, string>) => serverFetch<string>('/api/workflows/execute', {
        method: 'POST',
        body: JSON.stringify({ project_id: projectId, workflow_id: workflowId, parameters })
    }),
    stopWorkflow: (executionId: string) => serverFetch<void>('/api/workflows/stop', {
        method: 'POST',
        body: JSON.stringify({ execution_id: executionId })
    }),
    getActiveRuns: () => serverFetch<WorkflowRunRecord[]>('/api/workflows/active')
};

export const skillsApi = {
    getAllSkills: () => serverFetch<Skill[]>('/api/skills'),
    getSkill: (skillId: string) => serverFetch<Skill>(`/api/skills/get?skill_id=${skillId}`),
    createSkill: (name: string, description: string, prompt_template: string, capabilities: string[]) => serverFetch<Skill>('/api/skills/create', {
        method: 'POST',
        body: JSON.stringify({ name, description, prompt_template, capabilities })
    }),
    updateSkill: (skill: Skill) => serverFetch<void>('/api/skills/update', {
        method: 'PUT',
        body: JSON.stringify(skill)
    }),
    deleteSkill: (skillId: string) => serverFetch<void>(`/api/skills/delete?skill_id=${skillId}`, {
        method: 'DELETE'
    }),
    importSkill: (skillCommand: string) => serverFetch<Skill>('/api/skills/import', {
        method: 'POST',
        body: JSON.stringify({ skill_command: skillCommand })
    }),
    getSkillsByCategory: (category: string) => serverFetch<Skill[]>(`/api/skills/get?category=${category}`)
};

export const mcpApi = {
    getMcpServers: () => serverFetch<any[]>('/api/mcp/servers'),
    addMcpServer: (config: any) => serverFetch<any>('/api/mcp/servers/add', {
        method: 'POST',
        body: JSON.stringify(config)
    }),
    removeMcpServer: (id: string) => serverFetch<void>(`/api/mcp/servers/remove?id=${id}`, {
        method: 'DELETE'
    }),
    toggleMcpServer: (id: string, enabled: boolean) => serverFetch<void>('/api/mcp/servers/toggle', {
        method: 'POST',
        body: JSON.stringify({ id, enabled })
    }),
    updateMcpServer: (config: any) => serverFetch<void>('/api/mcp/servers/update', {
        method: 'PUT',
        body: JSON.stringify(config)
    }),
    getMarketplaceServers: (query?: string) => serverFetch<any[]>(`/api/mcp/marketplace${query ? `?query=${query}` : ''}`)
};

export const researchLogApi = {
    getResearchLog: (projectId: string) => serverFetch<any[]>(`/api/research-log?project_id=${projectId}`),
    clearResearchLog: (projectId: string) => serverFetch<void>('/api/research-log/clear', {
        method: 'POST',
        body: JSON.stringify({ project_id: projectId })
    })
};

export const projectsApiExtended = {
    getProject: (projectId: string) => serverFetch<Project>(`/api/projects/get?project_id=${projectId}`),
    createProject: (name: string, goal: string, skills: string[]) => serverFetch<Project>('/api/projects/create', {
        method: 'POST',
        body: JSON.stringify({ name, goal, skills })
    }),
    deleteProject: (projectId: string) => serverFetch<void>(`/api/projects/delete?project_id=${projectId}`, {
        method: 'DELETE'
    }),
    renameProject: (projectId: string, newName: string) => serverFetch<void>('/api/projects/rename', {
        method: 'POST',
        body: JSON.stringify({ project_id: projectId, new_name: newName })
    }),
    getProjectCost: (projectId: string) => serverFetch<number>(`/api/projects/cost?project_id=${projectId}`)
};
