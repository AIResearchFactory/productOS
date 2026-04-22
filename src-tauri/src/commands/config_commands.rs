use crate::config::{AppConfig, ConfigManager};
use anyhow::Result;

/// Get the current application configuration

pub async fn get_app_config() -> Result<Option<AppConfig>, String> {
    ConfigManager::load_config().map_err(|e| format!("Failed to load config: {}", e))
}

/// Save application configuration

pub async fn save_app_config(config: AppConfig) -> Result<(), String> {
    ConfigManager::save_config(&config).map_err(|e| format!("Failed to save config: {}", e))
}

/// Check if configuration exists

pub async fn config_exists() -> Result<bool, String> {
    ConfigManager::config_exists().map_err(|e| format!("Failed to check config: {}", e))
}

/// Update Claude Code settings

pub async fn update_claude_code_config(
    enabled: bool,
    path: Option<String>,
) -> Result<AppConfig, String> {
    ConfigManager::update_config(|config| {
        config.claude_code_enabled = enabled;
        config.claude_code_path = path.map(|p| p.into());
    })
    .map_err(|e| format!("Failed to update Claude Code config: {}", e))
}

/// Update Ollama settings

pub async fn update_ollama_config(
    enabled: bool,
    path: Option<String>,
) -> Result<AppConfig, String> {
    ConfigManager::update_config(|config| {
        config.ollama_enabled = enabled;
        config.ollama_path = path.map(|p| p.into());
    })
    .map_err(|e| format!("Failed to update Ollama config: {}", e))
}

/// Update last update check timestamp

pub async fn update_last_check() -> Result<AppConfig, String> {
    ConfigManager::update_config(|config| {
        config.last_update_check = Some(chrono::Utc::now());
    })
    .map_err(|e| format!("Failed to update last check timestamp: {}", e))
}

/// Reset configuration (delete config file)

pub async fn reset_config() -> Result<(), String> {
    ConfigManager::delete_config().map_err(|e| format!("Failed to reset config: {}", e))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_config_exists() {
        let result = config_exists().await;
        assert!(result.is_ok());
    }
}
