import fs from 'fs';
import path from 'path';
import { getGlobalSettingsPath, getProjectsDir } from './paths.js';

/**
 * Default global settings — mirrors Rust GlobalSettings::default().
 */
export function defaultGlobalSettings() {
  return {
    theme: 'system',
    defaultModel: 'gemini-2.0-flash',
    notificationsEnabled: true,
    projectsPath: null,
    activeProvider: 'geminiCli',
    ollama: { model: 'llama3', apiUrl: 'http://localhost:11434', detectedPath: null },
    claude: { model: 'claude-3-5-sonnet-20241022', detectedPath: null },
    hosted: { provider: 'anthropic', model: 'claude-3-5-sonnet-20241022', apiKeySecretId: 'ANTHROPIC_API_KEY' },
    geminiCli: { command: 'gemini', modelAlias: 'auto', apiKeySecretId: 'GEMINI_API_KEY', apiKeyEnvVar: null, detectedPath: null },
    openAiCli: { command: 'codex', modelAlias: 'auto', apiKeySecretId: 'OPENAI_API_KEY', apiKeyEnvVar: null, detectedPath: null },
    liteLlm: {
      enabled: false,
      baseUrl: 'http://localhost:4000',
      apiKeySecretId: 'LITELLM_API_KEY',
      strategy: { defaultModel: 'gpt-4.1-mini', researchModel: 'claude-sonnet-4-20250514', codingModel: 'claude-sonnet-4-20250514', editingModel: 'gemini-2.5-flash' },
      shadowMode: true
    },
    customClis: [],
    mcpServers: [],
    artifactTemplates: {},
    costBudget: null,
    autoEscalateThreshold: 0.6,
    budgetWarningThreshold: 0.8,
    selectedProviders: [],
    enableAiAutocomplete: false,
    lastProjectId: null,
    channelConfig: null
  };
}

/**
 * Load global settings from settings.json.
 */
export function loadGlobalSettings() {
  const settingsPath = getGlobalSettingsPath();
  if (!fs.existsSync(settingsPath)) return defaultGlobalSettings();

  try {
    const content = fs.readFileSync(settingsPath, 'utf-8');
    if (!content.trim()) return defaultGlobalSettings();
    return { ...defaultGlobalSettings(), ...JSON.parse(content) };
  } catch (e) {
    console.error('[settings] Failed to parse global settings:', e.message);
    return defaultGlobalSettings();
  }
}

/**
 * Save global settings to settings.json.
 */
export function saveGlobalSettings(settings) {
  const settingsPath = getGlobalSettingsPath();
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
}

/**
 * Load project-specific settings from .metadata/settings.json.
 */
export function loadProjectSettings(projectPath) {
  const settingsPath = path.join(projectPath, '.metadata', 'settings.json');
  if (!fs.existsSync(settingsPath)) return null;

  try {
    const content = fs.readFileSync(settingsPath, 'utf-8');
    if (!content.trim()) return null;
    return JSON.parse(content);
  } catch (e) {
    console.error('[settings] Failed to parse project settings:', e.message);
    return null;
  }
}

/**
 * Save project-specific settings to .metadata/settings.json.
 */
export function saveProjectSettings(projectPath, settings) {
  const settingsDir = path.join(projectPath, '.metadata');
  const settingsPath = path.join(settingsDir, 'settings.json');
  fs.mkdirSync(settingsDir, { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
}

/**
 * Get the projects directory path.
 */
export function getProjectsPath() {
  return getProjectsDir();
}
