use crate::models::settings::{GlobalSettings, ProjectSettings};
use crate::services::project_service::ProjectService;
use crate::services::settings_service::SettingsService;
use crate::utils::paths;
use serde::Serialize;

#[tauri::command]
pub async fn get_app_data_directory() -> Result<String, String> {
    paths::get_app_data_dir()
        .map(|p| p.to_string_lossy().to_string())
        .map_err(|e| format!("Failed to get app data directory: {}", e))
}

#[tauri::command]
pub async fn get_global_settings() -> Result<GlobalSettings, String> {
    SettingsService::load_global_settings()
        .map_err(|e| format!("Failed to load global settings: {}", e))
}

#[tauri::command]
pub async fn save_global_settings(settings: GlobalSettings) -> Result<(), String> {
    SettingsService::save_global_settings(&settings)
        .map_err(|e| format!("Failed to save global settings: {}", e))
}

#[tauri::command]
pub async fn get_project_settings(project_id: String) -> Result<Option<ProjectSettings>, String> {
    let project_path = ProjectService::resolve_project_path(&project_id)
        .map_err(|e| format!("Failed to resolve project path: {}", e))?;

    SettingsService::load_project_settings(&project_path)
        .map_err(|e| format!("Failed to load project settings: {}", e))
}

#[tauri::command]
pub async fn save_project_settings(
    project_id: String,
    settings: ProjectSettings,
) -> Result<(), String> {
    let project_path = ProjectService::resolve_project_path(&project_id)
        .map_err(|e| format!("Failed to resolve project path: {}", e))?;

    SettingsService::save_project_settings(&project_path, &settings)
        .map_err(|e| format!("Failed to save project settings: {}", e))?;

    // Also update the .project.md file if name or goal is provided
    if settings.name.is_some() || settings.goal.is_some() {
        crate::services::project_service::ProjectService::update_project_metadata(
            &project_id,
            settings.name,
            settings.goal,
        )
        .map_err(|e| format!("Failed to update project metadata: {}", e))?;
    }

    Ok(())
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenAiAuthStatus {
    pub connected: bool,
    pub method: String,
    pub details: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GoogleAuthStatus {
    pub connected: bool,
    pub method: String,
    pub details: String,
}

#[tauri::command]
pub async fn authenticate_openai(_app: tauri::AppHandle) -> Result<String, String> {
    crate::services::provider_manager::ProviderManager::authenticate("openai")
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_openai_auth_status() -> Result<OpenAiAuthStatus, String> {
    let s = crate::services::provider_manager::ProviderManager::status("openai")
        .await
        .map_err(|e| e.to_string())?;

    Ok(OpenAiAuthStatus {
        connected: s.connected,
        method: s.method,
        details: s.details,
    })
}

#[tauri::command]
pub async fn logout_openai() -> Result<String, String> {
    crate::services::provider_manager::ProviderManager::logout("openai")
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn authenticate_gemini(_app: tauri::AppHandle) -> Result<String, String> {
    crate::services::provider_manager::ProviderManager::authenticate("google")
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_google_auth_status() -> Result<GoogleAuthStatus, String> {
    let s = crate::services::provider_manager::ProviderManager::status("google")
        .await
        .map_err(|e| e.to_string())?;

    Ok(GoogleAuthStatus {
        connected: s.connected,
        method: s.method,
        details: s.details,
    })
}

#[tauri::command]
pub async fn logout_google() -> Result<String, String> {
    crate::services::provider_manager::ProviderManager::logout("google")
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn add_custom_cli(mut config: crate::models::ai::CustomCliConfig) -> Result<(), String> {
    let mut settings = SettingsService::load_global_settings()
        .map_err(|e| format!("Failed to load settings: {}", e))?;

    // Normalize config so newly added CLIs show up consistently in provider lists.
    if !config.command.trim().is_empty() {
        config.is_configured = true;
    }

    if let Some(existing) = settings.custom_clis.iter_mut().find(|c| c.id == config.id) {
        *existing = config;
    } else {
        settings.custom_clis.push(config);
    }

    SettingsService::save_global_settings(&settings)
        .map_err(|e| format!("Failed to save settings: {}", e))
}

#[tauri::command]
pub async fn remove_custom_cli(id: String) -> Result<(), String> {
    let mut settings = SettingsService::load_global_settings()
        .map_err(|e| format!("Failed to load settings: {}", e))?;

    settings.custom_clis.retain(|c| c.id != id);

    SettingsService::save_global_settings(&settings)
        .map_err(|e| format!("Failed to save settings: {}", e))
}

#[tauri::command]
pub async fn list_available_providers() -> Result<Vec<crate::models::ai::ProviderType>, String> {
    crate::services::ai_service::AIService::list_available_providers()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_system_username() -> Result<String, String> {
    crate::utils::user::get_system_username().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_formatted_owner_name() -> Result<String, String> {
    crate::utils::user::get_formatted_owner_name().map_err(|e| e.to_string())
}

