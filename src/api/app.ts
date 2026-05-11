import { runtimeApi } from './runtime';

export const isDesktop = () => false;

export const appApi = {
  ...runtimeApi,
  listen: runtimeApi.listen,
  emit: runtimeApi.emit,
};

// Export common types from here too if needed to reduce direct imports
export type {
  Project, Workflow, Skill, Artifact, ArtifactType,
  GlobalSettings, ProjectSettings,
  ChatMessage, ChatResponse,
  ClaudeCodeInfo, OllamaInfo, GeminiInfo, OpenAiCliInfo,
  ProviderType, WorkflowStep, WorkflowSchedule, WorkflowProgress,
  WorkflowExecution, WorkflowRunRecord, ExecutionStatus, StepResult,
  InstallationProgress, InstallationResult, ResearchLogEntry,
  LiteLlmConfig, CustomCliConfig, OpenAiAuthStatus, GoogleAuthStatus,
  UsageStatistics, McpServerConfig, StepConfig, AppConfig, SearchMatch,
  InstallationConfig, WhatsAppInfo,
} from './types';
