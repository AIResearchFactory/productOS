use crate::models::settings::{GlobalSettings, ProjectSettings};
use crate::services::project_service::ProjectService;
use crate::services::secrets_service::{Secrets, SecretsService};
use crate::services::settings_service::SettingsService;
use crate::utils::paths;
use serde::Serialize;
use std::collections::HashMap;

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

#[tauri::command]
pub async fn authenticate_openai() -> Result<String, String> {
    let settings = SettingsService::load_global_settings()
        .map_err(|e| format!("Failed to load settings: {}", e))?;

    let cmd = settings.openai_cli.command.trim().to_string();
    if cmd.is_empty() {
        return Err("OpenAI CLI command is empty".to_string());
    }

    if cmd.contains(['\n', '\r', '\0']) {
        return Err("Invalid OpenAI CLI command".to_string());
    }

    let cmd_parts: Vec<&str> = cmd.split_whitespace().collect();
    if cmd_parts.is_empty() {
        return Err("OpenAI CLI command is empty".to_string());
    }

    let (bin, args) = (cmd_parts[0], &cmd_parts[1..]);

    // Preferred auth verbs by binary family
    let auth_args: Vec<&str> = if bin.eq_ignore_ascii_case("codex") {
        vec!["login"]
    } else if bin.eq_ignore_ascii_case("openai") {
        vec!["auth", "login"]
    } else {
        // Fallback: most CLIs use "login"
        vec!["login"]
    };

    #[cfg(target_os = "macos")]
    {
        // Execute in a real terminal to support browser/device-code interaction.
        // Use AppleScript argv + quoted form to avoid script injection.
        let script = r#"
on run argv
  set binCmd to item 1 of argv
  set extraArgs to item 2 of argv
  tell application "Terminal"
    do script (quoted form of binCmd & " " & extraArgs)
  end tell
end run
"#;

        let joined_args = std::iter::once(args.iter().copied().collect::<Vec<&str>>().join(" "))
            .chain(std::iter::once(auth_args.join(" ")))
            .collect::<Vec<String>>()
            .join(" ")
            .trim()
            .to_string();

        let output = std::process::Command::new("osascript")
            .arg("-e")
            .arg(script)
            .arg(bin)
            .arg(joined_args)
            .output()
            .map_err(|e| format!("Failed to open terminal for OpenAI authentication: {}", e))?;

        if output.status.success() {
            let mut custom = HashMap::new();
            custom.insert("OPENAI_CLI_AUTH_MARKER".to_string(), chrono::Utc::now().to_rfc3339());
            let _ = SecretsService::save_secrets(&Secrets {
                claude_api_key: None,
                gemini_api_key: None,
                n8n_webhook_url: None,
                custom_api_keys: custom,
            });
            Ok("OpenAI authentication terminal opened. Please complete login in the terminal/browser flow.".to_string())
        } else {
            let err = String::from_utf8_lossy(&output.stderr);
            Err(format!("Failed to open OpenAI authentication terminal: {}", err))
        }
    }

    #[cfg(not(target_os = "macos"))]
    {
        // Run inline for Windows/Linux; CLI usually opens browser or prints device code URL.
        let output = tokio::process::Command::new(bin)
            .args(args)
            .args(auth_args)
            .output()
            .await
            .map_err(|e| format!("Failed to execute OpenAI login flow: {}", e))?;

        if output.status.success() {
            let mut custom = HashMap::new();
            custom.insert("OPENAI_CLI_AUTH_MARKER".to_string(), chrono::Utc::now().to_rfc3339());
            let _ = SecretsService::save_secrets(&Secrets {
                claude_api_key: None,
                gemini_api_key: None,
                n8n_webhook_url: None,
                custom_api_keys: custom,
            });
            Ok("OpenAI authentication flow completed or started successfully.".to_string())
        } else {
            let err = String::from_utf8_lossy(&output.stderr);
            Err(format!("OpenAI authentication failed: {}", err))
        }
    }
}

#[tauri::command]
pub async fn get_openai_auth_status() -> Result<OpenAiAuthStatus, String> {
    let marker = SecretsService::get_secret("OPENAI_CLI_AUTH_MARKER")
        .map_err(|e| format!("Failed to read OpenAI auth marker: {}", e))?;

    let has_marker = marker.as_ref().map(|v| !v.trim().is_empty()).unwrap_or(false);

    let details = if has_marker {
        format!("CLI authentication marker set at {}", marker.clone().unwrap_or_default())
    } else {
        "No CLI auth marker found yet. Use Login / Refresh Session first.".to_string()
    };

    Ok(OpenAiAuthStatus {
        connected: has_marker,
        method: "openai-cli-login".to_string(),
        details,
    })
}

#[tauri::command]
pub async fn logout_openai() -> Result<String, String> {
    let settings = SettingsService::load_global_settings()
        .map_err(|e| format!("Failed to load settings: {}", e))?;

    let cmd = settings.openai_cli.command.trim().to_string();
    if cmd.is_empty() {
        return Err("OpenAI CLI command is empty".to_string());
    }

    let cmd_parts: Vec<&str> = cmd.split_whitespace().collect();
    let (bin, args) = (cmd_parts[0], &cmd_parts[1..]);

    let logout_args: Vec<&str> = if bin.eq_ignore_ascii_case("codex") {
        vec!["logout"]
    } else if bin.eq_ignore_ascii_case("openai") {
        vec!["auth", "logout"]
    } else {
        vec!["logout"]
    };

    let _ = tokio::process::Command::new(bin)
        .args(args)
        .args(&logout_args)
        .output()
        .await;

    let mut custom = HashMap::new();
    custom.insert("OPENAI_CLI_AUTH_MARKER".to_string(), "".to_string());
    let _ = SecretsService::save_secrets(&Secrets {
        claude_api_key: None,
        gemini_api_key: None,
        n8n_webhook_url: None,
        custom_api_keys: custom,
    });

    Ok("OpenAI logout requested and local auth marker cleared.".to_string())
}

#[tauri::command]
pub async fn authenticate_gemini() -> Result<String, String> {
    let settings = SettingsService::load_global_settings()
        .map_err(|e| format!("Failed to load settings: {}", e))?;

    let cmd = settings.gemini_cli.command.trim().to_string();
    if cmd.is_empty() {
        return Err("Gemini CLI command is empty".to_string());
    }

    // Basic hardening: disallow control chars that should never appear in an executable path/name.
    if cmd.contains(['\n', '\r', '\0']) {
        return Err("Invalid Gemini CLI command".to_string());
    }

    #[cfg(target_os = "macos")]
    {
        // SECURITY: pass the command as an argv value to osascript and shell-quote it inside AppleScript
        // via `quoted form of`, instead of interpolating untrusted text into AppleScript source.
        let script = r#"
on run argv
  set cmd to item 1 of argv
  tell application "Terminal"
    do script (quoted form of cmd & " /auth")
  end tell
end run
"#;

        let output = std::process::Command::new("osascript")
            .arg("-e")
            .arg(script)
            .arg(&cmd)
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
        let output = tokio::process::Command::new(&cmd)
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
    crate::utils::user::get_system_username().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_formatted_owner_name() -> Result<String, String> {
    crate::utils::user::get_formatted_owner_name().map_err(|e| e.to_string())
}
