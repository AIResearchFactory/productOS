import type {
  Artifact,
  ArtifactType,
  ChatMessage,
  ChatResponse,
  ClaudeCodeInfo,
  GeminiInfo,
  GlobalSettings,
  InstallationConfig,
  OllamaInfo,
  OpenAiCliInfo,
  AppConfig,
  Project,
  ProjectSettings,
  SearchMatch,
  Skill,
  UsageStatistics,
  Workflow,
  WorkflowRunRecord,
  WorkflowSchedule,
} from './tauri';

const getStore = <T>(key: string, def: T): T => {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null') || def;
  } catch {
    return def;
  }
};

const setStore = (key: string, val: unknown) => {
  localStorage.setItem(key, JSON.stringify(val));
};

const getEventBus = (): EventTarget | null => {
  if (typeof window === 'undefined') return null;
  const keyedWindow = window as typeof window & { __PRODUCTOS_RUNTIME_BUS__?: EventTarget };
  if (!keyedWindow.__PRODUCTOS_RUNTIME_BUS__) {
    keyedWindow.__PRODUCTOS_RUNTIME_BUS__ = new EventTarget();
  }
  return keyedWindow.__PRODUCTOS_RUNTIME_BUS__;
};

const createProjectRecord = (name: string, goal: string): Project => ({
  id: `proj-${Date.now()}`,
  name,
  goal,
  skills: [],
  created_at: new Date().toISOString(),
});

const getProjectSettingsStore = (): Record<string, ProjectSettings> => {
  return getStore('mock_project_settings', {} as Record<string, ProjectSettings>);
};

const setProjectSettingsStore = (val: Record<string, ProjectSettings>) => {
  setStore('mock_project_settings', val);
};

const getProjectFilesStore = (): Record<string, Record<string, string>> => {
  return getStore('mock_project_file_contents', {} as Record<string, Record<string, string>>);
};

const setProjectFilesStore = (val: Record<string, Record<string, string>>) => {
  setStore('mock_project_file_contents', val);
};

const getArtifactsStore = (): Record<string, Artifact[]> => {
  return getStore('mock_artifacts_by_project', {} as Record<string, Artifact[]>);
};

const setArtifactsStore = (val: Record<string, Artifact[]>) => {
  setStore('mock_artifacts_by_project', val);
};

const getWorkflowsStore = (): Workflow[] => {
  return getStore('mock_workflows', [] as Workflow[]);
};

const setWorkflowsStore = (val: Workflow[]) => {
  setStore('mock_workflows', val);
};

const getWorkflowHistoryStore = (): Record<string, WorkflowRunRecord[]> => {
  return getStore('mock_workflow_history', {} as Record<string, WorkflowRunRecord[]>);
};

const setWorkflowHistoryStore = (val: Record<string, WorkflowRunRecord[]>) => {
  setStore('mock_workflow_history', val);
};

const defaultSettings = (): GlobalSettings => ({
  defaultModel: 'local-browser-runtime',
  theme: 'dark',
  notificationsEnabled: true,
  activeProvider: 'ollama',
  ollama: { model: 'llama3.1', apiUrl: 'http://localhost:11434' },
  claude: { model: 'claude-sonnet-4' },
  hosted: { provider: 'openrouter', model: 'openai/gpt-4.1', apiKeySecretId: '' },
  geminiCli: { command: 'gemini', modelAlias: 'gemini-1.5-pro', apiKeySecretId: '' },
  openAiCli: { command: 'codex', modelAlias: 'gpt-5-codex', apiKeySecretId: '' },
  liteLlm: {
    enabled: false,
    baseUrl: '',
    apiKeySecretId: '',
    strategy: {
      defaultModel: '',
      researchModel: '',
      codingModel: '',
      editingModel: '',
    },
    shadowMode: false,
  },
  customClis: [],
  mcpServers: [],
  autoEscalateThreshold: 5,
  budgetWarningThreshold: 10,
  selectedProviders: ['ollama'],
  enableAiAutocomplete: false,
  channelConfig: {
    enabled: false,
    telegramEnabled: false,
    whatsappEnabled: false,
    defaultProjectRouting: '',
    telegramDefaultChatId: '',
    whatsappPhoneNumberId: '',
    whatsappDefaultRecipient: '',
    notes: '',
    hasTelegramToken: false,
    hasWhatsappToken: false,
  },
});

