use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

use crate::config::{AppConfig, ConfigManager};
use crate::detector::{self, ClaudeCodeInfo, GeminiInfo, OllamaInfo};
use crate::directory;

/// Installation configuration state
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstallationConfig {
    pub app_data_path: PathBuf,
    pub is_first_install: bool,
    pub claude_code_detected: bool,
    pub ollama_detected: bool,
    pub gemini_detected: bool,
}

/// Installation progress state
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstallationProgress {
    pub stage: InstallationStage,
    pub message: String,
    pub progress_percentage: u8,
}

/// Installation stage enum
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum InstallationStage {
    Initializing,
    SelectingDirectory,
    CreatingStructure,
    DetectingDependencies,
    InstallingClaudeCode,
    InstallingOllama,
    InstallingGemini,
    Finalizing,
    Complete,
    Error,
}

/// Installation result containing detected dependencies
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstallationResult {
    pub success: bool,
    pub config: InstallationConfig,
    pub claude_code_info: Option<ClaudeCodeInfo>,
    pub ollama_info: Option<OllamaInfo>,
    pub gemini_info: Option<GeminiInfo>,
    pub error_message: Option<String>,
}

/// Installation Manager
pub struct InstallationManager {
    config: InstallationConfig,
}

impl InstallationManager {
    /// Create a new installation manager with the given app data path
    pub fn new(app_data_path: PathBuf) -> Self {
        let is_first_install = directory::is_first_install(&app_data_path);

        Self {
            config: InstallationConfig {
                app_data_path,
                is_first_install,
                claude_code_detected: false,
                ollama_detected: false,
                gemini_detected: false,
            },
        }
    }

    /// Create installation manager with default app data path
    pub fn with_default_path() -> Result<Self> {
        let app_data_path = crate::utils::paths::get_app_data_dir()?;
        Ok(Self::new(app_data_path))
    }

    /// Get the current installation configuration
    pub fn config(&self) -> &InstallationConfig {
        &self.config
    }

    /// Check if this is a first-time installation
    #[allow(dead_code)]
    pub fn is_first_install(&self) -> bool {
        self.config.is_first_install
    }

