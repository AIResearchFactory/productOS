import type {
    ClaudeCodeInfo, OllamaInfo, GeminiInfo, OpenAiCliInfo,
    Project, GlobalSettings,
    CustomCliConfig, ProviderType,
    ChatMessage,
    ChatResponse,
    VoiceCapabilities,
    TranscribeResponse,
    GoogleAuthStatus,
    OpenAiAuthStatus,
    SearchMatch,
    Artifact,
    ArtifactType,
    Workflow,
    WorkflowSchedule,
    WorkflowRunRecord,
    WorkflowExecution,
    Skill,
    Comment,
    SilentLearnerStatus,
    SilentLearnerRedactionReview,
    SilentLearnerRedactionResolveResult
} from './contracts';
import type { CriticFinding, CriticAuditResult, SocraticProposal } from '@/types/socratic';
export type { CriticFinding, CriticAuditResult, SocraticProposal };
import { sanitizeTelemetryEvent } from '@/lib/telemetryCatalog';

export class HttpError extends Error {
    status: number;
    constructor(message: string, status: number) {
        super(message);
        this.name = 'HttpError';
        this.status = status;
    }
}




const env = typeof import.meta !== 'undefined' ? (import.meta as any).env : undefined;
let rawServerUrl = env?.VITE_SERVER_URL || env?.VITE_PRODUCTOS_SERVER_URL || 'http://localhost:51423';
// Normalize trailing slash
export const SERVER_URL = rawServerUrl.endsWith('/') ? rawServerUrl.slice(0, -1) : rawServerUrl;
export let serverOnline: boolean | null = null;
export interface ServerFetchOptions extends RequestInit {
    waitForServer?: boolean;
    allowNotFound?: boolean;
    retryOnFetchFailure?: boolean;
    timeoutMs?: number;
}

export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const waitForServerReady = async (retries = 10, interval = 1000): Promise<boolean> => {
    for (let i = 0; i < retries; i++) {
        if (await checkServerHealth()) {
            return true;
        }
        await sleep(interval);
    }
    return false;
};

let serverHealthCheckPromise: Promise<boolean> | null = null;

export const checkServerHealth = async (): Promise<boolean> => {
    if (serverHealthCheckPromise) {
        return serverHealthCheckPromise;
    }

    serverHealthCheckPromise = (async () => {
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
        } finally {
            serverHealthCheckPromise = null;
        }

        serverOnline = false;
        return false;
    })();

    return serverHealthCheckPromise;
};


export const serverFetch = async <T>(path: string, options?: ServerFetchOptions): Promise<T> => {
    const shouldWaitForServer = options?.waitForServer ?? true;
    const { allowNotFound: _allowNotFound, waitForServer: _waitForServer, retryOnFetchFailure, timeoutMs = 15000, ...fetchOptions } = options || {};
    const method = String(fetchOptions.method || 'GET').toUpperCase();
    const isIdempotent = method === 'GET' || method === 'HEAD';
    const shouldRetryOnFetchFailure = retryOnFetchFailure ?? isIdempotent;

    if (serverOnline === null) {
        if (shouldWaitForServer) {
            await waitForServerReady();
        } else {
            await checkServerHealth();
        }
    }
    if (!serverOnline) {
        throw new Error("Server offline");
    }

    for (let attempt = 0; attempt < (shouldRetryOnFetchFailure ? 2 : 1); attempt += 1) {
        try {
            let signal: AbortSignal | null | undefined = fetchOptions.signal;
            if (timeoutMs > 0) {
                const timeoutSignal = AbortSignal.timeout(timeoutMs);
                const abortAny = (AbortSignal as any).any;
                signal = signal
                    ? (typeof abortAny === 'function' ? abortAny([signal, timeoutSignal]) : signal)
                    : timeoutSignal;
            }
            const res = await fetch(`${SERVER_URL}${path}`, {
                ...fetchOptions,
                signal: signal || undefined,
                headers: {
                    'Content-Type': 'application/json',
                    ...(fetchOptions.headers || {})
                }
            });

            if (!res.ok) {
                if (res.status === 404 && options?.allowNotFound) {
                    return false as unknown as T;
                }
                const errorData = await res.json().catch(() => null);
                const errorMsg = errorData?.error || `Request to ${path} failed with status ${res.status}`;
                console.error(`[API ERROR] ${path}:`, errorMsg);
                throw new HttpError(errorMsg, res.status);
            }

            const text = await res.text();
            if (!text) return null as unknown as T;
            try {
                return JSON.parse(text);
            } catch (e) {
                console.error(`[API ERROR] Failed to parse JSON from ${path}:`, text);
                throw e;
            }
        } catch (e: any) {
            const isTimeoutOrAbort =
                e?.name === 'TimeoutError' ||
                e?.name === 'AbortError' ||
                Boolean(fetchOptions.signal?.aborted);

            if (isTimeoutOrAbort || e instanceof HttpError) {
                throw e;
            }

            // If request fails due to network/transport error, reset status so we re-probe next time
            serverOnline = null;

            if (shouldRetryOnFetchFailure && isIdempotent && attempt === 0) {
                await sleep(300);
                await waitForServerReady(12, 250);
                continue;
            }

            throw e;
        }
    }

    throw new Error(`Request to ${path} failed after retry`);
};