const defaultSkills = (): Skill[] => [];

const getSkillsStore = (): Skill[] => {
  return getStore('mock_skills', defaultSkills());
};

const setSkillsStore = (val: Skill[]) => {
  setStore('mock_skills', val);
};

const getMcpServersStore = () => {
  return getStore('mock_mcp_servers', [] as any[]);
};

const setMcpServersStore = (val: any[]) => {
  setStore('mock_mcp_servers', val);
};

const defaultAppConfig = (): AppConfig => ({
  app_data_directory: '/browser-runtime/data',
  installation_date: new Date().toISOString(),
  version: 'Browser Runtime',
  claude_code_enabled: true,
  ollama_enabled: true,
  gemini_enabled: false,
  openai_enabled: true,
  last_update_check: undefined,
});

const ensureProjectFiles = (projectId: string): Record<string, string> => {
  const all = getProjectFilesStore();
  if (!all[projectId]) {
    all[projectId] = {
      'README.md': '# New Project\n',
      'context.md': '# Context\n',
    };
    setProjectFilesStore(all);
  }
  return all[projectId];
};

const searchMatchesInContent = (
  fileName: string,
  content: string,
  searchText: string,
  caseSensitive: boolean,
  useRegex: boolean
): SearchMatch[] => {
  if (!searchText) return [];

  const flags = caseSensitive ? 'g' : 'gi';
  const pattern = useRegex
    ? new RegExp(searchText, flags)
    : new RegExp(searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);

  const matches: SearchMatch[] = [];
  const lines = content.split('\n');

  lines.forEach((line, index) => {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(line)) !== null) {
      matches.push({
        file_name: fileName,
        line_number: index + 1,
        line_content: line,
        match_start: match.index,
        match_end: match.index + match[0].length,
      });

      if (match[0].length === 0) {
        pattern.lastIndex += 1;
      }
    }
  });

  return matches;
};

const artifactDir = (type: ArtifactType): string => {
  switch (type) {
    case 'roadmap': return 'roadmaps';
    case 'product_vision': return 'product-visions';
    case 'one_pager': return 'one-pagers';
    case 'prd': return 'prds';
    case 'initiative': return 'initiatives';
    case 'competitive_research': return 'competitive-research';
    case 'user_story': return 'user-stories';
    case 'insight': return 'insights';
    case 'presentation': return 'presentations';
    case 'pr_faq': return 'pr-faqs';
    default: return 'artifacts';
  }
};