    /// Run the complete installation process
    pub async fn run_installation<F>(
        &mut self,
        projects_path: Option<PathBuf>,
        progress_callback: F,
    ) -> Result<InstallationResult>
    where
        F: Fn(InstallationProgress) + Send + 'static,
    {
        // Stage 1: Initializing
        progress_callback(InstallationProgress {
            stage: InstallationStage::Initializing,
            message: "Initializing installation...".to_string(),
            progress_percentage: 0,
        });

        // Stage 2: Creating directory structure
        progress_callback(InstallationProgress {
            stage: InstallationStage::CreatingStructure,
            message: "Creating directory structure...".to_string(),
            progress_percentage: 20,
        });

        if let Err(e) = directory::create_directory_structure(&self.config.app_data_path).await {
            return Ok(InstallationResult {
                success: false,
                config: self.config.clone(),
                claude_code_info: None,
                ollama_info: None,
                gemini_info: None,
                error_message: Some(format!("Failed to create directory structure: {}", e)),
            });
        }

        // If projects_path was provided, ensure it exists
        if let Some(ref p) = projects_path {
            if let Err(e) = std::fs::create_dir_all(p) {
                log::error!("Failed to create projects directory: {}", e);
            }
        }

        // Stage 3: Detecting dependencies
        progress_callback(InstallationProgress {
            stage: InstallationStage::DetectingDependencies,
            message: "Detecting dependencies...".to_string(),
            progress_percentage: 40,
        });

        let claude_code_info = detector::detect_claude_code().await?;
        let ollama_info = detector::detect_ollama().await?;
        let gemini_info = detector::detect_gemini().await?;

        self.config.claude_code_detected = claude_code_info.is_some();
        self.config.ollama_detected = ollama_info.is_some();
        self.config.gemini_detected = gemini_info.is_some();

        // Stage 4: Installing Claude Code (if needed)
        if !self.config.claude_code_detected && self.config.is_first_install {
            progress_callback(InstallationProgress {
                stage: InstallationStage::InstallingClaudeCode,
                message: "Claude Code not detected. Installation required.".to_string(),
                progress_percentage: 60,
            });
            // Note: Actual installation will be handled by the frontend
        } else {
            progress_callback(InstallationProgress {
                stage: InstallationStage::InstallingClaudeCode,
                message: "Claude Code detected.".to_string(),
                progress_percentage: 60,
            });
        }

        // Stage 5: Finalizing
        progress_callback(InstallationProgress {
            stage: InstallationStage::Finalizing,
            message: "Finalizing installation...".to_string(),
            progress_percentage: 80,
        });

        // Create default files if first install
        if self.config.is_first_install {
            directory::create_default_files(&self.config.app_data_path).await?;
        }

        // Save installation state
        self.save_installation_state()?;

        // If projects_path was provided, update GlobalSettings
        if let Some(path) = projects_path {
            if let Ok(mut settings) = crate::services::settings_service::SettingsService::load_global_settings() {
                settings.projects_path = Some(path);
                let _ = crate::services::settings_service::SettingsService::save_global_settings(&settings);
            }
        }

        // Create and save persistent AppConfig
        let openai_path = if crate::utils::env::command_exists("codex") {
            std::process::Command::new("where")
                .arg("codex")
                .output()
                .ok()
                .and_then(|o| String::from_utf8(o.stdout).ok())
                .and_then(|s| s.lines().next().map(|l| std::path::PathBuf::from(l.trim())))
        } else if crate::utils::env::command_exists("openai") {
            std::process::Command::new("where")
                .arg("openai")
                .output()
                .ok()
                .and_then(|o| String::from_utf8(o.stdout).ok())
                .and_then(|s| s.lines().next().map(|l| std::path::PathBuf::from(l.trim())))
        } else {
            None
        };

        let app_config = AppConfig {
            app_data_directory: self.config.app_data_path.clone(),
            installation_date: chrono::Utc::now(),
            version: env!("CARGO_PKG_VERSION").to_string(),
            claude_code_enabled: self.config.claude_code_detected,
            ollama_enabled: self.config.ollama_detected,
            gemini_enabled: self.config.gemini_detected,
            openai_enabled: openai_path.is_some(),
            claude_code_path: claude_code_info.as_ref().and_then(|info| info.path.clone()),
            ollama_path: ollama_info.as_ref().and_then(|info| info.path.clone()),
            gemini_path: gemini_info.as_ref().and_then(|info| info.path.clone()),
            openai_path,
            last_update_check: None,
        };

        ConfigManager::save_config(&app_config)
            .context("Failed to save application configuration")?;

        // Stage 6: Complete
        progress_callback(InstallationProgress {
            stage: InstallationStage::Complete,
            message: "Installation complete!".to_string(),
            progress_percentage: 100,
        });

        Ok(InstallationResult {
            success: true,
            config: self.config.clone(),
            claude_code_info,
            ollama_info,
            gemini_info,
            error_message: None,
        })
    }

    /// Save installation state to a file
    fn save_installation_state(&self) -> Result<()> {
        let state_file = self.config.app_data_path.join(".installation_state.json");
        let state_json = serde_json::to_string_pretty(&self.config)
            .context("Failed to serialize installation state")?;

        std::fs::write(&state_file, state_json)
            .context("Failed to write installation state file")?;

        log::info!("Installation state saved to {:?}", state_file);
        Ok(())
    }

