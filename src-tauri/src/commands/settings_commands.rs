use crate::models::settings::{GlobalSettings, ProjectSettings};
use crate::services::settings_service::SettingsService;
use crate::utils::paths;

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
    let projects_path = SettingsService::get_projects_path()
        .map_err(|e| format!("Failed to get projects path: {}", e))?;

    let project_path = projects_path.join(&project_id);

    SettingsService::load_project_settings(&project_path)
        .map_err(|e| format!("Failed to load project settings: {}", e))
}

#[tauri::command]
pub async fn save_project_settings(project_id: String, settings: ProjectSettings) -> Result<(), String> {
    let projects_path = SettingsService::get_projects_path()
        .map_err(|e| format!("Failed to get projects path: {}", e))?;

    let project_path = projects_path.join(&project_id);

    SettingsService::save_project_settings(&project_path, &settings)
        .map_err(|e| format!("Failed to save project settings: {}", e))?;

    // Also update the .project.md file if name or goal is provided
    if settings.name.is_some() || settings.goal.is_some() {
        crate::services::project_service::ProjectService::update_project_metadata(
            &project_id,
            settings.name,
            settings.goal,
        ).map_err(|e| format!("Failed to update project metadata: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
pub async fn authenticate_gemini() -> Result<String, String> {
    let settings = SettingsService::load_global_settings()
        .map_err(|e| format!("Failed to load settings: {}", e))?;

    let cmd = settings.gemini_cli.command;
    
    #[cfg(target_os = "macos")]
    {
        // On macOS, we can open a terminal window to handle the interactive TUI
        let script = format!("tell application \"Terminal\" to do script \"{} /auth\"", cmd);
        let output = std::process::Command::new("osascript")
            .arg("-e")
            .arg(&script)
            .output()
            .map_err(|e| format!("Failed to open terminal for authentication: {}", e))?;

        if output.status.success() {
            Ok("Authentication terminal opened. Please follow the instructions in the new terminal window.".to_string())
        } else {
            let err = String::from_utf8_lossy(&output.stderr);
            Err(format!("Failed to open authentication terminal: {}", err))
        }
    }

    #[cfg(not(target_os = "macos"))]
    {
        // Use /auth to open the authentication dialog as per https://geminicli.com/docs/get-started/authentication/
        let output = tokio::process::Command::new(cmd)
            .arg("/auth")
            .output()
            .await
            .map_err(|e| format!("Failed to execute gemini /auth: {}", e))?;

        if output.status.success() {
            Ok("Authentication dialog opened".to_string())
        } else {
            let err = String::from_utf8_lossy(&output.stderr);
            Err(format!("Failed to open authentication dialog: {}", err))
        }
    }
}

#[tauri::command]
pub async fn add_custom_cli(config: crate::models::ai::CustomCliConfig) -> Result<(), String> {
    let mut settings = SettingsService::load_global_settings()
        .map_err(|e| format!("Failed to load settings: {}", e))?;

    settings.custom_clis.push(config);
    
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
    crate::utils::user::get_system_username()
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_formatted_owner_name() -> Result<String, String> {
    crate::utils::user::get_formatted_owner_name()
        .map_err(|e| e.to_string())
}