export const runtimeApi = {
  async getRuntimeHealth(): Promise<{ ok: boolean; mode: 'browser'; transport: 'localStorage' }> {
    return { ok: true, mode: 'browser', transport: 'localStorage' };
  },

  async isFirstInstall(): Promise<boolean> {
    return !localStorage.getItem('productOS_runtime_initialized');
  },

  async checkInstallationStatus(): Promise<InstallationConfig> {
    return {
      app_data_path: '/browser-runtime/data',
      is_first_install: !(await this.isFirstInstall()),
      claude_code_detected: true,
      ollama_detected: true,
      gemini_detected: false,
    };
  },

  async getGlobalSettings(): Promise<GlobalSettings> {
    return getStore('mock_settings', defaultSettings());
  },

  async saveGlobalSettings(settings: GlobalSettings): Promise<void> {
    setStore('mock_settings', settings);
  },

  async getProjectSettings(projectId: string): Promise<ProjectSettings | null> {
    const settings = getProjectSettingsStore();
    return settings[projectId] || null;
  },

  async saveProjectSettings(projectId: string, settings: ProjectSettings): Promise<void> {
    const all = getProjectSettingsStore();
    all[projectId] = settings;
    setProjectSettingsStore(all);
  },

  async getAllProjects(): Promise<Project[]> {
    return getStore('mock_projects', [] as Project[]);
  },

  async createProject(name: string, goal: string, skills: string[]): Promise<Project> {
    const projects = getStore('mock_projects', [] as Project[]);
    const project = createProjectRecord(name, goal);
    setStore('mock_projects', [...projects, project]);

    const allSettings = getProjectSettingsStore();
    allSettings[project.id] = {
      name,
      goal,
      preferred_skills: skills,
      auto_save: true,
      encryption_enabled: true,
      personalization_rules: '',
      brand_settings: '',
    };
    setProjectSettingsStore(allSettings);

    ensureProjectFiles(project.id);

    localStorage.setItem('productOS_runtime_initialized', 'true');
    return project;
  },

  async renameProject(projectId: string, newName: string): Promise<void> {
    const projects = getStore('mock_projects', [] as Project[]);
    setStore(
      'mock_projects',
      projects.map((project) => project.id === projectId ? { ...project, name: newName } : project)
    );

    const allSettings = getProjectSettingsStore();
    if (allSettings[projectId]) {
      allSettings[projectId] = {
        ...allSettings[projectId],
        name: newName,
      };
      setProjectSettingsStore(allSettings);
    }
  },

  async deleteProject(projectId: string): Promise<void> {
    const projects = getStore('mock_projects', [] as Project[]);
    setStore('mock_projects', projects.filter((project) => project.id !== projectId));

    const projectSettings = getProjectSettingsStore();
    delete projectSettings[projectId];
    setProjectSettingsStore(projectSettings);

    const projectFiles = getProjectFilesStore();
    delete projectFiles[projectId];
    setProjectFilesStore(projectFiles);

    const artifacts = getArtifactsStore();
    delete artifacts[projectId];
    setArtifactsStore(artifacts);

    const settings = getStore('mock_settings', defaultSettings());
    if (settings.lastProjectId === projectId) {
      settings.lastProjectId = '';
      setStore('mock_settings', settings);
    }
  },

  async getProject(projectId: string): Promise<Project | null> {
    const projects = getStore('mock_projects', [] as Project[]);
    return projects.find((project) => project.id === projectId) || null;
  },

  async getAllSkills(): Promise<Skill[]> {
    return getSkillsStore();
  },

  async getSkill(skillId: string): Promise<Skill> {
    const skill = getSkillsStore().find((item) => item.id === skillId);
    if (!skill) {
      throw new Error(`Skill not found: ${skillId}`);
    }
    return skill;
  },

  async createSkill(name: string, description: string, template: string, category: string): Promise<Skill> {
    const now = new Date().toISOString();
    const skill: Skill = {
      id: name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-_]/g, '') || `skill-${Date.now()}`,
      name,
      description,
      prompt_template: template,
      capabilities: category ? [category] : [],
      parameters: [],
      examples: [],
      version: '1.0.0',
      created: now,
      updated: now,
    };

    const skills = getSkillsStore();
    const existingIndex = skills.findIndex((item) => item.id === skill.id);
    if (existingIndex >= 0) {
      skills[existingIndex] = skill;
    } else {
      skills.push(skill);
    }
    setSkillsStore(skills);
    return skill;
  },

  async updateSkill(skill: Skill): Promise<void> {
    const skills = getSkillsStore();
    const existingIndex = skills.findIndex((item) => item.id === skill.id);
    const updatedSkill = { ...skill, updated: new Date().toISOString() };

    if (existingIndex >= 0) {
      skills[existingIndex] = updatedSkill;
    } else {
      skills.push(updatedSkill);
    }

    setSkillsStore(skills);
  },

  async deleteSkill(skillId: string): Promise<void> {
    setSkillsStore(getSkillsStore().filter((skill) => skill.id !== skillId));
  },

  async importSkill(_npxCommand: string): Promise<Skill> {
    throw new Error('Skill import requires the Tauri runtime.');
  },

  async getProjectFiles(projectId: string): Promise<string[]> {
    return Object.keys(ensureProjectFiles(projectId));
  },

  async readMarkdownFile(projectId: string, fileName: string): Promise<string> {
    const files = ensureProjectFiles(projectId);
    return files[fileName] || '';
  },

  async writeMarkdownFile(projectId: string, fileName: string, content: string): Promise<void> {
    const all = getProjectFilesStore();
    const files = ensureProjectFiles(projectId);
    files[fileName] = content;
    all[projectId] = files;
    setProjectFilesStore(all);
  },

  async renameFile(projectId: string, oldName: string, newName: string): Promise<void> {
    const all = getProjectFilesStore();
    const files = ensureProjectFiles(projectId);
    if (!(oldName in files)) return;
    files[newName] = files[oldName];
    delete files[oldName];
    all[projectId] = files;
    setProjectFilesStore(all);
  },

  async deleteMarkdownFile(projectId: string, fileName: string): Promise<void> {
    const all = getProjectFilesStore();
    const files = ensureProjectFiles(projectId);
    delete files[fileName];
    all[projectId] = files;
    setProjectFilesStore(all);
  },

  async getProjectWorkflows(projectId: string): Promise<Workflow[]> {
    return getWorkflowsStore().filter((workflow) => workflow.project_id === projectId);
  },

  async saveWorkflow(workflow: Workflow): Promise<void> {
    const workflows = getWorkflowsStore();
    const index = workflows.findIndex((item) => item.id === workflow.id && item.project_id === workflow.project_id);
    if (index >= 0) {
      workflows[index] = workflow;
    } else {
      workflows.push(workflow);
    }
    setWorkflowsStore(workflows);
  },

  async deleteWorkflow(projectId: string, workflowId: string): Promise<void> {
    setWorkflowsStore(
      getWorkflowsStore().filter((workflow) => !(workflow.project_id === projectId && workflow.id === workflowId))
    );

    const history = getWorkflowHistoryStore();
    delete history[`${projectId}:${workflowId}`];
    setWorkflowHistoryStore(history);
  },

  async setWorkflowSchedule(projectId: string, workflowId: string, schedule: WorkflowSchedule): Promise<Workflow> {
    const workflows = getWorkflowsStore();
    const index = workflows.findIndex((workflow) => workflow.project_id === projectId && workflow.id === workflowId);
    if (index < 0) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }
    workflows[index] = { ...workflows[index], schedule };
    setWorkflowsStore(workflows);
    return workflows[index];
  },

  async clearWorkflowSchedule(projectId: string, workflowId: string): Promise<Workflow> {
    const workflows = getWorkflowsStore();
    const index = workflows.findIndex((workflow) => workflow.project_id === projectId && workflow.id === workflowId);
    if (index < 0) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }
    const { schedule: _schedule, ...rest } = workflows[index] as Workflow & { schedule?: WorkflowSchedule };
    workflows[index] = rest as Workflow;
    setWorkflowsStore(workflows);
    return workflows[index];
  },

  async getWorkflowHistory(projectId: string, workflowId: string): Promise<WorkflowRunRecord[]> {
    const history = getWorkflowHistoryStore();
    return history[`${projectId}:${workflowId}`] || [];
  },

  async executeWorkflow(_projectId: string, _workflowId: string): Promise<string> {
    throw new Error('Workflow execution requires the Tauri runtime.');
  },

  async importDocument(_projectId: string, _sourcePath: string): Promise<string> {
    throw new Error('Native document import currently requires the Tauri runtime.');
  },

  async importTranscript(_projectId: string, _sourcePath: string): Promise<string> {
    throw new Error('Native document import currently requires the Tauri runtime.');
  },

  async exportDocument(_projectId: string, _fileName: string, _targetPath: string, _exportFormat: string): Promise<void> {
    throw new Error('Native document export currently requires the Tauri runtime.');
  },

  async importArtifact(_projectId: string, _artifactType: ArtifactType, _sourcePath: string): Promise<Artifact> {
    throw new Error('Artifact file import currently requires the Tauri runtime.');
  },

  async runInstallation(): Promise<void> {
    throw new Error('Pandoc installation requires the Tauri runtime.');
  },

  async searchInFiles(projectId: string, searchText: string, caseSensitive: boolean, useRegex: boolean): Promise<SearchMatch[]> {
    const files = ensureProjectFiles(projectId);
    return Object.entries(files).flatMap(([fileName, content]) =>
      searchMatchesInContent(fileName, content, searchText, caseSensitive, useRegex)
    );
  },

  async replaceInFiles(projectId: string, searchText: string, replaceText: string, caseSensitive: boolean, fileNames: string[]): Promise<number> {
    if (!searchText) return 0;

    const all = getProjectFilesStore();
    const files = ensureProjectFiles(projectId);
    const pattern = new RegExp(searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), caseSensitive ? 'g' : 'gi');
    let replacementCount = 0;

    fileNames.forEach((fileName) => {
      const content = files[fileName];
      if (typeof content !== 'string') return;

      const matches = content.match(pattern);
      if (!matches?.length) return;

      replacementCount += matches.length;
      files[fileName] = content.replace(pattern, replaceText);
    });

    all[projectId] = files;
    setProjectFilesStore(all);
    return replacementCount;
  },

  async listArtifacts(projectId: string): Promise<Artifact[]> {
    const store = getArtifactsStore();
    return store[projectId] || [];
  },

  async createArtifact(projectId: string, artifactType: ArtifactType, title: string): Promise<Artifact> {
    const store = getArtifactsStore();
    const artifacts = store[projectId] || [];
    const artifact: Artifact = {
      id: `art-${Date.now()}`,
      artifactType,
      title,
      content: '',
      projectId,
      sourceRefs: [],
      confidence: undefined,
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      metadata: {},
      path: `${artifactDir(artifactType)}/${title.replace(/\s+/g, '-').toLowerCase()}.md`,
    };
    store[projectId] = [...artifacts, artifact];
    setArtifactsStore(store);
    return artifact;
  },

  async saveArtifact(artifact: Artifact): Promise<void> {
    const store = getArtifactsStore();
    const artifacts = store[artifact.projectId] || [];
    const index = artifacts.findIndex((item) => item.id === artifact.id);
    if (index >= 0) {
      artifacts[index] = { ...artifact, updated: new Date().toISOString() };
    } else {
      artifacts.push({ ...artifact, updated: new Date().toISOString() });
    }
    store[artifact.projectId] = artifacts;
    setArtifactsStore(store);
  },

  async deleteArtifact(projectId: string, artifactId: string): Promise<void> {
    const store = getArtifactsStore();
    store[projectId] = (store[projectId] || []).filter((artifact) => artifact.id !== artifactId);
    setArtifactsStore(store);
  },

  async listen<T>(event: string, handler: (event: { payload: T }) => void): Promise<() => void> {
    const bus = getEventBus();
    if (!bus) return () => {};

    const listener: EventListener = ((customEvent: Event) => {
      handler({ payload: (customEvent as CustomEvent<T>).detail });
    }) as EventListener;

    bus.addEventListener(event, listener);
    return () => bus.removeEventListener(event, listener);
  },

  async emit(event: string, payload?: any): Promise<void> {
    const bus = getEventBus();
    if (!bus) return;
    bus.dispatchEvent(new CustomEvent(event, { detail: payload }));
  },

  async getMcpServers(): Promise<any[]> {
    return getMcpServersStore();
  },

  async addMcpServer(_config: any): Promise<void> {
    throw new Error('MCP server installation requires the Tauri runtime.');
  },

  async removeMcpServer(id: string): Promise<void> {
    setMcpServersStore(getMcpServersStore().filter((server: any) => server.id !== id));
  },

  async toggleMcpServer(id: string, enabled: boolean): Promise<void> {
    setMcpServersStore(
      getMcpServersStore().map((server: any) => server.id === id ? { ...server, enabled } : server)
    );
  },

  async updateMcpServer(config: any): Promise<void> {
    const servers = getMcpServersStore();
    const index = servers.findIndex((server: any) => server.id === config.id);
    if (index >= 0) {
      servers[index] = { ...servers[index], ...config };
      setMcpServersStore(servers);
    }
  },

  async fetchMcpMarketplace(query?: string): Promise<any[]> {
    const catalog = [
      {
        id: 'filesystem-mcp',
        name: 'Filesystem MCP',
        description: 'Provides safe file access tools for local workspace operations.',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem'],
        enabled: true,
      },
      {
        id: 'fetch-mcp',
        name: 'Fetch MCP',
        description: 'Adds simple web fetch and retrieval capabilities.',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-fetch'],
        enabled: true,
      },
      {
        id: 'github-mcp',
        name: 'GitHub MCP',
        description: 'Adds GitHub repository and issue access for agent workflows.',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-github'],
        enabled: true,
      },
    ];

    const normalized = query?.trim().toLowerCase();
    if (!normalized) return catalog;
    return catalog.filter((server) =>
      server.name.toLowerCase().includes(normalized) ||
      server.description.toLowerCase().includes(normalized) ||
      server.id.toLowerCase().includes(normalized)
    );
  },

  async syncMcpWithClis(): Promise<string[]> {
    return [];
  },

  async detectClaudeCode(): Promise<ClaudeCodeInfo> {
    return { installed: true, version: 'browser-mock', path: '/usr/bin/claude', in_path: true };
  },

  async detectOllama(): Promise<OllamaInfo> {
    return { installed: true, version: 'browser-mock', path: '/usr/bin/ollama', running: true, in_path: true };
  },

  async detectGemini(): Promise<GeminiInfo> {
    return { installed: false, version: undefined, path: undefined, in_path: false, authenticated: false };
  },

  async detectOpenAiCli(): Promise<OpenAiCliInfo> {
    return { installed: true, version: 'browser-mock', path: '/usr/bin/codex', in_path: true };
  },

  async getAppVersion(): Promise<string> {
    return 'Browser Runtime';
  },

  async getOsType(): Promise<string> {
    if (typeof navigator === 'undefined') {
      return 'windows';
    }

    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('mac')) return 'macos';
    if (ua.includes('win')) return 'windows';
    if (ua.includes('linux')) return 'linux';
    return 'windows';
  },

  async getAppConfig(): Promise<AppConfig> {
    return getStore('mock_app_config', defaultAppConfig());
  },

  async updateLastCheck(): Promise<AppConfig> {
    const config = {
      ...getStore('mock_app_config', defaultAppConfig()),
      last_update_check: new Date().toISOString(),
    };
    setStore('mock_app_config', config);
    return config;
  },

  async switchProvider(providerType: GlobalSettings['activeProvider']): Promise<void> {
    const settings = getStore('mock_settings', defaultSettings());
    settings.activeProvider = providerType;
    setStore('mock_settings', settings);
  },

  async getUsageStatistics(): Promise<UsageStatistics> {
    return {
      totalPrompts: 0,
      totalResponses: 0,
      totalCostUsd: 0,
      totalTimeSavedMinutes: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCacheReadTokens: 0,
      totalCacheCreationTokens: 0,
      totalReasoningTokens: 0,
      totalToolCalls: 0,
      providerBreakdown: [],
    };
  },

  async stopAgentExecution(): Promise<void> {
    return;
  },

  async sendMessage(messages: ChatMessage[]): Promise<ChatResponse> {
    const last = messages[messages.length - 1]?.content || '';
    return { content: `[Browser runtime] ${last}` };
  },

  async getCompletion(messages: ChatMessage[]): Promise<ChatResponse> {
    const prompt = messages[messages.length - 1]?.content?.replace(/\s+/g, ' ').trim() || '';
    if (!prompt) {
      return { content: '' };
    }

    const words = prompt.split(' ').filter(Boolean);
    const suggestion = words.slice(-12).join(' ');
    return { content: suggestion ? `${suggestion}...` : '' };
  },
};