export const systemApi = {
    detectClaude: () => serverFetch<ClaudeCodeInfo | null>('/api/system/detect/claude'),
    detectOllama: () => serverFetch<OllamaInfo | null>('/api/system/detect/ollama'),
    detectGemini: () => serverFetch<GeminiInfo | null>('/api/system/detect/gemini'),
    detectOpenAi: () => serverFetch<OpenAiCliInfo | null>('/api/system/detect/openai'),
    clearAllCaches: () => serverFetch<void>('/api/system/detect/clear-cache', { method: 'POST' }),
    shutdown: () => serverFetch<void>('/api/system/shutdown?source=ui', { method: 'POST' }),
    getAppDataDirectory: () => serverFetch<string>('/api/system/data-directory'),
    isFirstInstall: () => serverFetch<boolean>('/api/system/first-install'),
    getUpdatePolicy: () => serverFetch<any>('/api/system/update/policy')
};

export const chatApi = {
    sendMessage: (messages: ChatMessage[], projectId?: string, skillId?: string, skillParams?: Record<string, string>, providerType?: ProviderType, signal?: AbortSignal) => serverFetch<ChatResponse>('/api/chat/send', {
        method: 'POST',
        body: JSON.stringify({ messages, projectId, skillId, skillParams, providerType }),
        timeoutMs: 600000, // 10 minutes for AI agent execution
        retryOnFetchFailure: false,
        signal
    }),
    getCompletion: (messages: ChatMessage[], projectId?: string, signal?: AbortSignal) => serverFetch<ChatResponse>('/api/chat/completion', {
        method: 'POST',
        body: JSON.stringify({ messages, projectId }),
        timeoutMs: 120000, // 2 minutes for inline completions
        retryOnFetchFailure: false,
        signal
    }),
    getOllamaModels: () => serverFetch<string[]>('/api/chat/ollama/models'),
    getProviderModels: (provider: ProviderType = 'googleCli') => serverFetch<(string | { id: string; name: string })[]>(`/api/chat/models?provider=${encodeURIComponent(provider)}`),
    stopAgentExecution: (projectId?: string) => serverFetch<void>('/api/chat/stop', {
        method: 'POST',
        body: JSON.stringify({ project_id: projectId }),
        retryOnFetchFailure: false
    }),
    getStatus: (projectId?: string) => serverFetch<{ isRunning: boolean; run?: { projectId: string; startedAt: number; provider: string; lastTrace?: string } | null }>(`/api/chat/status?project_id=${encodeURIComponent(projectId || 'default')}`),
    getVoiceCapabilities: () => serverFetch<VoiceCapabilities>('/api/chat/voice/capabilities'),
    transcribeAudio: (payload: { audioBase64: string; mimeType: string; language?: string; preferredProvider?: string }, signal?: AbortSignal) => serverFetch<TranscribeResponse>('/api/chat/transcribe', {
        method: 'POST',
        body: JSON.stringify(payload),
        timeoutMs: 90000,
        retryOnFetchFailure: false,
        signal
    }),
    checkVisionCapabilities: (provider: string, model?: string) => serverFetch<{ supported?: boolean | null; status: 'supported' | 'unsupported' | 'unverified'; model?: string; source?: string }>(`/api/chat/vision/check?provider=${encodeURIComponent(provider)}${model ? `&model=${encodeURIComponent(model)}` : ''}`)
};

