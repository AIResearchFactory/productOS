export type EventCallback<T> = (event: { payload: T }) => void;

export type ProviderType = 'ollama' | 'claudeCode' | 'hostedApi' | 'geminiCli' | 'openAiCli' | 'liteLlm' | 'autoRouter' | string;

export interface ChannelConfig {
  enabled: boolean;
  telegramEnabled: boolean;
  whatsappEnabled: boolean;
  defaultProjectRouting: string;
  telegramDefaultChatId: string;
  whatsappPhoneNumberId: string;
  whatsappDefaultRecipient: string;
  notes: string;
  hasTelegramToken: boolean;
  hasWhatsappToken: boolean;
}

export interface WhatsAppInfo {
  ok: boolean;
  displayPhoneNumber?: string;
  verifiedName?: string;
  id?: string;
}

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

export interface OpenAiCliConfig {
  command: string;
  modelAlias: string;
  apiKeySecretId: string;
  apiKeyEnvVar?: string;
  detectedPath?: string;
}

export interface OpenAiAuthStatus {
  connected: boolean;
  method: string;
  details: string;
}

export interface GoogleAuthStatus {
  connected: boolean;
  method: string;
  details: string;
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
  personalization_rules?: string;
  brand_settings?: string;
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
  open_ai_api_key?: string;
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

export interface WorkflowSchedule {
  enabled: boolean;
  cron: string;
  timezone?: string;
  next_run_at?: string;
  last_triggered_at?: string;
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
  schedule?: WorkflowSchedule;
  notify_on_completion: boolean;
}

export interface WorkflowStep {
  id: string;
  name: string;
  step_type: 'input' | 'agent' | 'iteration' | 'synthesis' | 'conditional' | 'skill' | 'api_call' | 'script' | 'condition' | 'subagent' | 'update-file';
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
  artifact_type?: ArtifactType;
  artifact_title?: string;
  context?: string;
}

export interface WorkflowExecution {
  workflow_id: string;
  started: string;
  completed?: string;
  status: 'Running' | 'Completed' | 'Failed' | 'PartialSuccess';
  error?: string;
  step_results: Record<string, StepResult>;
}

export interface StepResult {
  step_id: string;
  status: 'Pending' | 'Running' | 'Completed' | 'Failed' | 'Skipped';
  started: string;
  completed?: string;
  output_files: string[];
  error?: string;
  detailed_error?: string;
  logs: string[];
  next_step_id?: string;
}

export type ExecutionStatus = 'Running' | 'Completed' | 'Failed' | 'PartialSuccess';

export interface WorkflowRunRecord {
  id: string;
  workflow_id: string;
  workflow_name: string;
  project_id: string;
  started: string;
  completed?: string;
  status: ExecutionStatus;
  trigger: string;
  step_results: Record<string, StepResult>;
}

export interface WorkflowProgress {
  workflow_id: string;
  project_id: string;
  step_name: string;
  status: string;
  progress_percent: number;
}

export type ArtifactType = 'roadmap' | 'product_vision' | 'one_pager' | 'prd' | 'initiative' | 'competitive_research' | 'user_story' | 'insight' | 'presentation' | 'pr_faq';

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

export interface ProviderUsage {
  provider: string;
  promptCount: number;
  responseCount: number;
  totalCostUsd: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheReadTokens: number;
  totalCacheCreationTokens: number;
  totalReasoningTokens: number;
}

export interface UsageStatistics {
  totalPrompts: number;
  totalResponses: number;
  totalCostUsd: number;
  totalTimeSavedMinutes: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheReadTokens: number;
  totalCacheCreationTokens: number;
  totalReasoningTokens: number;
  totalToolCalls: number;
  providerBreakdown: ProviderUsage[];
}

export interface InstallationConfig {
  app_data_path: string;
  is_first_install: boolean;
  claude_code_detected: boolean;
  ollama_detected: boolean;
  gemini_detected: boolean;
  openai_detected: boolean;
}

export interface ClaudeCodeInfo {
  installed: boolean;
  version?: string;
  path?: string;
  in_path: boolean;
  authenticated?: boolean;
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

export interface OpenAiCliInfo {
  installed: boolean;
  version?: string;
  path?: string;
  in_path: boolean;
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

export interface SearchMatch {
  file_name: string;
  line_number: number;
  line_content: string;
  match_start: number;
  match_end: number;
}

export interface UpdateResult {
  success: boolean;
  backup_created: boolean;
  backup_path?: string;
  files_updated: string[];
  structure_verified: boolean;
  message: string;
}

export interface ResearchLogEntry {
  timestamp: string;
  provider: string;
  command?: string;
  content: string;
}

export interface AppConfig {
  app_data_directory: string;
  installation_date: string;
  version: string;
  claude_code_enabled: boolean;
  ollama_enabled: boolean;
  gemini_enabled: boolean;
  openai_enabled: boolean;
  claude_code_path?: string;
  ollama_path?: string;
  gemini_path?: string;
  openai_path?: string;
  last_update_check?: string;
}

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
  openAiCli: OpenAiCliConfig;
  liteLlm: LiteLlmConfig;
  customClis: CustomCliConfig[];
  mcpServers: McpServerConfig[];
  artifactTemplates?: Record<string, string>;
  costBudget?: CostBudget;
  autoEscalateThreshold: number;
  budgetWarningThreshold: number;
  selectedProviders: string[];
  enableAiAutocomplete?: boolean;
  lastProjectId?: string;
  channelConfig?: ChannelConfig;
}
