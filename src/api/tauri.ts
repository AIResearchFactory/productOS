import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getVersion } from '@tauri-apps/api/app';
import { check } from '@tauri-apps/plugin-updater';

// Type definitions
export interface GlobalSettings {
  defaultModel: string;
  theme: string;
  notificationsEnabled: boolean;
  projectsPath?: string;
  activeProvider: ProviderType;
  ollama: OllamaConfig;
  claude: ClaudeConfig;
  hosted: HostedConfig;
  geminiCli: GeminiCliConfig;
  liteLlm: LiteLlmConfig;
  customClis: CustomCliConfig[];
  mcpServers: McpServerConfig[];
  costBudget?: CostBudget;
  autoEscalateThreshold: number;
  budgetWarningThreshold: number;
}

export type ProviderType = 'ollama' | 'claudeCode' | 'hostedApi' | 'geminiCli' | 'liteLlm' | string;

export interface OllamaConfig {
  model: string;
  apiUrl: string;
  detectedPath?: string;
}

export interface ClaudeConfig {
  model: string;
  detectedPath?: string;
}

export interface HostedConfig {
  provider: string;
  model: string;
  apiKeySecretId: string;
}

export interface GeminiCliConfig {
  command: string;
  modelAlias: string;
  apiKeySecretId: string;
  apiKeyEnvVar?: string;
  detectedPath?: string;
}

export interface LiteLlmRoutingStrategy {
  defaultModel: string;
  researchModel: string;
  codingModel: string;
  editingModel: string;
}

export interface LiteLlmConfig {
  enabled: boolean;
  baseUrl: string;
  apiKeySecretId: string;
  strategy: LiteLlmRoutingStrategy;
  shadowMode: boolean;
}

export interface CustomCliConfig {
  id: string;
  name: string;
  command: string;
  apiKeySecretId?: string;
  apiKeyEnvVar?: string;
  detectedPath?: string;
  isConfigured: boolean;
  settingsFilePath?: string;
  mcpConfigFlag?: string;
}

export interface McpServerConfig {
  id: string;
  name: string;
  description?: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  secretsEnv?: Record<string, string>;
  enabled: boolean;
  stars?: number;
  author?: string;
  source?: string;
  categories?: string[];
  iconUrl?: string;
}

export interface ChatResponse {
  content: string;
}

export interface Tool {
  name: string;
  description: string;
  input_schema: any;
}

export interface ProjectSettings {
  name: string;
  goal?: string;
  auto_save?: boolean;
  encryption_enabled?: boolean;
  preferred_skills?: string[];
}

export interface Project {
  id: string;
  name: string;
  goal: string;
  skills: string[];
  created_at: string;
}

export interface ChatMessage {
  role: string;
  content: string;
}

export interface Secrets {
  claude_api_key?: string;
  gemini_api_key?: string;
  custom_api_keys?: Record<string, string>;
}

export interface SkillParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array';
  description: string;
  required: boolean;
  default_value?: string;
}

export interface SkillExample {
  title: string;
  input: string;
  expected_output: string;
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  prompt_template: string;
  capabilities: string[];
  parameters: SkillParameter[];
  examples: SkillExample[];
  version: string;
  created: string;
  updated: string;
}

export interface Workflow {
  id: string;
  project_id: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
  version: string;
  created: string;
  updated: string;
  status?: string;
  last_run?: string;
}

export interface WorkflowStep {
  id: string;
  name: string;
  step_type: 'input' | 'agent' | 'iteration' | 'synthesis' | 'conditional' | 'skill' | 'api_call' | 'script' | 'condition';
  config: StepConfig;
  depends_on: string[];
}

export interface StepConfig {
  skill_id?: string;
  parameters?: any;
  timeout?: number;
  continue_on_error?: boolean;
  max_retries?: number;
  source_type?: string;
  source_value?: string;
  output_file?: string;
  input_files?: string[];
  items_source?: string;
  parallel?: boolean;
  output_pattern?: string;
  condition?: string;
  then_step?: string;
  else_step?: string;
}

export interface WorkflowExecution {
  workflow_id: string;
  started: string;
  completed?: string;
  status: 'Running' | 'Completed' | 'Failed' | 'PartialSuccess';
  step_results: Record<string, StepResult>;
}