export const authApi = {
    authenticateGoogle: () => serverFetch<string>('/api/auth/google/login', { method: 'POST' }),
    authenticateGemini: () => serverFetch<string>('/api/auth/google/login', { method: 'POST' }),
    getGoogleAuthStatus: () => serverFetch<GoogleAuthStatus>('/api/auth/gemini/status'),
    logoutGoogle: () => serverFetch<string>('/api/auth/gemini/logout', { method: 'POST' }),
    authenticateOpenAI: () => serverFetch<string>('/api/auth/openai/login', { method: 'POST' }),
    getOpenAIAuthStatus: () => serverFetch<OpenAiAuthStatus>('/api/auth/openai/status'),
    logoutOpenAI: () => serverFetch<string>('/api/auth/openai/logout', { method: 'POST' })
};

export const secretsApi = {
    hasSecret: (id: string) => serverFetch<{ has_secret: boolean }>(`/api/secrets/has?id=${encodeURIComponent(id)}`),
    setSecret: (id: string, value: string) => serverFetch<void>('/api/secrets/set', {
        method: 'POST',
        body: JSON.stringify({ id, value }),
    }),
    listSecrets: () => serverFetch<string[]>('/api/secrets/list')
};

export const projectsApi = {
    getAllProjects: () => serverFetch<Project[]>('/api/projects', { timeoutMs: 45000 })
};

export const settingsApi = {
    getGlobalSettings: () => serverFetch<GlobalSettings>('/api/settings/global'),
    saveGlobalSettings: (settings: GlobalSettings) => serverFetch<void>('/api/settings/global', {
        method: 'POST',
        body: JSON.stringify(settings)
    }),
    getUsageStatistics: (projectId?: string) => serverFetch<any>(`/api/settings/usage${projectId ? `?project_id=${encodeURIComponent(projectId)}` : ''}`),
    addCustomCli: (config: CustomCliConfig) => serverFetch<void>('/api/settings/custom_cli', {
        method: 'POST',
        body: JSON.stringify(config)
    }),
    removeCustomCli: (name: string) => serverFetch<void>(`/api/settings/custom_cli?name=${encodeURIComponent(name)}`, {
        method: 'DELETE'
    }),
    listAvailableProviders: () => serverFetch<ProviderType[]>('/api/settings/providers')
};

