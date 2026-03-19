use anyhow::{Context, Result};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

use crate::utils::paths::get_app_data_dir;

/// Application configuration that persists installation state and settings
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    /// Path to the application data directory
    pub app_data_directory: PathBuf,

    /// Installation timestamp
    pub installation_date: DateTime<Utc>,

    /// Current application version
    pub version: String,

    /// Whether Claude Code integration is enabled
    pub claude_code_enabled: bool,

    /// Whether Ollama integration is enabled
    pub ollama_enabled: bool,

    /// Whether Gemini CLI integration is enabled
    pub gemini_enabled: bool,

    /// Whether OpenAI/Codex CLI integration is enabled
    #[serde(default)]
    pub openai_enabled: bool,

    /// Claude Code installation path (if detected)
    pub claude_code_path: Option<PathBuf>,

    /// Ollama installation path (if detected)
    pub ollama_path: Option<PathBuf>,

    /// Gemini installation path (if detected)
    pub gemini_path: Option<PathBuf>,

    /// OpenAI/Codex installation path (if detected)
    #[serde(default)]
    pub openai_path: Option<PathBuf>,

    /// Last update check timestamp
    #[serde(default)]
    pub last_update_check: Option<DateTime<Utc>>,
}

impl AppConfig {
    /// Create a new configuration with default values
    #[allow(dead_code)]
    pub fn new(app_data_directory: PathBuf, version: String) -> Self {
        Self {
            app_data_directory,
            installation_date: Utc::now(),
            version,
            claude_code_enabled: false,
            ollama_enabled: false,
            gemini_enabled: false,
            openai_enabled: false,
            claude_code_path: None,
            ollama_path: None,
            gemini_path: None,
            openai_path: None,
            last_update_check: None,
        }
    }

    /// Load configuration from file
    pub fn load<P: AsRef<Path>>(path: P) -> Result<Self> {
        let content = fs::read_to_string(path.as_ref()).context("Failed to read config file")?;

        let config: AppConfig =
            serde_json::from_str(&content).context("Failed to parse config file")?;

        Ok(config)
    }

    /// Save configuration to file
    pub fn save<P: AsRef<Path>>(&self, path: P) -> Result<()> {
        let content = serde_json::to_string_pretty(self).context("Failed to serialize config")?;

        // Ensure parent directory exists
        if let Some(parent) = path.as_ref().parent() {
            fs::create_dir_all(parent).context("Failed to create config directory")?;
        }

        fs::write(path.as_ref(), content).context("Failed to write config file")?;

        Ok(())
    }
}

/// Configuration manager for handling platform-specific config storage
pub struct ConfigManager;

impl ConfigManager {
    /// Get the platform-specific config file path.
    /// Delegates to `utils::paths::get_app_data_dir()` so that config.json
    /// is always stored alongside settings.json, secrets.encrypted.json, etc.
    /// - macOS: ~/Library/Application Support/productOS/config.json
    /// - Linux: ~/.local/share/productOS/config.json
    /// - Windows: %APPDATA%/productOS/config.json
    ///
    /// Falls back to the legacy "ai-researcher" directory when it exists and
    /// "productOS" does not (handled inside get_app_data_dir).
    pub fn get_config_path() -> Result<PathBuf> {
        let app_data = get_app_data_dir()?;
        Ok(app_data.join("config.json"))
    }

    /// Load the application configuration
    /// Returns None if config doesn't exist
    pub fn load_config() -> Result<Option<AppConfig>> {
        let config_path = Self::get_config_path()?;

        if !config_path.exists() {
            return Ok(None);
        }

        let config = AppConfig::load(&config_path)?;
        Ok(Some(config))
    }

    /// Save the application configuration
    pub fn save_config(config: &AppConfig) -> Result<()> {
        let config_path = Self::get_config_path()?;
        config.save(&config_path)?;

        log::info!("Configuration saved to {:?}", config_path);
        Ok(())
    }

    /// Check if configuration exists
    pub fn config_exists() -> Result<bool> {
        let config_path = Self::get_config_path()?;
        Ok(config_path.exists())
    }

    /// Initialize configuration with defaults
    #[allow(dead_code)]
    pub fn initialize_config(app_data_directory: PathBuf) -> Result<AppConfig> {
        let version = env!("CARGO_PKG_VERSION").to_string();
        let config = AppConfig::new(app_data_directory, version);

        Self::save_config(&config)?;
        Ok(config)
    }

    /// Update configuration fields
    pub fn update_config<F>(updater: F) -> Result<AppConfig>
    where
        F: FnOnce(&mut AppConfig),
    {
        let mut config = Self::load_config()?
            .context("Configuration not found. Please run installation first.")?;

        updater(&mut config);
        Self::save_config(&config)?;

        Ok(config)
    }

    /// Delete configuration file
    pub fn delete_config() -> Result<()> {
        let config_path = Self::get_config_path()?;

        if config_path.exists() {
            fs::remove_file(&config_path).context("Failed to delete config file")?;
            log::info!("Configuration deleted from {:?}", config_path);
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn test_config_serialization() {
        let temp_dir = TempDir::new().unwrap();
        let config = AppConfig::new(temp_dir.path().to_path_buf(), "0.1.0".to_string());

        let json = serde_json::to_string(&config).unwrap();
        let deserialized: AppConfig = serde_json::from_str(&json).unwrap();

        assert_eq!(config.version, deserialized.version);
        assert_eq!(config.claude_code_enabled, deserialized.claude_code_enabled);
        assert_eq!(config.ollama_enabled, deserialized.ollama_enabled);
        assert_eq!(config.gemini_enabled, deserialized.gemini_enabled);
    }

    #[test]
    fn test_config_save_and_load() {
        let temp_dir = TempDir::new().unwrap();
        let config_path = temp_dir.path().join("config.json");

        let config = AppConfig::new(temp_dir.path().to_path_buf(), "0.1.0".to_string());

        config.save(&config_path).unwrap();
        assert!(config_path.exists());

        let loaded = AppConfig::load(&config_path).unwrap();
        assert_eq!(config.version, loaded.version);
        assert_eq!(config.app_data_directory, loaded.app_data_directory);
    }

    #[test]
    fn test_get_config_path() {
        let path = ConfigManager::get_config_path().unwrap();

        #[cfg(target_os = "windows")]
        assert!(path.to_string_lossy().contains("AppData"));

        #[cfg(target_os = "macos")]
        assert!(path.to_string_lossy().contains("Application Support"));

        #[cfg(target_os = "linux")]
        assert!(path.to_string_lossy().contains(".local/share"));

        // Accept either the new app name or the legacy fallback
        let p = path.to_string_lossy();
        assert!(p.contains("productOS") || p.contains("ai-researcher"));
        assert!(p.ends_with("config.json"));
    }
}