export interface StepResult {
  step_id: string;
  status: 'Pending' | 'Running' | 'Completed' | 'Failed' | 'Skipped';
  started: string;
  completed?: string;
  output_files: string[];
  error?: string;
  logs: string[];
  next_step_id?: string;
}

export interface WorkflowProgress {
  workflow_id: string;
  step_name: string;
  status: string;
  progress_percent: number;
}

// Artifact types (PM ontology)
export type ArtifactType = 'insight' | 'evidence' | 'decision' | 'requirement' | 'metric_definition' | 'experiment' | 'poc_brief';

export interface Artifact {
  id: string;
  artifactType: ArtifactType;
  title: string;
  content: string;
  projectId: string;
  sourceRefs: string[];
  confidence?: number;
  created: string;
  updated: string;
  metadata: Record<string, any>;
  path: string;
}

export interface CostBudget {
  dailyLimitUsd?: number;
  monthlyLimitUsd?: number;
  currentDailyUsd: number;
  currentMonthlyUsd: number;
}

// Installation types
export interface InstallationConfig {
  app_data_path: string;
  is_first_install: boolean;
  claude_code_detected: boolean;
  ollama_detected: boolean;
  gemini_detected: boolean;
}

export interface ClaudeCodeInfo {
  installed: boolean;
  version?: string;
  path?: string;
  in_path: boolean;
}

export interface OllamaInfo {
  installed: boolean;
  version?: string;
  path?: string;
  running: boolean;
  in_path: boolean;
}

export interface GeminiInfo {
  installed: boolean;
  version?: string;
  path?: string;
  in_path: boolean;
  authenticated?: boolean;
}

export interface InstallationProgress {
  stage: 'initializing' | 'selecting_directory' | 'creating_structure' | 'detecting_dependencies' | 'installing_claude_code' | 'installing_ollama' | 'installing_gemini' | 'finalizing' | 'complete' | 'error';
  message: string;
  progress_percentage: number;
}

export interface InstallationResult {
  success: boolean;
  config: InstallationConfig;
  claude_code_info?: ClaudeCodeInfo;
  ollama_info?: OllamaInfo;
  gemini_info?: GeminiInfo;
  error_message?: string;
}

// Search types
export interface SearchMatch {
  file_name: string;
  line_number: number;
  line_content: string;
  match_start: number;
  match_end: number;
}

// Update types
export interface UpdateResult {
  success: boolean;
  backup_created: boolean;
  backup_path?: string;
  files_updated: string[];
  structure_verified: boolean;
  message: string;
}

// Configuration types
export interface AppConfig {
  app_data_directory: string;
  installation_date: string;
  version: string;
  claude_code_enabled: boolean;
  ollama_enabled: boolean;
  claude_code_path?: string;
  ollama_path?: string;
  last_update_check?: string;
}