export const filesApi = {
    getProjectFiles: (projectId: string, sort?: string) => serverFetch<string[]>(`/api/projects/files?project_id=${encodeURIComponent(projectId)}${sort ? `&sort=${encodeURIComponent(sort)}` : ''}`, { timeoutMs: 45000 }),
    checkFileExists: (projectId: string, fileName: string) => serverFetch<boolean>(`/api/files/exists?project_id=${encodeURIComponent(projectId)}&file_name=${encodeURIComponent(fileName)}`, { allowNotFound: true }),
    readFile: (projectId: string, fileName: string) => serverFetch<string>(`/api/files/read?project_id=${encodeURIComponent(projectId)}&file_name=${encodeURIComponent(fileName)}`),
    writeFile: (projectId: string, fileName: string, content: string) => serverFetch<void>('/api/files/write', {
        method: 'PUT',
        body: JSON.stringify({ project_id: projectId, file_name: fileName, content })
    }),
    renameFile: (projectId: string, oldName: string, newName: string) => serverFetch<void>('/api/files/rename', {
        method: 'POST',
        body: JSON.stringify({ project_id: projectId, old_name: oldName, new_name: newName })
    }),
    deleteFile: (projectId: string, fileName: string) => serverFetch<void>(`/api/files/delete?project_id=${encodeURIComponent(projectId)}&file_name=${encodeURIComponent(fileName)}`, {
        method: 'DELETE'
    }),
    searchInFiles: (projectId: string, searchText: string, caseSensitive: boolean, useRegex: boolean) => serverFetch<SearchMatch[]>('/api/files/search', {
        method: 'POST',
        body: JSON.stringify({ project_id: projectId, search_text: searchText, case_sensitive: caseSensitive, use_regex: useRegex })
    }),
    replaceInFiles: (projectId: string, searchText: string, replaceText: string, caseSensitive: boolean, fileNames?: string[]) => serverFetch<number>('/api/files/replace', {
        method: 'POST',
        body: JSON.stringify({ project_id: projectId, search_text: searchText, replace_text: replaceText, case_sensitive: caseSensitive, file_names: fileNames || [] })
    }),
    importDocument: (projectId: string, sourcePath: string) => serverFetch<string>('/api/files/import', {
        method: 'POST',
        body: JSON.stringify({ project_id: projectId, source_path: sourcePath })
    }),
    importTranscript: (projectId: string, sourcePath: string) => serverFetch<string>('/api/files/import/transcript', {
        method: 'POST',
        body: JSON.stringify({ project_id: projectId, source_path: sourcePath })
    }),
    createFolder: (projectId: string, folderPath: string) => serverFetch<void>('/api/folders/create', {
        method: 'POST',
        body: JSON.stringify({ project_id: projectId, folder_path: folderPath })
    }),
    renameFolder: (projectId: string, oldPath: string, newPath: string) => serverFetch<void>('/api/folders/rename', {
        method: 'POST',
        body: JSON.stringify({ project_id: projectId, old_path: oldPath, new_path: newPath })
    }),
    deleteFolder: (projectId: string, folderPath: string) => serverFetch<void>(`/api/folders/delete?project_id=${encodeURIComponent(projectId)}&folder_path=${encodeURIComponent(folderPath)}`, {
        method: 'DELETE'
    }),
    exportDocument: (projectId: string, fileName: string, targetPath: string, exportFormat: string) => serverFetch<void>('/api/files/export', {
        method: 'POST',
        body: JSON.stringify({ project_id: projectId, file_name: fileName, target_path: targetPath, export_format: exportFormat })
    }),
    getComments: (projectId: string, fileName: string) => serverFetch<Comment[]>(`/api/projects/${encodeURIComponent(projectId)}/files/${encodeURIComponent(fileName)}/comments`),
    saveComments: (projectId: string, fileName: string, comments: Comment[]) => serverFetch<void>(`/api/projects/${encodeURIComponent(projectId)}/files/${encodeURIComponent(fileName)}/comments`, {
        method: 'POST',
        body: JSON.stringify({ comments })
    })
};

export const artifactsApi = {
    listArtifacts: (projectId: string, type?: ArtifactType) => serverFetch<Artifact[]>(`/api/artifacts/list?project_id=${encodeURIComponent(projectId)}${type ? `&artifact_type=${encodeURIComponent(type)}` : ''}`, { timeoutMs: 45000 }),
    createArtifact: (projectId: string, type: ArtifactType, title: string) => serverFetch<Artifact>('/api/artifacts/create', {
        method: 'POST',
        body: JSON.stringify({ project_id: projectId, artifact_type: type, title })
    }),
    getArtifact: (projectId: string, type: ArtifactType, artifactId: string) => serverFetch<Artifact>(`/api/artifacts/get?project_id=${encodeURIComponent(projectId)}&artifact_type=${encodeURIComponent(type)}&artifact_id=${encodeURIComponent(artifactId)}`),
    saveArtifact: (artifact: Artifact) => serverFetch<void>('/api/artifacts/save', {
        method: 'PUT',
        body: JSON.stringify(artifact)
    }),
    deleteArtifact: (projectId: string, type: ArtifactType, artifactId: string) => serverFetch<void>(`/api/artifacts/delete?project_id=${encodeURIComponent(projectId)}&artifact_type=${encodeURIComponent(type)}&artifact_id=${encodeURIComponent(artifactId)}`, {
        method: 'DELETE'
    }),
    importArtifact: (projectId: string, type: ArtifactType, sourcePath: string) => serverFetch<Artifact>('/api/artifacts/import', {
        method: 'POST',
        body: JSON.stringify({ project_id: projectId, artifact_type: type, source_path: sourcePath })
    }),
    exportArtifact: (projectId: string, artifactId: string, type: ArtifactType, targetPath: string, exportFormat: string) => serverFetch<void>('/api/artifacts/export', {
        method: 'POST',
        body: JSON.stringify({ project_id: projectId, artifact_id: artifactId, artifact_type: type, target_path: targetPath, export_format: exportFormat })
    }),
    convertFileToArtifact: (projectId: string, fileId: string, artifactType: ArtifactType) => serverFetch<Artifact>('/api/artifacts/convert', {
        method: 'POST',
        body: JSON.stringify({ project_id: projectId, file_id: fileId, artifact_type: artifactType })
    }),
    updateArtifactMetadata: (projectId: string, artifactType: ArtifactType, artifactId: string, title?: string, confidence?: number) => serverFetch<void>('/api/artifacts/update-metadata', {
        method: 'POST',
        body: JSON.stringify({ project_id: projectId, artifact_type: artifactType, artifact_id: artifactId, title, confidence })
    })
};

