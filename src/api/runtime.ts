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

import { SERVER_URL, checkServerHealth, serverFetch, systemApi, secretsApi, settingsApi, chatApi, authApi, projectsApi, projectsApiExtended, filesApi, artifactsApi, workflowsApi, skillsApi, mcpApi, researchLogApi } from './server';
import { saveSecretToVault, getSecretFromVault, isVaultUnlocked, listVaultSecrets, lockVault } from '../lib/vault';

export const runtimeApi = {

  async detectClaudeCode(): Promise<ClaudeCodeInfo> {
    return (await systemApi.detectClaude()) || { installed: false, version: undefined, path: undefined, in_path: false, authenticated: false };
  },
  async detectOllama(): Promise<OllamaInfo> {
    return (await systemApi.detectOllama()) || { installed: false, version: undefined, running: false, in_path: false, path: undefined };
  },
  async detectGemini(): Promise<GeminiInfo> {
    return (await systemApi.detectGemini()) || { installed: false, version: undefined, path: undefined, in_path: false, authenticated: false };
  },
  async detectOpenAiCli(): Promise<OpenAiCliInfo> {
    return (await systemApi.detectOpenAi()) || { installed: false, version: undefined, path: undefined, in_path: false };
  },
  async clearAllCliDetectionCaches() {
    return systemApi.clearAllCaches();
  },
  async saveSecret(id: string, value: string) {
    return secretsApi.setSecret(id, value);
  },
  async hasSecret(id: string) {
    return (await secretsApi.hasSecret(id)).has_secret;
  },
  async listSavedSecretIds() {
    return secretsApi.listSecrets();
  },
  async hasClaudeApiKey() {
    return this.hasSecret('claude_api_key');
  },
  async hasGeminiApiKey() {
    return this.hasSecret('gemini_api_key');
  },
  async getOpenAIAuthStatus(): Promise<OpenAiAuthStatus> {
    return authApi.getOpenAIAuthStatus();
  },
  async getGoogleAuthStatus(): Promise<GoogleAuthStatus> {
    return authApi.getGoogleAuthStatus();
  },
  async authenticateOpenAI() { 
    return authApi.authenticateOpenAI();
  },
  async authenticateGemini() { 
    return authApi.authenticateGemini();
  },
  async logoutOpenAI() { 
    return authApi.logoutOpenAI();
  },
  async logoutGoogle() { 
    return authApi.logoutGoogle();
  },
  
  async loadChannelSettings(): Promise<any> { 
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
    return chatApi.getOllamaModels();
    return []; 
  },
  async addCustomCli(config: any) {
    return settingsApi.addCustomCli(config);
  },
  async removeCustomCli(id: string) {
    return settingsApi.removeCustomCli(id);
  },
  async getUsageStatistics(_project_id?: string): Promise<UsageStatistics> {
    return settingsApi.getUsageStatistics();
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
      try {
        return await serverFetch<any>('/api/system/update/check');
      } catch (e) {
        console.error('Update check failed on server:', e);
      }
    }
    return { available: false, currentVersion: APP_VERSION, latestVersion: APP_VERSION, version: APP_VERSION }; 
  },
  async installUpdate() {
      return await serverFetch<void>('/api/system/update/install', { method: 'POST' });
    }
    throw new Error('Update installation requires the Tauri runtime.');
  },
  async openBrowser(url: string) { window.open(url, '_blank'); },

  async ask(message: string, _options?: any): Promise<boolean> {
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
      try {
         await serverFetch<void>('/api/system/relaunch', { method: 'POST' });
         return;
      } catch (e) { console.error('Server relaunch failed:', e); }
    }
    window.location.reload();
  },
  async exit(code: number = 0): Promise<void> {
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
    
    try {
      await systemApi.shutdown();
    } catch (e) {
      console.warn("Failed to send shutdown signal to server", e);
    }
    
    // Close browser window / tab
    window.close();
  },

  async getFormattedOwnerName(): Promise<string> {
    return 'User';
  },
  async getRuntimeHealth(): Promise<{ ok: boolean; mode: 'server'; transport: 'http' }> {
    return { ok: true, mode: 'server', transport: 'http' };
  },

  async isFirstInstall(): Promise<boolean> {
    return serverFetch<boolean>('/api/system/first-install');
  },

  async checkInstallationStatus(): Promise<InstallationConfig> {
    // This should ideally be a server call too
    return serverFetch<InstallationConfig>('/api/installation/status');
  },

  async getGlobalSettings(): Promise<GlobalSettings> {
    return settingsApi.getGlobalSettings();
  },

  async saveGlobalSettings(settings: GlobalSettings): Promise<void> {
    await settingsApi.saveGlobalSettings(settings);
    // Notify other components (e.g. ChatPanel) that settings have changed
    window.dispatchEvent(new CustomEvent('productos:settings-changed', { detail: settings }));
  },
  
  async getSettingsPaths(): Promise<{ globalSettingsPath: string; secretsPath: string }> {
      const res = await serverFetch<{global_settings_path: string; secrets_path: string}>('/api/settings/paths');
      return {
        globalSettingsPath: res.global_settings_path,
        secretsPath: res.secrets_path
      };
    },

  async exportSecrets(): Promise<any> {
      return serverFetch<any>('/api/secrets/export');
    },

  async getProjectSettings(projectId: string): Promise<ProjectSettings | null> {
    return serverFetch<ProjectSettings | null>(`/api/settings/project?project_id=${projectId}`);
  },

  async saveProjectSettings(projectId: string, settings: ProjectSettings): Promise<void> {
    return serverFetch<void>(`/api/settings/project?project_id=${projectId}`, { method: 'POST', body: JSON.stringify(settings) });
  },

  async getAllProjects(): Promise<Project[]> {
    return projectsApi.getAllProjects();
  },

  async createProject(name: string, goal: string, skills: string[]): Promise<Project> {
    return projectsApiExtended.createProject(name, goal, skills);
  },

  async renameProject(projectId: string, newName: string): Promise<void> {
    return projectsApiExtended.renameProject(projectId, newName);
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
    return projectsApiExtended.deleteProject(projectId);
    const projects = getStore('mock_projects', [] as Project[]);
    setStore('mock_projects', projects.filter((project) => project.id !== projectId));

    const projectSettings = getProjectSettingsStore();
    delete projectSettings[projectId];
  },

  async getProject(projectId: string): Promise<Project | null> {
    return projectsApiExtended.getProject(projectId);
  },

  async getAllSkills(): Promise<Skill[]> {
    return skillsApi.getAllSkills();
  },

  async getSkillsByCategory(category: string): Promise<Skill[]> {
    return skillsApi.getSkillsByCategory(category);
  },

  async getSkill(skillId: string): Promise<Skill> {
    return skillsApi.getSkill(skillId);
  },

  async createSkill(name: string, description: string, template: string, category: string): Promise<Skill> {
    return skillsApi.createSkill(name, description, template, category ? [category] : []);
  },

  async updateSkill(skill: Skill): Promise<void> {
    return skillsApi.updateSkill(skill);
  },

  async deleteSkill(skillId: string): Promise<void> {
    return skillsApi.deleteSkill(skillId);
  },

  async importSkill(npxCommand: string): Promise<Skill> {
    return skillsApi.importSkill(npxCommand);
  },

  async getProjectFiles(projectId: string): Promise<string[]> {
    return filesApi.getProjectFiles(projectId);
  },

  async checkFileExists(projectId: string, fileName: string): Promise<boolean> {
    return filesApi.checkFileExists(projectId, fileName);
    const files = ensureProjectFiles(projectId);
    return fileName in files;
  },

  async readMarkdownFile(projectId: string, fileName: string): Promise<string> {
    return filesApi.readFile(projectId, fileName);
    const files = ensureProjectFiles(projectId);
    return files[fileName] || '';
  },

  async writeMarkdownFile(projectId: string, fileName: string, content: string): Promise<void> {
    return filesApi.writeFile(projectId, fileName, content);
    const all = getProjectFilesStore();
    const files = ensureProjectFiles(projectId);
    files[fileName] = content;
    all[projectId] = files;
    setProjectFilesStore(all);
  },

  async renameFile(projectId: string, oldName: string, newName: string): Promise<void> {
    return filesApi.renameFile(projectId, oldName, newName);
    const all = getProjectFilesStore();
    const files = ensureProjectFiles(projectId);
    if (!(oldName in files)) return;
    files[newName] = files[oldName];
    delete files[oldName];
    all[projectId] = files;
    setProjectFilesStore(all);
  },

  async deleteMarkdownFile(projectId: string, fileName: string): Promise<void> {
    return filesApi.deleteFile(projectId, fileName);
    const all = getProjectFilesStore();
    const files = ensureProjectFiles(projectId);
    delete files[fileName];
    all[projectId] = files;
    setProjectFilesStore(all);
  },

  async getProjectWorkflows(projectId: string): Promise<Workflow[]> {
    return workflowsApi.getProjectWorkflows(projectId);
  },

  async saveWorkflow(workflow: Workflow): Promise<void> {
    return workflowsApi.saveWorkflow(workflow);
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
    return workflowsApi.deleteWorkflow(projectId, workflowId);
    setWorkflowsStore(
      getWorkflowsStore().filter((workflow) => !(workflow.project_id === projectId && workflow.id === workflowId))
    );

  },

  async setWorkflowSchedule(projectId: string, workflowId: string, schedule: WorkflowSchedule): Promise<Workflow> {
    return workflowsApi.setWorkflowSchedule(projectId, workflowId, schedule);
  },

  async clearWorkflowSchedule(projectId: string, workflowId: string): Promise<Workflow> {
    return workflowsApi.clearWorkflowSchedule(projectId, workflowId);
  },

  async getWorkflowHistory(projectId: string, workflowId: string): Promise<WorkflowRunRecord[]> {
    return workflowsApi.getWorkflowHistory(projectId, workflowId);
  },

  async executeWorkflow(projectId: string, workflowId: string, parameters?: Record<string, string>): Promise<string> {
    return workflowsApi.executeWorkflow(projectId, workflowId, parameters);
  },

  async importDocument(projectId: string, sourcePath: string): Promise<string> {
    return filesApi.importDocument(projectId, sourcePath);
  },

  async importTranscript(projectId: string, sourcePath: string): Promise<string> {
     return filesApi.importTranscript(projectId, sourcePath);
  },

  async exportDocument(projectId: string, fileName: string, targetPath: string, exportFormat: string): Promise<void> {
    return filesApi.exportDocument(projectId, fileName, targetPath, exportFormat);
  },

  async importArtifact(projectId: string, artifactType: ArtifactType, sourcePath: string): Promise<Artifact> {
    return artifactsApi.importArtifact(projectId, artifactType, sourcePath);
  },

  async runInstallation(): Promise<InstallationResult> {
    return { 
      success: true, 
      config: await this.checkInstallationStatus() 
    };
  },

  async searchInFiles(projectId: string, searchText: string, caseSensitive: boolean, useRegex: boolean): Promise<SearchMatch[]> {
    return filesApi.searchInFiles(projectId, searchText, caseSensitive, useRegex);
  },

  async replaceInFiles(projectId: string, searchText: string, replaceText: string, caseSensitive: boolean, fileNames: string[]): Promise<number> {
    return filesApi.replaceInFiles(projectId, searchText, replaceText, caseSensitive);
  },

  async listArtifacts(projectId: string): Promise<Artifact[]> {
    return artifactsApi.listArtifacts(projectId);
  },

  async createArtifact(projectId: string, artifactType: ArtifactType, title: string): Promise<Artifact> {
    return artifactsApi.createArtifact(projectId, artifactType, title);
  },

  async saveArtifact(artifact: Artifact): Promise<void> {
    return artifactsApi.saveArtifact(artifact);
  },

  async deleteArtifact(projectId: string, artifactId: string, _artifactType: ArtifactType): Promise<void> {
    return artifactsApi.deleteArtifact(projectId, _artifactType, artifactId);
  },

  async listen<T>(event: string, handler: (event: { payload: T }) => void): Promise<() => void> {
    const eventSource = new EventSource(`${SERVER_URL}/api/system/events?event=${event}`);
    eventSource.onmessage = (ev) => {
      try {
        const payload = JSON.parse(ev.data);
        handler({ payload });
      } catch (e) {
        console.error('Failed to parse event payload:', e);
      }
    };
    return () => eventSource.close();
  },

  async emit(_event: string, _payload?: any): Promise<void> {
    // Currently emission from frontend to backend via events is not implemented
    // Backend emit events to frontend via SSE (listen).
  },

  async getMcpServers(): Promise<any[]> {
    return mcpApi.getMcpServers();
  },

  async addMcpServer(config: any): Promise<void> {
    return mcpApi.addMcpServer(config);
  },

  async removeMcpServer(id: string): Promise<void> {
    return mcpApi.removeMcpServer(id);
  },

  async toggleMcpServer(id: string, enabled: boolean): Promise<void> {
    return mcpApi.toggleMcpServer(id, enabled);
  },

  async updateMcpServer(config: any): Promise<void> {
    return mcpApi.updateMcpServer(config);
  },

  async fetchMcpMarketplace(query?: string): Promise<any[]> {
    return mcpApi.getMarketplaceServers(query);
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
    return serverFetch<AppConfig>('/api/system/config');
  },
  async updateLastCheck(): Promise<AppConfig> {
    return serverFetch<AppConfig>('/api/system/update/check', { method: 'POST' });
  },

  async switchProvider(providerType: GlobalSettings['activeProvider']): Promise<void> {
    const settings = await this.getGlobalSettings();
    settings.activeProvider = providerType;
    return this.saveGlobalSettings(settings);
  },

  async getAppDataDirectory(): Promise<string> {
    return systemApi.getAppDataDirectory();
  },



  async getResearchLog(projectId: string): Promise<any[]> {
    return researchLogApi.getResearchLog(projectId);
  },

  async clearResearchLog(projectId: string): Promise<void> {
    return researchLogApi.clearResearchLog(projectId);
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
      return serverFetch<void>('/api/secrets/set_multiple', {
        method: 'POST',
        body: JSON.stringify(secrets)
      });
  },

  async getWorkflow(projectId: string, workflowId: string): Promise<Workflow | null> {
    const workflows = await this.getProjectWorkflows(projectId);
    return workflows.find(w => w.id === workflowId) || null;
  },

  async createWorkflow(projectId: string, name: string, description: string): Promise<Workflow> {
    return workflowsApi.createWorkflow(projectId, name, description);
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
    return systemApi.backupInstallation();
  },

  async cleanupOldBackups(keepCount: number): Promise<string> {
    return systemApi.cleanupOldBackups(keepCount);
  },

  async runUpdateProcess(): Promise<any> {
    return systemApi.runUpdateProcess();
  },

  async checkAndPreserveStructure(): Promise<any> {
    return systemApi.checkAndPreserveStructure();
  },

  async backupUserData(): Promise<string> {
    return systemApi.backupUserData();
  },

  async verifyInstallationIntegrity(): Promise<boolean> {
    return systemApi.verifyInstallationIntegrity();
  },

  async restoreFromBackup(backupPath: string): Promise<void> {
    return systemApi.restoreFromBackup(backupPath);
  },

  async listBackups(): Promise<string[]> {
    return systemApi.listBackups();
  },


  async saveAppConfig(config: AppConfig): Promise<void> {
    return serverFetch<void>('/api/system/config', { method: 'POST', body: JSON.stringify(config) });
  },

  async configExists(): Promise<boolean> {
    return serverFetch<boolean>('/api/system/config/exists');
  },

  async updateClaudeCodeConfig(enabled: boolean, path?: string): Promise<AppConfig> {
    return serverFetch<AppConfig>('/api/system/config/claude', { method: 'POST', body: JSON.stringify({ enabled, path }) });
  },

  async updateOllamaConfig(enabled: boolean, path?: string): Promise<AppConfig> {
    return serverFetch<AppConfig>('/api/system/config/ollama', { method: 'POST', body: JSON.stringify({ enabled, path }) });
  },

  async resetConfig(): Promise<void> {
    return serverFetch<void>('/api/system/config/reset', { method: 'POST' });
  },

  async getSystemUsername(): Promise<string> {
    return 'browser-user';
  },

  async getArtifact(projectId: string, artifactType: ArtifactType, artifactId: string): Promise<Artifact | null> {
    return artifactsApi.getArtifact(projectId, artifactType, artifactId);
  },

  async updateArtifactMetadata(projectId: string, artifactType: ArtifactType, artifactId: string, title?: string, confidence?: number): Promise<void> {
    return artifactsApi.updateArtifactMetadata(projectId, artifactType, artifactId, title, confidence);
  },

  async getProjectCost(projectId: string): Promise<number> {
    return projectsApiExtended.getProjectCost(projectId);
  },

  async onTraceLog(callback: (msg: string) => void): Promise<() => void> {
    const eventSource = new EventSource(`${SERVER_URL}/api/system/trace-logs`);
    eventSource.onmessage = (event) => {
      callback(event.data);
    };
    eventSource.onerror = (err) => {
      console.error('[SSE ERROR] Trace logs stream failed:', err);
      eventSource.close();
    };
    return () => {
      eventSource.close();
    };
  },

  async stopWorkflowExecution(projectId: string, workflowId: string): Promise<void> {
    return workflowsApi.stopWorkflowExecution(projectId, workflowId);
  },

  async listAvailableProviders(): Promise<ProviderType[]> {
    return settingsApi.listAvailableProviders();
  },

  async stopAgentExecution(): Promise<void> {
    return chatApi.stopAgentExecution();
  },

  async sendMessage(messages: ChatMessage[], projectId?: string, skillId?: string, skillParams?: Record<string, string>): Promise<ChatResponse> {
    return chatApi.sendMessage(messages, projectId, skillId, skillParams);
  },

  async getCompletion(messages: ChatMessage[], projectId?: string): Promise<ChatResponse> {
    return chatApi.getCompletion(messages, projectId);
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

