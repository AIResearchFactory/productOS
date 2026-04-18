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
  ProviderType,
  SearchMatch,
  Skill,
  UsageStatistics,
  Workflow,
  WorkflowRunRecord,
  WorkflowSchedule,
  OpenAiAuthStatus,
  GoogleAuthStatus,
  WhatsAppInfo,
  InstallationResult,
} from './contracts';
import pkg from '../../package.json';

const APP_VERSION = pkg.version;

const getStore = <T>(key: string, def: T): T => {
  try {
    const val = localStorage.getItem(key);
    if (val === null) return def;
    const parsed = JSON.parse(val);
    
    // Safety check: if we expect an array but got an object, return def
    if (Array.isArray(def) && !Array.isArray(parsed)) {
      return def;
    }
    
    return parsed || def;
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
  version: APP_VERSION,
  claude_code_enabled: true,
  ollama_enabled: true,
  gemini_enabled: true,
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

import { checkServerHealth, serverFetch, systemApi, secretsApi, settingsApi, chatApi, authApi, projectsApi, projectsApiExtended, filesApi, artifactsApi, workflowsApi, skillsApi, mcpApi, researchLogApi } from './server';
import { saveSecretToVault, getSecretFromVault, isVaultUnlocked, listVaultSecrets, lockVault } from '../lib/vault';

export const runtimeApi = {

  async detectClaudeCode(): Promise<ClaudeCodeInfo> {
    if (await checkServerHealth()) return (await systemApi.detectClaude()) ?? { installed: false, version: undefined, path: undefined, in_path: false, authenticated: false };
    return { installed: false, version: undefined, path: undefined, in_path: false, authenticated: false };
  },
  async detectOllama(): Promise<OllamaInfo> {
    if (await checkServerHealth()) return (await systemApi.detectOllama()) ?? { installed: false, version: undefined, running: false, in_path: false, path: undefined };
    return { installed: false, version: undefined, running: false, in_path: false, path: undefined };
  },
  async detectGemini(): Promise<GeminiInfo> {
    if (await checkServerHealth()) return (await systemApi.detectGemini()) ?? { installed: false, version: undefined, path: undefined, in_path: false, authenticated: false };
    const mockDetected = localStorage.getItem('mock_gemini_detected') === 'true';
    if (mockDetected) {
      return { installed: true, version: '1.2.0', path: '/usr/local/bin/gemini', in_path: true, authenticated: true };
    }
    return { installed: false, version: undefined, path: undefined, in_path: false, authenticated: false };
  },
  async detectOpenAiCli(): Promise<OpenAiCliInfo> {
    if (await checkServerHealth()) return (await systemApi.detectOpenAi()) ?? { installed: false, version: undefined, path: undefined, in_path: false };
    return { installed: false, version: undefined, path: undefined, in_path: false };
  },
  async clearAllCliDetectionCaches() {
    if (await checkServerHealth()) return systemApi.clearAllCaches();
  },
  async saveSecret(id: string, value: string) {
    if (await checkServerHealth()) return secretsApi.setSecret(id, value);
    if (isVaultUnlocked()) await saveSecretToVault(id, value);
  },
  async hasSecret(id: string) {
    if (await checkServerHealth()) return (await secretsApi.hasSecret(id)).has_secret;
    if (isVaultUnlocked()) return getSecretFromVault(id) !== null;
    return false;
  },
  async listSavedSecretIds() {
    if (await checkServerHealth()) return secretsApi.listSecrets();
    if (isVaultUnlocked()) return listVaultSecrets();
    return [];
  },
  async hasClaudeApiKey() {
    return this.hasSecret('claude_api_key');
  },
  async hasGeminiApiKey() {
    return this.hasSecret('gemini_api_key');
  },
  async getOpenAIAuthStatus(): Promise<OpenAiAuthStatus> {
    if (await checkServerHealth()) return authApi.getOpenAIAuthStatus();
    const has = await this.hasSecret('OPENAI_API_KEY');
    return {
      connected: has,
      method: 'browser-runtime',
      details: has ? 'Authenticated' : 'NotAuthenticated'
    };
  },
  async getGoogleAuthStatus(): Promise<GoogleAuthStatus> {
    if (await checkServerHealth()) return authApi.getGoogleAuthStatus();
    const has = await this.hasSecret('gemini_api_key');
    return {
      connected: has,
      method: 'browser-runtime',
      details: has ? 'Authenticated' : 'NotAuthenticated'
    };
  },
  async authenticateOpenAI() { 
    if (await checkServerHealth()) return authApi.authenticateOpenAI();
    window.open('https://platform.openai.com', '_blank'); 
    return 'Success'; 
  },
  async authenticateGemini() { 
    if (await checkServerHealth()) return authApi.authenticateGemini();
    window.open('https://aistudio.google.com', '_blank'); 
    return 'Success'; 
  },
  async logoutOpenAI() { 
    if (await checkServerHealth()) return authApi.logoutOpenAI();
    return 'Success'; 
  },
  async logoutGoogle() { 
    if (await checkServerHealth()) return authApi.logoutGoogle();
    return 'Success'; 
  },
  
  async loadChannelSettings(): Promise<any> { 
    if (await checkServerHealth()) {
      try {
        const res = await serverFetch<any>('/api/channels/settings');
        return res;
      } catch (e) {
        console.error('Failed to load channel settings from server:', e);
      }
    }
    return getStore('mock_channel_settings', { 
      enabled: false,
      telegramEnabled: false,
      whatsappEnabled: false,
      defaultProjectRouting: '',
      telegramDefaultChatId: '', 
      whatsappPhoneNumberId: '', 
      whatsappAccessToken: '', 
      whatsappDefaultRecipient: '',
      notes: '',
      hasTelegramToken: false,
      hasWhatsappToken: false
    }); 
  },
  async saveChannelSettings(settings: any): Promise<void> {
    if (await checkServerHealth()) {
      return serverFetch<void>('/api/channels/settings', {
        method: 'POST',
        body: JSON.stringify(settings)
      });
    }
    setStore('mock_channel_settings', settings);
  },
  async testTelegramConnection(_botToken?: string): Promise<{ ok: boolean; username?: string; first_name?: string }> { return { ok: false }; },
  async sendTelegramMessage(_botToken: string | undefined, _chatId: string, _text: string): Promise<string> { return 'Server required for telegram.'; },
  async testWhatsAppConnection(_access_token?: string, _phone_number_id?: string): Promise<WhatsAppInfo> { return { ok: false }; },
  async sendWhatsAppMessage(_access_token: string | undefined, _phone_number_id: string, _recipient_phone: string, _text: string): Promise<string> { return 'Server required for whatsapp.'; },
  async testLitellmConnection(_baseUrl: string, _apiKeySecretId: string): Promise<string> { return 'Server required for litellm.'; },
  async getOllamaModels(): Promise<string[]> { 
    if (await checkServerHealth()) return chatApi.getOllamaModels();
    return []; 
  },
  async addCustomCli(config: any) {
    if (await checkServerHealth()) return settingsApi.addCustomCli(config);
  },
  async removeCustomCli(id: string) {
    if (await checkServerHealth()) return settingsApi.removeCustomCli(id);
  },
  async getUsageStatistics(_project_id?: string): Promise<UsageStatistics> {
    if (await checkServerHealth()) return settingsApi.getUsageStatistics();
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
  async checkUpdate() { 
    if (await checkServerHealth()) {
      try {
        return await serverFetch<any>('/api/system/update/check');
      } catch (e) {
        console.error('Update check failed on server:', e);
      }
    }
    return { available: false, currentVersion: APP_VERSION, latestVersion: APP_VERSION, version: APP_VERSION }; 
  },
  async installUpdate() {
    if (await checkServerHealth()) {
      return await serverFetch<void>('/api/system/update/install', { method: 'POST' });
    }
    throw new Error('Update installation requires the Tauri runtime.');
  },
  async openBrowser(url: string) { window.open(url, '_blank'); },

  async ask(message: string, _options?: any): Promise<boolean> {
    if (await checkServerHealth()) {
      try {
        return await serverFetch<boolean>('/api/system/ask', {
          method: 'POST',
          body: JSON.stringify({ message })
        });
      } catch (e) { console.error('Server ask failed:', e); }
    }
    return window.confirm(message);
  },
  async message(message: string, _options?: any): Promise<void> {
    if (await checkServerHealth()) {
      try {
        return await serverFetch<void>('/api/system/message', {
          method: 'POST',
          body: JSON.stringify({ message })
        });
      } catch (e) { console.error('Server message failed:', e); }
    }
    window.alert(message);
  },
  async open(_options?: any): Promise<string | string[] | null> {
    if (await checkServerHealth()) {
      try {
        return await serverFetch<string | string[] | null>('/api/system/open', {
          method: 'POST',
          body: JSON.stringify(_options)
        });
      } catch (e) { console.error('Server open failed:', e); }
    }
    return null;
  },
  async save(_options?: any): Promise<string | null> {
    if (await checkServerHealth()) {
      try {
        return await serverFetch<string | null>('/api/system/save', {
          method: 'POST',
          body: JSON.stringify(_options)
        });
      } catch (e) { console.error('Server save failed:', e); }
    }
    return null;
  },
  async relaunch(): Promise<void> {
    if (await checkServerHealth()) {
      try {
         await serverFetch<void>('/api/system/relaunch', { method: 'POST' });
         return;
      } catch (e) { console.error('Server relaunch failed:', e); }
    }
    window.location.reload();
  },
  async exit(code: number = 0): Promise<void> {
    if (await checkServerHealth()) {
      try {
        await serverFetch<void>('/api/system/exit', { method: 'POST', body: JSON.stringify({ code }) });
        return;
      } catch (e) { console.error('Server exit failed:', e); }
    }
    window.close();
  },
  async getCurrentWindow(): Promise<{ close: () => Promise<void> } | null> {
    return { close: async () => this.exit(0) };
  },

  async shutdownApp() {
    // Clear frontend secrets
    lockVault();
    
    // Attempt to shut down companion server if it exists
    if (await checkServerHealth()) {
      try {
        await systemApi.shutdown();
      } catch (e) {
        console.warn("Failed to send shutdown signal to server", e);
      }
    }
    
    // Close browser window / tab
    window.close();
  },

  async getFormattedOwnerName(): Promise<string> {
    return 'Browser User';
  },
  async getRuntimeHealth(): Promise<{ ok: boolean; mode: 'browser'; transport: 'localStorage' }> {
    return { ok: true, mode: 'browser', transport: 'localStorage' };
  },

  async isFirstInstall(): Promise<boolean> {
    return !localStorage.getItem('productOS_runtime_initialized');
  },

  async checkInstallationStatus(): Promise<InstallationConfig> {
    return {
      app_data_path: '/browser-runtime/data',
      is_first_install: await this.isFirstInstall(),
      claude_code_detected: true,
      ollama_detected: true,
      gemini_detected: false,
      openai_detected: true,
    };
  },

  async getGlobalSettings(): Promise<GlobalSettings> {
    return getStore('mock_settings', defaultSettings());
  },

  async saveGlobalSettings(settings: GlobalSettings): Promise<void> {
    setStore('mock_settings', settings);
  },
  
  async getSettingsPaths(): Promise<{ globalSettingsPath: string; secretsPath: string }> {
    if (await checkServerHealth()) {
      const res = await serverFetch<{global_settings_path: string; secrets_path: string}>('/api/settings/paths');
      return {
        globalSettingsPath: res.global_settings_path,
        secretsPath: res.secrets_path
      };
    }
    return {
      globalSettingsPath: '/browser-runtime/settings.json',
      secretsPath: '/browser-runtime/secrets.encrypted.json'
    };
  },

  async exportSecrets(): Promise<any> {
    if (await checkServerHealth()) {
      return serverFetch<any>('/api/secrets/export');
    }
    return getStore('mock_secrets', {});
  },

  async getProjectSettings(projectId: string): Promise<ProjectSettings | null> {
    if (await checkServerHealth()) return serverFetch<ProjectSettings | null>(`/api/settings/project?project_id=${projectId}`);
    const settings = getProjectSettingsStore();
    return settings[projectId] || null;
  },

  async saveProjectSettings(projectId: string, settings: ProjectSettings): Promise<void> {
    if (await checkServerHealth()) return serverFetch<void>(`/api/settings/project?project_id=${projectId}`, { method: 'POST', body: JSON.stringify(settings) });
    const all = getProjectSettingsStore();
    all[projectId] = settings;
    setProjectSettingsStore(all);
  },

  async getAllProjects(): Promise<Project[]> {
    if (await checkServerHealth()) return projectsApi.getAllProjects();
    return getStore('mock_projects', [] as Project[]);
  },

  async createProject(name: string, goal: string, skills: string[]): Promise<Project> {
    if (await checkServerHealth()) return projectsApiExtended.createProject(name, goal, skills);
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
    if (await checkServerHealth()) return projectsApiExtended.renameProject(projectId, newName);
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
    if (await checkServerHealth()) return projectsApiExtended.deleteProject(projectId);
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
    if (await checkServerHealth()) return projectsApiExtended.getProject(projectId);
    const projects = getStore('mock_projects', [] as Project[]);
    return projects.find((project) => project.id === projectId) || null;
  },

  async getAllSkills(): Promise<Skill[]> {
    if (await checkServerHealth()) return skillsApi.getAllSkills();
    return getSkillsStore();
  },

  async getSkillsByCategory(category: string): Promise<Skill[]> {
    if (await checkServerHealth()) return skillsApi.getSkillsByCategory(category);
    const all = getSkillsStore();
    return all.filter(s => s.capabilities.includes(category.toLowerCase()));
  },

  async getSkill(skillId: string): Promise<Skill> {
    if (await checkServerHealth()) return skillsApi.getSkill(skillId);
    const skill = getSkillsStore().find((item) => item.id === skillId);
    if (!skill) {
      throw new Error(`Skill not found: ${skillId}`);
    }
    return skill;
  },

  async createSkill(name: string, description: string, template: string, category: string): Promise<Skill> {
    if (await checkServerHealth()) return skillsApi.createSkill(name, description, template, category ? [category] : []);
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
    if (await checkServerHealth()) return skillsApi.updateSkill(skill);
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
    if (await checkServerHealth()) return skillsApi.deleteSkill(skillId);
    setSkillsStore(getSkillsStore().filter((skill) => skill.id !== skillId));
  },

  async importSkill(_npxCommand: string): Promise<Skill> {
    if (await checkServerHealth()) return skillsApi.importSkill(_npxCommand);
    if (await checkServerHealth()) {
      return serverFetch<Skill>('/api/skills/import', {
        method: 'POST',
        body: JSON.stringify({ skillCommand: _npxCommand })
      });
    }
    throw new Error('Skill import requires the Tauri runtime.');
  },

  async getProjectFiles(projectId: string): Promise<string[]> {
    if (await checkServerHealth()) return filesApi.getProjectFiles(projectId);
    return Object.keys(ensureProjectFiles(projectId));
  },

  async checkFileExists(projectId: string, fileName: string): Promise<boolean> {
    if (await checkServerHealth()) return filesApi.checkFileExists(projectId, fileName);
    const files = ensureProjectFiles(projectId);
    return fileName in files;
  },

  async readMarkdownFile(projectId: string, fileName: string): Promise<string> {
    if (await checkServerHealth()) return filesApi.readFile(projectId, fileName);
    const files = ensureProjectFiles(projectId);
    return files[fileName] || '';
  },

  async writeMarkdownFile(projectId: string, fileName: string, content: string): Promise<void> {
    if (await checkServerHealth()) return filesApi.writeFile(projectId, fileName, content);
    const all = getProjectFilesStore();
    const files = ensureProjectFiles(projectId);
    files[fileName] = content;
    all[projectId] = files;
    setProjectFilesStore(all);
  },

  async renameFile(projectId: string, oldName: string, newName: string): Promise<void> {
    if (await checkServerHealth()) return filesApi.renameFile(projectId, oldName, newName);
    const all = getProjectFilesStore();
    const files = ensureProjectFiles(projectId);
    if (!(oldName in files)) return;
    files[newName] = files[oldName];
    delete files[oldName];
    all[projectId] = files;
    setProjectFilesStore(all);
  },

  async deleteMarkdownFile(projectId: string, fileName: string): Promise<void> {
    if (await checkServerHealth()) return filesApi.deleteFile(projectId, fileName);
    const all = getProjectFilesStore();
    const files = ensureProjectFiles(projectId);
    delete files[fileName];
    all[projectId] = files;
    setProjectFilesStore(all);
  },

  async getProjectWorkflows(projectId: string): Promise<Workflow[]> {
    if (await checkServerHealth()) return workflowsApi.getProjectWorkflows(projectId);
    return getWorkflowsStore().filter((workflow) => workflow.project_id === projectId);
  },

  async saveWorkflow(workflow: Workflow): Promise<void> {
    if (await checkServerHealth()) return workflowsApi.saveWorkflow(workflow);
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
    if (await checkServerHealth()) return workflowsApi.deleteWorkflow(projectId, workflowId);
    setWorkflowsStore(
      getWorkflowsStore().filter((workflow) => !(workflow.project_id === projectId && workflow.id === workflowId))
    );

    const history = getWorkflowHistoryStore();
    delete history[`${projectId}:${workflowId}`];
    setWorkflowHistoryStore(history);
  },

  async setWorkflowSchedule(projectId: string, workflowId: string, schedule: WorkflowSchedule): Promise<Workflow> {
    if (await checkServerHealth()) return workflowsApi.setWorkflowSchedule(projectId, workflowId, schedule);
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
    if (await checkServerHealth()) return workflowsApi.clearWorkflowSchedule(projectId, workflowId);
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
    if (await checkServerHealth()) return workflowsApi.getWorkflowHistory(projectId, workflowId);
    const history = getWorkflowHistoryStore();
    return history[`${projectId}:${workflowId}`] || [];
  },

  async executeWorkflow(_projectId: string, _workflowId: string, _parameters?: Record<string, string>): Promise<string> {
    if (await checkServerHealth()) return workflowsApi.executeWorkflow(_projectId, _workflowId, _parameters);
    throw new Error('Workflow execution requires the Tauri runtime.');
  },

  async importDocument(_projectId: string, _sourcePath: string): Promise<string> {
    if (await checkServerHealth()) return filesApi.importDocument(_projectId, _sourcePath);
    throw new Error('Native document import currently requires the Tauri runtime.');
  },

  async importTranscript(_projectId: string, _sourcePath: string): Promise<string> {
    throw new Error('Native document import currently requires the Tauri runtime.');
  },

  async exportDocument(_projectId: string, _fileName: string, _targetPath: string, _exportFormat: string): Promise<void> {
    throw new Error('Native document export currently requires the Tauri runtime.');
  },

  async importArtifact(_projectId: string, _artifactType: ArtifactType, _sourcePath: string): Promise<Artifact> {
    if (await checkServerHealth()) return artifactsApi.importArtifact(_projectId, _artifactType, _sourcePath);
    throw new Error('Artifact file import currently requires the Tauri runtime.');
  },

  async runInstallation(): Promise<InstallationResult> {
    return { 
      success: true, 
      config: await this.checkInstallationStatus() 
    };
  },

  async searchInFiles(projectId: string, searchText: string, caseSensitive: boolean, useRegex: boolean): Promise<SearchMatch[]> {
    if (await checkServerHealth()) return filesApi.searchInFiles(projectId, searchText, caseSensitive, useRegex);
    const files = ensureProjectFiles(projectId);
    return Object.entries(files).flatMap(([fileName, content]) =>
      searchMatchesInContent(fileName, content, searchText, caseSensitive, useRegex)
    );
  },

  async replaceInFiles(projectId: string, searchText: string, replaceText: string, caseSensitive: boolean, fileNames: string[]): Promise<number> {
    if (await checkServerHealth()) return filesApi.replaceInFiles(projectId, searchText, replaceText, caseSensitive);
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
    if (await checkServerHealth()) return artifactsApi.listArtifacts(projectId);
    const store = getArtifactsStore();
    return store[projectId] || [];
  },

  async createArtifact(projectId: string, artifactType: ArtifactType, title: string): Promise<Artifact> {
    if (await checkServerHealth()) return artifactsApi.createArtifact(projectId, artifactType, title);
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
    if (await checkServerHealth()) return artifactsApi.saveArtifact(artifact);
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

  async deleteArtifact(projectId: string, artifactId: string, _artifactType: ArtifactType): Promise<void> {
    if (await checkServerHealth()) return artifactsApi.deleteArtifact(projectId, _artifactType, artifactId);
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
    if (await checkServerHealth()) return mcpApi.getMcpServers();
    return getMcpServersStore();
  },

  async addMcpServer(config: any): Promise<void> {
    if (await checkServerHealth()) return mcpApi.addMcpServer(config);
    const servers = getMcpServersStore();
    setMcpServersStore([...servers, config]);
  },

  async removeMcpServer(id: string): Promise<void> {
    if (await checkServerHealth()) return mcpApi.removeMcpServer(id);
    setMcpServersStore(getMcpServersStore().filter((server: any) => server.id !== id));
  },

  async toggleMcpServer(id: string, enabled: boolean): Promise<void> {
    if (await checkServerHealth()) return mcpApi.toggleMcpServer(id, enabled);
    setMcpServersStore(
      getMcpServersStore().map((server: any) => server.id === id ? { ...server, enabled } : server)
    );
  },

  async updateMcpServer(config: any): Promise<void> {
    if (await checkServerHealth()) return mcpApi.updateMcpServer(config);
    const servers = getMcpServersStore();
    const index = servers.findIndex((server: any) => server.id === config.id);
    if (index >= 0) {
      servers[index] = { ...servers[index], ...config };
      setMcpServersStore(servers);
    }
  },

  async fetchMcpMarketplace(query?: string): Promise<any[]> {
    if (await checkServerHealth()) return mcpApi.getMarketplaceServers(query);
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

  async getAppVersion(): Promise<string> {
    return APP_VERSION;
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

  async getAppDataDirectory(): Promise<string> {
    if (await checkServerHealth()) return systemApi.getAppDataDirectory();
    return '/browser-runtime/data';
  },



  async getResearchLog(projectId: string): Promise<any[]> {
    if (await checkServerHealth()) return researchLogApi.getResearchLog(projectId);
    return getStore(`mock_research_log_${projectId}`, []);
  },

  async clearResearchLog(projectId: string): Promise<void> {
    if (await checkServerHealth()) return researchLogApi.clearResearchLog(projectId);
    setStore(`mock_research_log_${projectId}`, []);
  },

  async exportArtifact(_projectId: string, _artifactId: string, _artifactType: ArtifactType, _targetPath: string, _exportFormat: string): Promise<void> {
    throw new Error('Artifact export requires the Tauri runtime or a backend server.');
  },

  async loadChatHistory(projectId: string, _chatFile: string): Promise<ChatMessage[]> {
    return getStore(`mock_chat_history_${projectId}`, []);
  },

  async getChatFiles(_projectId: string): Promise<string[]> {
    return ['chat-session-1.json'];
  },

  async saveChat(projectId: string, messages: ChatMessage[], _model: string): Promise<string> {
    setStore(`mock_chat_history_${projectId}`, messages);
    return 'chat-session-1.json';
  },

  async saveSecrets(secrets: any): Promise<void> {
    if (await checkServerHealth()) {
      return serverFetch<void>('/api/secrets/set_multiple', {
        method: 'POST',
        body: JSON.stringify(secrets)
      });
    }
    // Mock save to vault
    if (isVaultUnlocked()) {
      if (secrets.claude_api_key) await saveSecretToVault('claude_api_key', secrets.claude_api_key);
      if (secrets.gemini_api_key) await saveSecretToVault('gemini_api_key', secrets.gemini_api_key);
    }
  },

  async getWorkflow(projectId: string, workflowId: string): Promise<Workflow | null> {
    const workflows = await this.getProjectWorkflows(projectId);
    return workflows.find(w => w.id === workflowId) || null;
  },

  async createWorkflow(projectId: string, name: string, description: string): Promise<Workflow> {
    const workflow: Workflow = {
      id: `wf-${Date.now()}`,
      project_id: projectId,
      name,
      description,
      steps: [],
      version: '1.0.0',
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      notify_on_completion: false,
    };
    const workflows = getWorkflowsStore();
    workflows.push(workflow);
    setWorkflowsStore(workflows);
    return workflow;
  },

  async validateWorkflow(_workflow: Workflow): Promise<boolean> {
    return true;
  },

  async get_active_runs(): Promise<Record<string, any>> {
    return {};
  },

  async verifyDirectoryStructure(): Promise<boolean> {
    return true;
  },

  async redetectDependencies(): Promise<InstallationConfig> {
    return this.checkInstallationStatus();
  },

  async backupInstallation(): Promise<string> {
    return 'backup-mock-path';
  },

  async cleanupOldBackups(_keepCount: number): Promise<string> {
    return 'Done';
  },

  async runUpdateProcess(): Promise<any> {
    return { ok: true };
  },

  async checkAndPreserveStructure(): Promise<any> {
    return { ok: true };
  },

  async backupUserData(): Promise<string> {
    return 'backup-user-mock-path';
  },

  async verifyInstallationIntegrity(): Promise<boolean> {
    return true;
  },

  async restoreFromBackup(_backupPath: string): Promise<void> {
    return;
  },

  async listBackups(): Promise<string[]> {
    return [];
  },


  async saveAppConfig(config: AppConfig): Promise<void> {
    setStore('mock_app_config', config);
  },

  async configExists(): Promise<boolean> {
    return !!localStorage.getItem('mock_app_config');
  },

  async updateClaudeCodeConfig(enabled: boolean, _path?: string): Promise<AppConfig> {
    const config = await this.getAppConfig();
    config.claude_code_enabled = enabled;
    await this.saveAppConfig(config);
    return config;
  },

  async updateOllamaConfig(enabled: boolean, _path?: string): Promise<AppConfig> {
    const config = await this.getAppConfig();
    config.ollama_enabled = enabled;
    await this.saveAppConfig(config);
    return config;
  },

  async resetConfig(): Promise<void> {
    setStore('mock_app_config', defaultAppConfig());
  },

  async getSystemUsername(): Promise<string> {
    return 'browser-user';
  },

  async getArtifact(projectId: string, artifactType: ArtifactType, artifactId: string): Promise<Artifact | null> {
    const artifacts = await this.listArtifacts(projectId);
    return artifacts.find(a => a.id === artifactId && a.artifactType === artifactType) || null;
  },

  async updateArtifactMetadata(projectId: string, artifactType: ArtifactType, artifactId: string, title?: string, confidence?: number): Promise<void> {
    const store = getArtifactsStore();
    const artifacts = store[projectId] || [];
    const index = artifacts.findIndex(a => a.id === artifactId && a.artifactType === artifactType);
    if (index >= 0) {
      if (title) artifacts[index].title = title;
      if (confidence !== undefined) artifacts[index].confidence = confidence;
      artifacts[index].updated = new Date().toISOString();
      store[projectId] = artifacts;
      setArtifactsStore(store);
    }
  },

  async getProjectCost(projectId: string): Promise<number> {
    if (await checkServerHealth()) return projectsApiExtended.getProjectCost(projectId);
    return 0;
  },

  async onTraceLog(_callback: (msg: string) => void): Promise<() => void> {
    return () => {};
  },

  async stopWorkflowExecution(_projectId: string, _workflowId: string): Promise<void> {
    return;
  },

  async listAvailableProviders(): Promise<ProviderType[]> {
    if (await checkServerHealth()) return settingsApi.listAvailableProviders();
    return ['ollama', 'openAiCli', 'geminiCli', 'claudeCode'];
  },

  async stopAgentExecution(): Promise<void> {
    return;
  },

  async sendMessage(_messages: ChatMessage[], _projectId?: string, _skillId?: string, _skillParams?: Record<string, string>): Promise<ChatResponse> {
    if (await checkServerHealth()) return chatApi.sendMessage(_messages, _projectId, _skillId);
    const last = _messages[_messages.length - 1]?.content || '';
    return { content: `[Browser runtime] ${last}` };
  },

  async getCompletion(messages: ChatMessage[], _projectId?: string): Promise<ChatResponse> {
    if (await checkServerHealth()) return chatApi.getCompletion(messages, _projectId);
    const prompt = messages[messages.length - 1]?.content?.replace(/\s+/g, ' ').trim() || '';
    if (!prompt) {
      return { content: '' };
    }

    const words = prompt.split(' ').filter(Boolean);
    const suggestion = words.slice(-12).join(' ');
    return { content: suggestion ? `${suggestion}...` : '' };
  },

  // --- Event listener stubs (browser runtime no-ops) ---
  // In browser mode they return no-op unsubscribe functions.

  async onWorkflowProgress(_callback: (progress: any) => void): Promise<() => void> {
    return () => {};
  },

  async onProjectAdded(_callback: (project: any) => void): Promise<() => void> {
    return () => {};
  },

  async onProjectModified(_callback: (projectId: string) => void): Promise<() => void> {
    return () => {};
  },

  async migrateArtifacts(_projectId: string): Promise<number> {
    return 0;
  },
};