    /// Load installation state from file
    pub fn load_installation_state(app_data_path: &Path) -> Result<InstallationConfig> {
        let state_file = app_data_path.join(".installation_state.json");

        if !state_file.exists() {
            return Ok(InstallationConfig {
                app_data_path: app_data_path.to_path_buf(),
                is_first_install: true,
                claude_code_detected: false,
                ollama_detected: false,
                gemini_detected: false,
            });
        }

        let state_json = std::fs::read_to_string(&state_file)
            .context("Failed to read installation state file")?;

        let config: InstallationConfig =
            serde_json::from_str(&state_json).context("Failed to parse installation state")?;

        Ok(config)
    }

    /// Re-detect dependencies (useful for updates)
    pub async fn redetect_dependencies(&mut self) -> Result<()> {
        let claude_code_info = detector::detect_claude_code().await?;
        let ollama_info = detector::detect_ollama().await?;
        let gemini_info = detector::detect_gemini().await?;

        self.config.claude_code_detected = claude_code_info.is_some();
        self.config.ollama_detected = ollama_info.is_some();
        self.config.gemini_detected = gemini_info.is_some();

        self.save_installation_state()?;

        // Update AppConfig if it exists
        if ConfigManager::config_exists()? {
            ConfigManager::update_config(|config| {
                config.claude_code_enabled = claude_code_info.is_some();
                config.ollama_enabled = ollama_info.is_some();
                config.gemini_enabled = gemini_info.is_some();
                config.openai_enabled = crate::utils::env::command_exists("codex") || crate::utils::env::command_exists("openai");
                config.claude_code_path =
                    claude_code_info.as_ref().and_then(|info| info.path.clone());
                config.ollama_path = ollama_info.as_ref().and_then(|info| info.path.clone());
                config.gemini_path = gemini_info.as_ref().and_then(|info| info.path.clone());
                config.openai_path = if crate::utils::env::command_exists("codex") {
                    std::process::Command::new("where").arg("codex").output().ok()
                        .and_then(|o| String::from_utf8(o.stdout).ok())
                        .and_then(|s| s.lines().next().map(|l| std::path::PathBuf::from(l.trim())))
                } else if crate::utils::env::command_exists("openai") {
                    std::process::Command::new("where").arg("openai").output().ok()
                        .and_then(|o| String::from_utf8(o.stdout).ok())
                        .and_then(|s| s.lines().next().map(|l| std::path::PathBuf::from(l.trim())))
                } else { None };
            })?;
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn test_installation_config_serialization() {
        let config = InstallationConfig {
            app_data_path: PathBuf::from("/test/path"),
            is_first_install: true,
            claude_code_detected: false,
            ollama_detected: false,
            gemini_detected: false,
        };

        let json = serde_json::to_string(&config).unwrap();
        let deserialized: InstallationConfig = serde_json::from_str(&json).unwrap();

        assert_eq!(config.is_first_install, deserialized.is_first_install);
        assert_eq!(
            config.claude_code_detected,
            deserialized.claude_code_detected
        );
        assert_eq!(config.ollama_detected, deserialized.ollama_detected);
        assert_eq!(config.gemini_detected, deserialized.gemini_detected);
    }

    #[test]
    fn test_installation_manager_creation() {
        let temp_dir = TempDir::new().unwrap();
        // Create a subdirectory that doesn't exist yet
        let non_existent_path = temp_dir.path().join("non_existent_dir");
        let manager = InstallationManager::new(non_existent_path);

        assert!(manager.is_first_install());
        assert!(!manager.config().claude_code_detected);
        assert!(!manager.config().ollama_detected);
        assert!(!manager.config().gemini_detected);
    }

    #[test]
    fn test_save_and_load_installation_state() {
        let temp_dir = TempDir::new().unwrap();
        let mut manager = InstallationManager::new(temp_dir.path().to_path_buf());

        // Create the directory first
        std::fs::create_dir_all(temp_dir.path()).unwrap();

        manager.config.claude_code_detected = true;
        manager.save_installation_state().unwrap();

        let loaded_config =
            InstallationManager::load_installation_state(&temp_dir.path().to_path_buf()).unwrap();
        assert!(loaded_config.claude_code_detected);
    }
}