export const tauriApi = {
  // Settings
  async getAppDataDirectory(): Promise<string> {
    return await invoke('get_app_data_directory');
  },

  async getGlobalSettings(): Promise<GlobalSettings> {
    return await invoke('get_global_settings');
  },

  async saveGlobalSettings(settings: GlobalSettings): Promise<void> {
    return await invoke('save_global_settings', { settings });
  },

  async getProjectSettings(projectId: string): Promise<ProjectSettings> {
    return await invoke('get_project_settings', { projectId });
  },

  async saveProjectSettings(projectId: string, settings: ProjectSettings): Promise<void> {
    return await invoke('save_project_settings', { projectId, settings });
  },

  // Projects
  async getAllProjects(): Promise<Project[]> {
    return await invoke('get_all_projects');
  },

  async getProject(projectId: string): Promise<Project> {
    return await invoke('get_project', { projectId });
  },

  async createProject(name: string, goal: string, skills: string[]): Promise<Project> {
    console.log("Starting createProject");
    return await invoke('create_project', { name, goal, skills });
  },

  async getProjectFiles(projectId: string): Promise<string[]> {
    return await invoke('get_project_files', { projectId });
  },

  async deleteProject(projectId: string): Promise<void> {
    return await invoke('delete_project', { projectId });
  },

  async renameProject(projectId: string, newName: string): Promise<void> {
    return await invoke('rename_project', { projectId, newName });
  },

  // Files
  async readMarkdownFile(projectId: string, fileName: string): Promise<string> {
    return await invoke('read_markdown_file', { projectId, fileName });
  },

  async writeMarkdownFile(projectId: string, fileName: string, content: string): Promise<void> {
    return await invoke('write_markdown_file', { projectId, fileName, content });
  },

  async deleteMarkdownFile(projectId: string, fileName: string): Promise<void> {
    return await invoke('delete_markdown_file', { projectId, fileName });
  },

  async searchInFiles(projectId: string, searchText: string, caseSensitive: boolean, useRegex: boolean): Promise<SearchMatch[]> {
    return await invoke('search_in_files', { projectId, searchText, caseSensitive, useRegex });
  },

  async replaceInFiles(projectId: string, searchText: string, replaceText: string, caseSensitive: boolean, fileNames: string[]): Promise<number> {
    return await invoke('replace_in_files', { projectId, searchText, replaceText, caseSensitive, fileNames });
  },

  // Chat
  async sendMessage(messages: ChatMessage[], projectId?: string, skillId?: string, skillParams?: Record<string, string>): Promise<ChatResponse> {
    return await invoke('send_message', { messages, projectId, skillId, skillParams });
  },

  async switchProvider(providerType: ProviderType): Promise<void> {
    return await invoke('switch_provider', { providerType });
  },

  async loadChatHistory(projectId: string, chatFile: string): Promise<ChatMessage[]> {
    return await invoke('load_chat_history', { projectId, chatFile });
  },

  async getChatFiles(projectId: string): Promise<string[]> {
    return await invoke('get_chat_files', { projectId });
  },

  async saveChat(projectId: string, messages: ChatMessage[], model: string): Promise<string> {
    return await invoke('save_chat', { projectId, messages, model });
  },

  async getOllamaModels(): Promise<string[]> {
    return await invoke('get_ollama_models');
  },

  // Secrets
  async getSecrets(): Promise<Secrets> {
    return await invoke('get_secrets');
  },

  async saveSecret(key: string, value: string): Promise<void> {
    // Construct a Secrets object with just the key we want to update
    // The backend merges this with existing secrets
    const secrets: any = {
      claude_api_key: null,
      gemini_api_key: null,
      n8n_webhook_url: null,
      custom_api_keys: {}
    };

    if (key === 'claude_api_key' || key === 'ANTHROPIC_API_KEY') {
      secrets.claude_api_key = value;
    } else if (key === 'gemini_api_key' || key === 'GEMINI_API_KEY') {
      secrets.gemini_api_key = value;
    } else if (key === 'n8n_webhook_url') {
      secrets.n8n_webhook_url = value;
    } else {
      // Treat as custom API key
      secrets.custom_api_keys = { [key]: value };
    }

    return await invoke('save_secrets', { secrets });
  },

  async saveSecrets(secrets: Secrets): Promise<void> {
    return await invoke('save_secrets', { secrets });
  },

  async hasClaudeApiKey(): Promise<boolean> {
    return await invoke('has_claude_api_key');
  },

  async hasGeminiApiKey(): Promise<boolean> {
    return await invoke('has_gemini_api_key');
  },

  // Event listeners
  async onProjectAdded(callback: (project: Project) => void): Promise<() => void> {
    return await listen('project-added', (event) => {
      callback(event.payload as Project);
    });
  },

  async onProjectModified(callback: (projectId: string) => void): Promise<() => void> {
    return await listen('project-modified', (event) => {
      callback(event.payload as string);
    });
  },

  async onProjectRemoved(callback: (projectId: string) => void): Promise<() => void> {
    return await listen('project-removed', (event) => {
      callback(event.payload as string);
    });
  },

  // Skills
  async getAllSkills(): Promise<Skill[]> {
    return await invoke('get_all_skills');
  },

  async getSkill(skillId: string): Promise<Skill> {
    return await invoke('get_skill', { skillId });
  },

  async createSkill(name: string, description: string, template: string, category: string): Promise<Skill> {
    return await invoke('create_skill', {
      name,
      description,
      promptTemplate: template,
      capabilities: [category]
    });
  },

  async updateSkill(skill: Skill): Promise<void> {
    return await invoke('update_skill', { skill });
  },

  async importSkill(npxCommand: string): Promise<Skill> {
    return await invoke('import_skill', { skillCommand: npxCommand });
  },

  async deleteSkill(skillId: string): Promise<void> {
    return await invoke('delete_skill', { skillId });
  },

  // Workflows
  async getProjectWorkflows(projectId: string): Promise<Workflow[]> {
    return await invoke('get_project_workflows', { projectId });
  },

  async getWorkflow(projectId: string, workflowId: string): Promise<Workflow> {
    return await invoke('get_workflow', { projectId, workflowId });
  },

  async createWorkflow(projectId: string, name: string, description: string): Promise<Workflow> {
    return await invoke('create_workflow', { projectId, name, description });
  },

  async saveWorkflow(workflow: Workflow): Promise<void> {
    return await invoke('save_workflow', { workflow });
  },

  async deleteWorkflow(projectId: string, workflowId: string): Promise<void> {
    return await invoke('delete_workflow', { projectId, workflowId });
  },

  async executeWorkflow(projectId: string, workflowId: string, parameters?: Record<string, string>): Promise<WorkflowExecution> {
    return await invoke('execute_workflow', { projectId, workflowId, parameters });
  },

  async validateWorkflow(workflow: Workflow): Promise<boolean> {
    return await invoke('validate_workflow', { workflow });
  },

  // Installation
  async checkInstallationStatus(): Promise<InstallationConfig> {
    return await invoke('check_installation_status');
  },

  async detectClaudeCode(): Promise<ClaudeCodeInfo | null> {
    return await invoke('detect_claude_code');
  },

  async detectOllama(): Promise<OllamaInfo | null> {
    return await invoke('detect_ollama');
  },

  async detectGemini(): Promise<GeminiInfo | null> {
    return await invoke('detect_gemini');
  },

  async detectAllCliTools(): Promise<[ClaudeCodeInfo | null, OllamaInfo | null, GeminiInfo | null]> {
    return await invoke('detect_all_cli_tools');
  },

  async clearCliDetectionCache(toolName: string): Promise<void> {
    return await invoke('clear_cli_detection_cache', { toolName });
  },

  async clearAllCliDetectionCaches(): Promise<void> {
    return await invoke('clear_all_cli_detection_caches');
  },

  async getClaudeCodeInstallInstructions(): Promise<string> {
    return await invoke('get_claude_code_install_instructions');
  },

  async getOllamaInstallInstructions(): Promise<string> {
    return await invoke('get_ollama_install_instructions');
  },

  async getGeminiInstallInstructions(): Promise<string> {
    return await invoke('get_gemini_install_instructions');
  },

  async runInstallation(onProgress?: (progress: InstallationProgress) => void): Promise<InstallationResult> {
    // Listen for installation progress events
    let unlisten: (() => void) | undefined;

    if (onProgress) {
      unlisten = await listen('installation-progress', (event) => {
        onProgress(event.payload as InstallationProgress);
      });
    }

    try {
      const result = await invoke('run_installation');
      return result as InstallationResult;
    } finally {
      if (unlisten) {
        unlisten();
      }
    }
  },

  async verifyDirectoryStructure(): Promise<boolean> {
    return await invoke('verify_directory_structure');
  },

  async redetectDependencies(): Promise<InstallationConfig> {
    return await invoke('redetect_dependencies');
  },

  async backupInstallation(): Promise<string> {
    return await invoke('backup_installation');
  },

  async cleanupOldBackups(keepCount: number): Promise<string> {
    return await invoke('cleanup_old_backups', { keepCount });
  },

  async isFirstInstall(): Promise<boolean> {
    return await invoke('is_first_install');
  },

  // Update operations
  async runUpdateProcess(): Promise<UpdateResult> {
    return await invoke('run_update_process');
  },

  async checkAndPreserveStructure(): Promise<UpdateResult> {
    return await invoke('check_and_preserve_structure');
  },

  async backupUserData(): Promise<string> {
    return await invoke('backup_user_data');
  },

  async verifyInstallationIntegrity(): Promise<boolean> {
    return await invoke('verify_installation_integrity');
  },

  async restoreFromBackup(backupPath: string): Promise<void> {
    return await invoke('restore_from_backup', { backupPath });
  },

  async listBackups(): Promise<string[]> {
    return await invoke('list_backups');
  },

  // Configuration operations
  async getAppConfig(): Promise<AppConfig | null> {
    return await invoke('get_app_config');
  },

  async saveAppConfig(config: AppConfig): Promise<void> {
    return await invoke('save_app_config', { config });
  },

  async configExists(): Promise<boolean> {
    return await invoke('config_exists');
  },

  async updateClaudeCodeConfig(enabled: boolean, path?: string): Promise<AppConfig> {
    return await invoke('update_claude_code_config', { enabled, path });
  },

  async updateOllamaConfig(enabled: boolean, path?: string): Promise<AppConfig> {
    return await invoke('update_ollama_config', { enabled, path });
  },

  async updateLastCheck(): Promise<AppConfig> {
    return await invoke('update_last_check');
  },

  async resetConfig(): Promise<void> {
    return await invoke('reset_config');
  },

  async authenticateGemini(): Promise<string> {
    return await invoke('authenticate_gemini');
  },

  async addCustomCli(config: CustomCliConfig): Promise<void> {
    return await invoke('add_custom_cli', { config });
  },

  async removeCustomCli(id: string): Promise<void> {
    return await invoke('remove_custom_cli', { id });
  },

  async listAvailableProviders(): Promise<ProviderType[]> {
    return await invoke('list_available_providers');
  },

  async getMcpServers(): Promise<McpServerConfig[]> {
    return await invoke('get_mcp_servers');
  },

  async getSystemUsername(): Promise<string> {
    return await invoke('get_system_username');
  },

  async getFormattedOwnerName(): Promise<string> {
    return await invoke('get_formatted_owner_name');
  },

  async addMcpServer(config: McpServerConfig): Promise<void> {
    return await invoke('add_mcp_server', { config });
  },

  async removeMcpServer(id: string): Promise<void> {
    return await invoke('remove_mcp_server', { id });
  },

  async toggleMcpServer(id: string, enabled: boolean): Promise<void> {
    return await invoke('toggle_mcp_server', { id, enabled });
  },

  async updateMcpServer(config: McpServerConfig): Promise<void> {
    return await invoke('update_mcp_server', { config });
  },

  async fetchMcpMarketplace(query?: string): Promise<McpServerConfig[]> {
    return await invoke('fetch_mcp_marketplace', { query });
  },

  async syncMcpWithClis(): Promise<string[]> {
    return await invoke('sync_mcp_with_clis');
  async testLitellmConnection(baseUrl: string, apiKeySecretId: string): Promise<string> {
    return await invoke('test_litellm_connection', { baseUrl, apiKeySecretId });
  },

  async onTraceLog(callback: (msg: string) => void): Promise<() => void> {
    return await listen('trace-log', (event) => {
      callback(event.payload as string);
    });
  },

  async onWorkflowProgress(callback: (progress: WorkflowProgress) => void): Promise<() => void> {
    return await listen('workflow-progress', (event) => {
      callback(event.payload as WorkflowProgress);
    });
  },

  // Version & Updater
  async getAppVersion(): Promise<string> {
    try {
      return await getVersion();
    } catch (e) {
      console.error('Failed to get app version:', e);
      return 'Unknown';
    }
  },

  async checkUpdate(): Promise<any> {
    return await check();
  },

  // Artifacts
  async createArtifact(projectId: string, artifactType: ArtifactType, title: string): Promise<Artifact> {
    return await invoke('create_artifact', { projectId, artifactType, title });
  },

  async getArtifact(projectId: string, artifactType: ArtifactType, artifactId: string): Promise<Artifact> {
    return await invoke('get_artifact', { projectId, artifactType, artifactId });
  },

  async listArtifacts(projectId: string, artifactType?: ArtifactType): Promise<Artifact[]> {
    return await invoke('list_artifacts', { projectId, artifactType });
  },

  async saveArtifact(artifact: Artifact): Promise<void> {
    return await invoke('save_artifact', { artifact });
  },

  async deleteArtifact(projectId: string, artifactType: ArtifactType, artifactId: string): Promise<void> {
    return await invoke('delete_artifact', { projectId, artifactType, artifactId });
  },
};
