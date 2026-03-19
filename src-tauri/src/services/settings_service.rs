use crate::models::settings::{GlobalSettings, ProjectSettings, SettingsError};
use crate::utils::paths;
use std::path::{Path, PathBuf};

/// Service for managing global and project-specific settings
pub struct SettingsService;

impl SettingsService {
    /// Get the default location for global settings file
    fn global_settings_path() -> Result<PathBuf, SettingsError> {
        paths::get_global_settings_path().map_err(|e| {
            SettingsError::ReadError(std::io::Error::new(
                std::io::ErrorKind::NotFound,
                format!("Could not find global settings path: {}", e),
            ))
        })
    }

    /// Load global settings from settings.json in the user's home directory
    /// If the file doesn't exist, returns default settings
    pub fn load_global_settings() -> Result<GlobalSettings, SettingsError> {
        let path = Self::global_settings_path()?;
        let settings = GlobalSettings::load(&path)?;
        
        // Background pre-warm of dynamic defaults
        tokio::spawn(async {
            let _ = crate::services::defaults_service::DefaultsService::get_recommended_defaults().await;
        });

        Ok(settings)
    }

    /// Save global settings to settings.json in the user's home directory
    /// Creates the directory if it doesn't exist
    pub fn save_global_settings(settings: &GlobalSettings) -> Result<(), SettingsError> {
        let path = Self::global_settings_path()?;

        // Ensure the parent directory exists
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| {
                SettingsError::WriteError(format!("Failed to create settings directory: {}", e))
            })?;
        }

        settings.save(&path)
    }

    /// Load project-specific settings from .metadata/settings.json in the project directory
    /// Returns None if the file doesn't exist
    pub fn load_project_settings(
        project_path: &Path,
    ) -> Result<Option<ProjectSettings>, SettingsError> {
        let settings_path = project_path.join(".metadata").join("settings.json");

        if !settings_path.exists() {
            // Check for legacy if needed, but ProjectSettings::load already handles it
            let settings = ProjectSettings::load(&settings_path)?;
            // If it returned default but file didn't exist, we might want to return None
            // to match previous behavior, but actually load() returns default if not exists.
            // Previous behavior returned Ok(None) if not exists.

            // To maintain compatibility with callers who check for None:
            if !settings_path.exists() {
                return Ok(None);
            }
            return Ok(Some(settings));
        }

        let settings = ProjectSettings::load(&settings_path)?;
        Ok(Some(settings))
    }

    /// Save project-specific settings to .metadata/settings.json in the project directory
    pub fn save_project_settings(
        project_path: &Path,
        settings: &ProjectSettings,
    ) -> Result<(), SettingsError> {
        let settings_dir = project_path.join(".metadata");
        let settings_path = settings_dir.join("settings.json");

        // Ensure the .metadata directory exists
        if !settings_dir.exists() {
            std::fs::create_dir_all(&settings_dir).map_err(|e| {
                SettingsError::WriteError(format!("Failed to create .metadata directory: {}", e))
            })?;
        }

        settings.save(&settings_path)
    }

    /// Get the projects directory path from global settings
    /// Falls back to a default location if not configured
    pub fn get_projects_path() -> Result<PathBuf, SettingsError> {
        paths::get_projects_dir().map_err(|e| {
            SettingsError::ReadError(std::io::Error::new(
                std::io::ErrorKind::NotFound,
                format!("Could not find projects directory: {}", e),
            ))
        })
    }

    /// Get the skills directory path from global settings
    /// Falls back to a default location if not configured
    pub fn get_skills_path() -> Result<PathBuf, SettingsError> {
        paths::get_skills_dir().map_err(|e| {
            SettingsError::ReadError(std::io::Error::new(
                std::io::ErrorKind::NotFound,
                format!("Could not find skills directory: {}", e),
            ))
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn test_save_and_load_project_settings() {
        let temp_dir = TempDir::new().unwrap();
        let project_path = temp_dir.path();

        let settings = ProjectSettings {
            name: None,
            goal: None,
            custom_prompt: Some("Test prompt".to_string()),
            preferred_skills: vec!["rust".to_string(), "testing".to_string()],
            auto_save: Some(true),
            encryption_enabled: Some(true),
            personalization_rules: None,
            brand_settings: None,
        };

        // Save settings
        let result = SettingsService::save_project_settings(project_path, &settings);
        assert!(result.is_ok());

        // Load settings
        let loaded = SettingsService::load_project_settings(project_path).unwrap();
        assert!(loaded.is_some());

        let loaded_settings = loaded.unwrap();
        assert_eq!(
            loaded_settings.custom_prompt,
            Some("Test prompt".to_string())
        );
        assert_eq!(loaded_settings.preferred_skills.len(), 2);
    }

    #[test]
    fn test_load_nonexistent_project_settings() {
        let temp_dir = TempDir::new().unwrap();
        let project_path = temp_dir.path();

        let result = SettingsService::load_project_settings(project_path);
        assert!(result.is_ok());
        assert!(result.unwrap().is_none());
    }
}
