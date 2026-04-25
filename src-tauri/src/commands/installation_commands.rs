use crate::detector::{self, ClaudeCodeInfo, GeminiInfo, OllamaInfo};
use serde::{Deserialize, Serialize};
use crate::directory;
use crate::installer::{
    InstallationConfig, InstallationManager, InstallationProgress, InstallationResult,
};
use anyhow::Result;


#[cfg(target_os = "windows")]
pub fn windows_hidden_creation_flags() -> u32 {
    crate::utils::process::windows_hidden_creation_flags()
}

/// Check the current installation status

pub async fn check_installation_status() -> Result<InstallationConfig, String> {
    let app_data_path = crate::utils::paths::get_app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;

    let config = InstallationManager::load_installation_state(&app_data_path)
        .map_err(|e| format!("Failed to load installation state: {}", e))?;

    Ok(config)
}

/// Detect Claude Code installation

pub async fn detect_claude_code() -> Result<Option<ClaudeCodeInfo>, String> {
    let settings = crate::services::settings_service::SettingsService::load_global_settings()
        .map_err(|e| e.to_string())?;

    detector::detect_claude_code_with_path(settings.claude.detected_path)
        .await
        .map_err(|e| format!("Failed to detect Claude Code: {}", e))
}

/// Detect Ollama installation

pub async fn detect_ollama() -> Result<Option<OllamaInfo>, String> {
    let settings = crate::services::settings_service::SettingsService::load_global_settings()
        .map_err(|e| e.to_string())?;

    // Optimization: If we have a path, check if it still exists
    if let Some(path_str) = &settings.ollama.detected_path {
        let path = std::path::Path::new(path_str);
        if path.exists() {
            return Ok(Some(OllamaInfo {
                installed: true,
                version: Some("detected".to_string()),
                path: Some(std::path::PathBuf::from(path_str)),
                running: true, // Assume running to avoid slow check
                in_path: false,
            }));
        }
    }

    // Fallback to full detection
    detector::detect_ollama_with_path(settings.ollama.detected_path)
        .await
        .map_err(|e| format!("Failed to detect Ollama: {}", e))
}

/// Get Claude Code installation instructions

pub fn get_claude_code_install_instructions() -> String {
    detector::get_claude_code_installation_instructions()
}

/// Get Ollama installation instructions

pub fn get_ollama_install_instructions() -> String {
    detector::get_ollama_installation_instructions()
}

/// Detect Gemini CLI installation

pub async fn detect_gemini() -> Result<Option<GeminiInfo>, String> {
    let settings = crate::services::settings_service::SettingsService::load_global_settings()
        .map_err(|e| e.to_string())?;

    detector::detect_gemini_with_path(settings.gemini_cli.detected_path)
        .await
        .map_err(|e| format!("Failed to detect Gemini CLI: {}", e))
}

/// Get Gemini CLI installation instructions