export const workflowsApi = {
    getProjectWorkflows: (projectId: string) => serverFetch<Workflow[]>(`/api/workflows?project_id=${encodeURIComponent(projectId)}`, { timeoutMs: 45000 }),
    getWorkflow: (projectId: string, workflowId: string) => serverFetch<Workflow>(`/api/workflows/get?project_id=${encodeURIComponent(projectId)}&workflow_id=${encodeURIComponent(workflowId)}`),
    createWorkflow: (projectId: string, name: string, description: string) => serverFetch<Workflow>('/api/workflows/create', {
        method: 'POST',
        body: JSON.stringify({ project_id: projectId, name, description })
    }),
    saveWorkflow: (workflow: Workflow) => serverFetch<void>('/api/workflows/save', {
        method: 'PUT',
        body: JSON.stringify(workflow)
    }),
    deleteWorkflow: (projectId: string, workflowId: string) => serverFetch<void>(`/api/workflows/delete?project_id=${encodeURIComponent(projectId)}&workflow_id=${encodeURIComponent(workflowId)}`, {
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
    getWorkflowHistory: (projectId: string, workflowId: string) => serverFetch<WorkflowRunRecord[]>(`/api/workflows/history?project_id=${encodeURIComponent(projectId)}&workflow_id=${encodeURIComponent(workflowId)}`),
    executeWorkflow: (projectId: string, workflowId: string, parameters?: Record<string, string>) => serverFetch<string>('/api/workflows/execute', {
        method: 'POST',
        body: JSON.stringify({ project_id: projectId, workflow_id: workflowId, parameters }),
        timeoutMs: 60000,
        retryOnFetchFailure: false
    }),
    stopWorkflow: (projectId: string, workflowId: string) => serverFetch<void>('/api/workflows/stop', {
        method: 'POST',
        body: JSON.stringify({ project_id: projectId, workflow_id: workflowId }),
        retryOnFetchFailure: false
    }),
    stopWorkflowExecution: (projectId: string, workflowId: string) => serverFetch<void>('/api/workflows/stop-execution', {
        method: 'POST',
        body: JSON.stringify({ project_id: projectId, workflow_id: workflowId }),
        retryOnFetchFailure: false
    }),
    getActiveRuns: () => serverFetch<Record<string, WorkflowExecution>>('/api/workflows/active')
};

export const skillsApi = {
    getAllSkills: () => serverFetch<Skill[]>('/api/skills', { timeoutMs: 45000 }),
    getSkill: (skillId: string) => serverFetch<Skill>(`/api/skills/get?skill_id=${encodeURIComponent(skillId)}`),
    createSkill: (name: string, description: string, prompt_template: string, capabilities: string[]) => serverFetch<Skill>('/api/skills/create', {
        method: 'POST',
        body: JSON.stringify({ name, description, prompt_template, capabilities })
    }),
    updateSkill: (skill: Skill) => serverFetch<void>('/api/skills/update', {
        method: 'PUT',
        body: JSON.stringify(skill)
    }),
    deleteSkill: (skillId: string) => serverFetch<void>(`/api/skills/delete?skill_id=${encodeURIComponent(skillId)}`, {
        method: 'DELETE'
    }),
    importSkill: (npxCommand: string) => serverFetch<Skill>('/api/skills/import', {
        method: 'POST',
        body: JSON.stringify({ npxCommand }),
        timeoutMs: 180000,
        retryOnFetchFailure: false
    }),
    getSkillsByCategory: (category: string) => serverFetch<Skill[]>(`/api/skills/get?category=${encodeURIComponent(category)}`)
};

export const mcpApi = {
    getMcpServers: () => serverFetch<any[]>('/api/mcp/servers'),
    addMcpServer: (config: any) => serverFetch<any>('/api/mcp/servers/add', {
        method: 'POST',
        body: JSON.stringify(config)
    }),
    removeMcpServer: (id: string) => serverFetch<void>(`/api/mcp/servers/remove?id=${encodeURIComponent(id)}`, {
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
    getMarketplaceServers: (query?: string) => serverFetch<any[]>(`/api/mcp/marketplace${query ? `?query=${encodeURIComponent(query)}` : ''}`)
};

export const telemetryApi = {
    track: (event: string, payload: Record<string, any> = {}) => {
        const { allowed, props } = sanitizeTelemetryEvent(event, payload);
        if (!allowed) {
            return Promise.resolve(undefined);
        }
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('productos:local-telemetry-event', {
                detail: { name: event, payload: props }
            }));
        }
        return serverFetch<void>('/api/telemetry/event', {
            method: 'POST',
            body: JSON.stringify({ event, payload: props }),
            waitForServer: false,
            retryOnFetchFailure: false
        }).catch(() => undefined);
    }
};

export const researchLogApi = {
    getResearchLog: (projectId: string) => serverFetch<any[]>(`/api/research-log?project_id=${encodeURIComponent(projectId)}`),
    clearResearchLog: (projectId: string) => serverFetch<void>('/api/research-log/clear', {
        method: 'POST',
        body: JSON.stringify({ project_id: projectId })
    })
};

export const projectsApiExtended = {
    getProject: (projectId: string) => serverFetch<Project>(`/api/projects/get?project_id=${encodeURIComponent(projectId)}`),
    createProject: (name: string, goal: string, skills: string[]) => serverFetch<Project>('/api/projects/create', {
        method: 'POST',
        body: JSON.stringify({ name, goal, skills })
    }),
    deleteProject: (projectId: string) => serverFetch<void>(`/api/projects/delete?project_id=${encodeURIComponent(projectId)}`, {
        method: 'DELETE'
    }),
    renameProject: (projectId: string, newName: string) => serverFetch<void>('/api/projects/rename', {
        method: 'POST',
        body: JSON.stringify({ project_id: projectId, new_name: newName })
    }),
    getProjectCost: (projectId: string) => serverFetch<number>(`/api/projects/cost?project_id=${encodeURIComponent(projectId)}`),
    getProjectTemplates: (projectId: string) => serverFetch<Record<string, string>>(`/api/projects/templates?project_id=${encodeURIComponent(projectId)}`, { timeoutMs: 30000 })
};

export const silentLearnerApi = {
    getStatus: (projectId: string) => serverFetch<SilentLearnerStatus>(`/api/silent-learner/status?project_id=${encodeURIComponent(projectId)}`),
    toggle: (projectId: string, enabled: boolean) => serverFetch<{ state: string }>('/api/silent-learner/toggle', {
        method: 'POST',
        body: JSON.stringify({ project_id: projectId, enabled })
    }),
    optimize: (projectId: string) => serverFetch<{ ok: boolean }>('/api/silent-learner/optimize', {
        method: 'POST',
        body: JSON.stringify({ project_id: projectId })
    }),
    forgetSession: (projectId: string, sessionId: string) => serverFetch<{ deleted: number }>('/api/silent-learner/forget-session', {
        method: 'POST',
        body: JSON.stringify({ project_id: projectId, session_id: sessionId })
    }),
    forgetWorkspace: (projectId: string) => serverFetch<void>(`/api/silent-learner/forget-workspace?project_id=${encodeURIComponent(projectId)}`, {
        method: 'DELETE'
    }),
    exportMemory: (projectId: string) => serverFetch<any>(`/api/silent-learner/export?project_id=${encodeURIComponent(projectId)}`),
    getRedactionReview: (projectId: string, redactionId?: string | null) => {
        const params = new URLSearchParams({ project_id: projectId });
        if (redactionId) params.set('redaction_id', redactionId);
        return serverFetch<SilentLearnerRedactionReview>(`/api/silent-learner/redaction-review?${params.toString()}`);
    },
    resolveRedaction: (
        projectId: string,
        payload: { redactionId?: string | null; action: 'acknowledge' | 'delete_chat'; targetChatFile?: string | null }
    ) => serverFetch<SilentLearnerRedactionResolveResult>('/api/silent-learner/redaction-resolve', {
        method: 'POST',
        body: JSON.stringify({
            project_id: projectId,
            redaction_id: payload.redactionId || undefined,
            action: payload.action,
            target_chat_file: payload.targetChatFile || undefined,
        })
    }),
    getKnowledgeHealth: (projectId: string) => serverFetch<any>(`/api/projects/${encodeURIComponent(projectId)}/knowledge-health`)
};

export const presentationApi = {
    getBrandConfig: (projectId: string) => serverFetch<{ brandConfig: any; hasCustomTemplate: boolean }>(`/api/projects/brand?project_id=${encodeURIComponent(projectId)}`),
    updateBrandConfig: (projectId: string, brandConfig: any) => serverFetch<any>(`/api/projects/brand?project_id=${encodeURIComponent(projectId)}`, {
        method: 'POST',
        body: JSON.stringify(brandConfig)
    }),
    uploadTemplate: (projectId: string, base64Data: string) => serverFetch<{ success: boolean; brandSettings?: string }>(`/api/projects/presentation/template?project_id=${encodeURIComponent(projectId)}`, {
        method: 'POST',
        body: JSON.stringify({ base64Data })
    }),
    deleteTemplate: (projectId: string) => serverFetch<{ success: boolean }>(`/api/projects/presentation/template?project_id=${encodeURIComponent(projectId)}`, {
        method: 'DELETE'
    }),
    exportTemplate: async (projectId: string, slides: any[], title?: string): Promise<Blob> => {
        const response = await fetch(`${SERVER_URL}/api/projects/presentation/export-template?project_id=${encodeURIComponent(projectId)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ slides, title })
        });
        if (!response.ok) {
            const errorText = await response.text().catch(() => 'Export failed');
            throw new Error(errorText || `Export failed with status ${response.status}`);
        }
        return await response.blob();
    }
};

export const criticApi = {
    auditArtifact: (params: {
        projectId?: string;
        artifactPath?: string;
        content: string;
        critics?: Array<'devils_pm' | 'telemetry_guardian' | 'tone_inspector'>;
        artifactType?: string;
        source?: string;
    }) => serverFetch<CriticAuditResult>('/api/artifacts/audit', {
        method: 'POST',
        body: JSON.stringify(params)
    }),
    sendFeedback: (params: {
        projectId: string;
        feedbackType: 'critic_resolution' | 'socratic_decision';
        data: Record<string, any>;
    }) => serverFetch<{ success: boolean; updatedRulesCount?: number }>('/api/learning/feedback', {
        method: 'POST',
        body: JSON.stringify(params)
    })
};

export const socraticApi = {
    detectIntent: (params: {
        prompt: string;
        history?: any[];
        projectId?: string;
    }) => serverFetch<SocraticProposal>('/api/socratic/detect', {
        method: 'POST',
        body: JSON.stringify(params)
    })
};

export const auditArtifact = criticApi.auditArtifact;
export const sendLearningFeedback = criticApi.sendFeedback;



