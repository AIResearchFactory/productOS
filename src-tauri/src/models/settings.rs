use crate::models::ai::{
    ClaudeConfig, GeminiCliConfig, HostedConfig, LiteLlmConfig, OllamaConfig, OpenAiCliConfig, ProviderType,
    RoutingStrategy,
};
use crate::models::cost::CostBudget;
use crate::models::mcp::McpServerConfig;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum SettingsError {
    #[error("Failed to read settings file: {0}")]
    ReadError(#[from] std::io::Error),

    #[error("Failed to parse settings: {0}")]
    ParseError(String),

    #[error("Failed to write settings: {0}")]
    WriteError(String),
}

/// App-wide global settings
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GlobalSettings {
    #[serde(default = "default_theme")]
    pub theme: String,

    #[serde(default = "default_model", alias = "default_model")]
    pub default_model: String,

    #[serde(default = "default_notifications", alias = "notifications_enabled")]
    pub notifications_enabled: bool,

    #[serde(default, alias = "projects_path")]
    pub projects_path: Option<PathBuf>,

    #[serde(default = "default_active_provider", alias = "active_provider")]
    pub active_provider: ProviderType,

    #[serde(default = "default_ollama_config")]
    pub ollama: OllamaConfig,

    #[serde(default = "default_claude_config")]
    pub claude: ClaudeConfig,

    #[serde(default = "default_hosted_config")]
    pub hosted: HostedConfig,

    #[serde(default = "default_gemini_cli_config", alias = "gemini_cli")]
    pub gemini_cli: GeminiCliConfig,

    #[serde(default = "default_openai_cli_config", alias = "openai_cli")]
    pub openai_cli: OpenAiCliConfig,

    #[serde(default = "default_litellm_config")]
    pub litellm: LiteLlmConfig,

    #[serde(default)]
    pub custom_clis: Vec<crate::models::ai::CustomCliConfig>,

    #[serde(default)]
    pub mcp_servers: Vec<McpServerConfig>,

    #[serde(default)]
    pub artifact_templates: HashMap<String, String>,

    #[serde(default)]
    pub cost_budget: Option<CostBudget>,

    #[serde(default = "default_auto_escalate_threshold")]
    pub auto_escalate_threshold: f64,

    #[serde(default = "default_budget_warning_threshold")]
    pub budget_warning_threshold: f64,
}

fn default_theme() -> String {
    "system".to_string()
}

fn default_model() -> String {
    "gemini-2.0-flash".to_string()
}

fn default_notifications() -> bool {
    true
}

fn default_active_provider() -> ProviderType {
    ProviderType::GeminiCli
}

fn default_ollama_config() -> OllamaConfig {
    OllamaConfig {
        model: "llama3".to_string(),
        api_url: "http://localhost:11434".to_string(),
        detected_path: None,
    }
}

fn default_claude_config() -> ClaudeConfig {
    ClaudeConfig {
        model: "claude-3-5-sonnet-20241022".to_string(),
        detected_path: None,
    }
}

fn default_hosted_config() -> HostedConfig {
    HostedConfig {
        provider: "anthropic".to_string(),
        model: "claude-3-5-sonnet-20241022".to_string(),
        api_key_secret_id: "ANTHROPIC_API_KEY".to_string(),
    }
}

fn default_gemini_cli_config() -> GeminiCliConfig {
    GeminiCliConfig {
        command: "gemini".to_string(),
        model_alias: "auto-gemini-2.5".to_string(),
        api_key_secret_id: "GEMINI_API_KEY".to_string(),
        api_key_env_var: None,
        detected_path: None,
    }
}

fn default_openai_cli_config() -> OpenAiCliConfig {
    OpenAiCliConfig {
        command: "codex".to_string(),
        model_alias: "gpt-5.3-codex".to_string(),
        api_key_secret_id: "OPENAI_API_KEY".to_string(),
        api_key_env_var: None,
        detected_path: None,
    }
}

fn default_litellm_config() -> LiteLlmConfig {
    LiteLlmConfig {
        enabled: false,
        base_url: "http://localhost:4000".to_string(),
        api_key_secret_id: "LITELLM_API_KEY".to_string(),
        strategy: RoutingStrategy {
            default_model: "gpt-4.1-mini".to_string(),
            research_model: "claude-sonnet-4-20250514".to_string(),
            coding_model: "claude-sonnet-4-20250514".to_string(),
            editing_model: "gemini-2.5-flash".to_string(),
        },
        shadow_mode: true,
    }
}

fn default_auto_escalate_threshold() -> f64 {
    0.6
}

fn default_budget_warning_threshold() -> f64 {
    0.8
}

impl Default for GlobalSettings {
    fn default() -> Self {
        Self {
            theme: default_theme(),
            default_model: default_model(),
            notifications_enabled: default_notifications(),
            projects_path: None,
            active_provider: default_active_provider(),
            ollama: default_ollama_config(),
            claude: default_claude_config(),
            hosted: default_hosted_config(),
            gemini_cli: default_gemini_cli_config(),
            openai_cli: default_openai_cli_config(),
            litellm: default_litellm_config(),
            custom_clis: Vec::new(),
            mcp_servers: Vec::new(),
            artifact_templates: HashMap::new(),
            cost_budget: None,
            auto_escalate_threshold: default_auto_escalate_threshold(),
            budget_warning_threshold: default_budget_warning_threshold(),
        }
    }
}

impl GlobalSettings {
    /// Load global settings from a file
    pub fn load<P: AsRef<Path>>(path: P) -> Result<Self, SettingsError> {
        let path = path.as_ref();

        if !path.exists() {
            return Ok(Self::default());
        }

        let content = fs::read_to_string(path)?;

        serde_json::from_str(&content)
            .map_err(|e| SettingsError::ParseError(format!("Failed to parse JSON settings: {}", e)))
    }

    /// Save global settings to a file
    pub fn save<P: AsRef<Path>>(&self, path: P) -> Result<(), SettingsError> {
        let content = serde_json::to_string_pretty(self).map_err(|e| {
            SettingsError::WriteError(format!("Failed to serialize settings: {}", e))
        })?;

        fs::write(path, content)
            .map_err(|e| SettingsError::WriteError(format!("Failed to write settings: {}", e)))?;

        Ok(())
    }
}

/// Project-specific settings
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectSettings {
    #[serde(default)]
    pub name: Option<String>,

    #[serde(default)]
    pub goal: Option<String>,

    #[serde(default)]
    pub custom_prompt: Option<String>,

    #[serde(default)]
    pub preferred_skills: Vec<String>,

    #[serde(default)]
    pub auto_save: Option<bool>,

    #[serde(default)]
    pub encryption_enabled: Option<bool>,

    #[serde(default)]
    pub personalization_rules: Option<String>,

    #[serde(default)]
    pub brand_settings: Option<String>,
}

impl Default for ProjectSettings {
    fn default() -> Self {
        Self {
            name: None,
            goal: None,
            custom_prompt: None,
            preferred_skills: Vec::new(),
            auto_save: Some(true),
            encryption_enabled: Some(true),
            personalization_rules: None,
            brand_settings: None,
        }
    }
}

impl ProjectSettings {
    /// Load project settings from a file
    pub fn load<P: AsRef<Path>>(path: P) -> Result<Self, SettingsError> {
        let path = path.as_ref();

        if !path.exists() {
            return Ok(Self::default());
        }

        let content = fs::read_to_string(path)?;
        serde_json::from_str(&content).map_err(|e| {
            SettingsError::ParseError(format!("Failed to parse project JSON settings: {}", e))
        })
    }

    /// Save project settings to a file
    pub fn save<P: AsRef<Path>>(&self, path: P) -> Result<(), SettingsError> {
        let content = serde_json::to_string_pretty(self).map_err(|e| {
            SettingsError::WriteError(format!("Failed to serialize project settings: {}", e))
        })?;

        fs::write(path, content).map_err(|e| {
            SettingsError::WriteError(format!("Failed to write project settings: {}", e))
        })?;

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_global_settings() {
        let settings = GlobalSettings::default();
        assert_eq!(settings.theme, "system");
        assert_eq!(settings.default_model, "gemini-2.0-flash");

        // Onboarding defaults for OpenAI CLI provider should be Codex-first
        assert_eq!(settings.openai_cli.command, "codex");
        assert_eq!(settings.openai_cli.model_alias, "gpt-5.3-codex");
    }
}
