// import { tauriApi } from './tauri'; // Deprecated
import { runtimeApi } from './runtime';

export const isTauriRuntime = (): boolean => {
  return typeof window !== 'undefined' && !!(window as any).__TAURI_INTERNALS__;
};

export const appApi = runtimeApi;

// Export common types from here too if needed to reduce direct tauri.ts imports
export type { 
  Project, Workflow, Skill, Artifact, ArtifactType, 
  GlobalSettings, ProjectSettings, 
  ChatMessage, ChatResponse,
  ClaudeCodeInfo, OllamaInfo, GeminiInfo, OpenAiCliInfo,
  ProviderType, WorkflowStep, WorkflowSchedule, WorkflowProgress,
  WorkflowExecution, WorkflowRunRecord, ExecutionStatus, StepResult,
  InstallationProgress,
} from './tauri';