pub fn get_gemini_install_instructions() -> String {
    detector::get_gemini_installation_instructions()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenAiCliInfo {
    pub installed: bool,
    pub version: Option<String>,
    pub path: Option<std::path::PathBuf>,
    pub in_path: bool,
}

/// Detect OpenAI/Codex CLI installation

pub async fn detect_openai_cli() -> Result<Option<OpenAiCliInfo>, String> {
    let settings = crate::services::settings_service::SettingsService::load_global_settings()
        .map_err(|e| e.to_string())?;

    Ok(crate::services::openai_cli_service::detect_openai_cli(Some(&settings.open_ai_cli)).map(|info| OpenAiCliInfo {
        installed: true,
        version: info.version,
        path: Some(info.path),
        in_path: info.in_path,
    }))
}

/// Detect all CLI tools at once (more efficient)

pub async fn detect_all_cli_tools() -> Result<
    (
        Option<ClaudeCodeInfo>,
        Option<OllamaInfo>,
        Option<GeminiInfo>,
    ),
    String,
> {
    let settings = crate::services::settings_service::SettingsService::load_global_settings()
        .map_err(|e| e.to_string())?;

    detector::detect_all_cli_tools(
        settings.claude.detected_path,
        settings.ollama.detected_path,
        settings.gemini_cli.detected_path,
    )
    .await
    .map_err(|e| format!("Failed to detect CLI tools: {}", e))
}

/// Clear detection cache for a specific tool

pub fn clear_cli_detection_cache(tool_name: String) -> Result<(), String> {
    detector::clear_detection_cache(&tool_name);
    Ok(())
}

/// Clear all CLI detection caches

pub fn clear_all_cli_detection_caches() -> Result<(), String> {
    detector::clear_all_detection_caches();
    Ok(())
}

/// Run the complete installation process

pub async fn run_installation(
    app_data_path: Option<String>,
    projects_path: Option<String>,
) -> Result<InstallationResult, String> {
    log::info!(
        "Starting installation process with data path: {:?}, projects path: {:?}...",
        app_data_path,
        projects_path
    );

    let path = if let Some(p) = app_data_path {
        std::path::PathBuf::from(p)
    } else {
        crate::utils::paths::get_app_data_dir()
            .map_err(|e| format!("Failed to get default app data directory: {}", e))?
    };

    let mut manager = InstallationManager::new(path);

    let result = manager
        .run_installation(projects_path.map(std::path::PathBuf::from), move |progress: InstallationProgress| {
            log::info!(
                "Installation progress: {:?} - {} ({}%)",
                progress.stage,
                progress.message,
                progress.progress_percentage
            );

            // Emit progress to frontend
            
        })
        .await
        .map_err(|e| format!("Installation failed: {}", e))?;

    log::info!("Installation completed: {:?}", result.success);

    Ok(result)
}

/// Verify the directory structure is intact

pub async fn verify_directory_structure() -> Result<bool, String> {
    let app_data_path = crate::utils::paths::get_app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;

    directory::verify_directory_structure(&app_data_path)
        .await
        .map_err(|e| format!("Failed to verify directory structure: {}", e))
}

/// Re-detect dependencies (useful after manual installation)

pub async fn redetect_dependencies() -> Result<InstallationConfig, String> {
    let mut manager = InstallationManager::with_default_path()
        .map_err(|e| format!("Failed to create installation manager: {}", e))?;

    manager
        .redetect_dependencies()
        .await
        .map_err(|e| format!("Failed to re-detect dependencies: {}", e))?;

    Ok(manager.config().clone())
}

/// Create a backup of the current installation

pub async fn backup_installation() -> Result<String, String> {
    let app_data_path = crate::utils::paths::get_app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;

    directory::backup_directory(&app_data_path)
        .await
        .map_err(|e| format!("Failed to create backup: {}", e))?;

    Ok("Backup created successfully".to_string())
}

/// Clean up old backups (keep only the last N)

pub async fn cleanup_old_backups(keep_count: usize) -> Result<String, String> {
    let app_data_path = crate::utils::paths::get_app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;

    directory::cleanup_old_backups(&app_data_path, keep_count)
        .await
        .map_err(|e| format!("Failed to cleanup old backups: {}", e))?;

    Ok(format!("Cleaned up old backups, kept last {}", keep_count))
}

/// Check if this is a first-time installation

pub fn is_first_install() -> Result<bool, String> {
    let app_data_path = crate::utils::paths::get_app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;

    Ok(directory::is_first_install(&app_data_path))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_detect_dependencies() {
        let claude_result = detect_claude_code().await;
        assert!(claude_result.is_ok());

        let ollama_result = detect_ollama().await;
        assert!(ollama_result.is_ok());
    }

    #[test]
    fn test_get_install_instructions() {
        let claude_instructions = get_claude_code_install_instructions();
        assert!(!claude_instructions.is_empty());

        let ollama_instructions = get_ollama_install_instructions();
        assert!(!ollama_instructions.is_empty());
    }

    #[tokio::test]
    async fn test_verify_directory_structure() {
        // This may fail if the directory doesn't exist yet, which is expected
        let result = verify_directory_structure().await;
        assert!(result.is_ok());
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn test_windows_hidden_creation_flags_constant() {
        assert_eq!(windows_hidden_creation_flags(), 0x08000000);
    }
}

