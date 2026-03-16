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

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GoogleAuthStatus {
    pub connected: bool,
    pub method: String,
    pub details: String,
}

#[tauri::command]
pub async fn authenticate_openai(app: tauri::AppHandle) -> Result<String, String> {
    log::info!("[OpenAI] Starting OAuth PKCE flow...");
    let result = crate::services::openai_oauth::run_oauth_flow().await
        .map_err(|e| format!("OpenAI authentication failed: {}", e))?;
    
    // Emit event so the frontend knows it can refresh status immediately
    use tauri::Emitter;
    let _ = app.emit("openai-auth-updated", ());
    
    Ok(result)
}

#[tauri::command]
pub async fn get_openai_auth_status() -> Result<OpenAiAuthStatus, String> {
    // 1. Check for explicit OPENAI_API_KEY
    let has_api_key = SecretsService::get_secret("OPENAI_API_KEY")
        .map_err(|e| format!("Failed to read OPENAI_API_KEY: {}", e))?
        .map(|v| !v.trim().is_empty())
        .unwrap_or(false);

    if has_api_key {
        return Ok(OpenAiAuthStatus {
            connected: true,
            method: "openai-api-key".to_string(),
            details: "OPENAI_API_KEY is configured.".to_string(),
        });
    }

    // 2. Check for OAuth access token (from PKCE flow)
    if let Some(token) = crate::services::openai_oauth::get_stored_access_token() {
        // Verify token expiration
        if let Some(claims) = crate::services::openai_oauth::parse_jwt_claims(&token) {
            if let Some(exp) = claims["exp"].as_i64() {
                let now = chrono::Utc::now().timestamp();
                if now < exp {
                    return Ok(OpenAiAuthStatus {
                        connected: true,
                        method: "openai-oauth".to_string(),
                        details: "Logged in via ChatGPT OAuth.".to_string(),
                    });
                } else {
                    log::warn!("[OpenAI Auth] Stored OAuth token is expired.");
                }
            }
        }
    }

    // 3. Try CLI status probe if binary is available
    let settings = SettingsService::load_global_settings()
        .map_err(|e| format!("Failed to load settings: {}", e))?;

    let cmd = settings.openai_cli.command.trim().to_string();
    if cmd.is_empty() {
        return Ok(OpenAiAuthStatus {
            connected: false,
            method: "openai-oauth".to_string(),
            details: "Not authenticated. Click 'Login / Refresh Session' to sign in with your ChatGPT account.".to_string(),
        });
    }

    let cmd_parts: Vec<&str> = cmd.split_whitespace().collect();
    let bin = cmd_parts[0];

    // Quick check if binary exists
    if !crate::utils::env::command_exists(bin) {
        return Ok(OpenAiAuthStatus {
            connected: false,
            method: "openai-oauth".to_string(),
            details: "Not authenticated. Click 'Login / Refresh Session' to sign in with your ChatGPT account.".to_string(),
        });
    }

    let args = &cmd_parts[1..];
    let output = tokio::time::timeout(std::time::Duration::from_secs(3), async {
        if bin.eq_ignore_ascii_case("codex") {
            tokio::process::Command::new(bin)
                .args(args)
                .arg("login")
                .arg("status")
                .output()
                .await
        } else if bin.eq_ignore_ascii_case("openai") {
            tokio::process::Command::new(bin)
                .args(args)
                .arg("auth")
                .arg("status")
                .output()
                .await
        } else {
            tokio::process::Command::new(bin)
                .args(args)
                .arg("login")
                .arg("status")
                .output()
                .await
        }
    }).await;

    match output {
        Ok(Ok(out)) => {
            let stdout = String::from_utf8_lossy(&out.stdout);
            let stderr = String::from_utf8_lossy(&out.stderr);
            let combined = format!("{} {}", stdout, stderr).to_lowercase();
            let not_logged = combined.contains("not logged") || combined.contains("not authenticated");
            let connected = out.status.success() && !not_logged;

            Ok(OpenAiAuthStatus {
                connected,
                method: "openai-cli-login".to_string(),
                details: if connected {
                    "OpenAI CLI session looks authenticated.".to_string()
                } else {
                    "Not authenticated. Click 'Login / Refresh Session' to sign in with your ChatGPT account.".to_string()
                },
            })
        }
        Ok(Err(_)) | Err(_) => Ok(OpenAiAuthStatus {
            connected: false,
            method: "openai-oauth".to_string(),
            details: "Not authenticated. Click 'Login / Refresh Session' to sign in with your ChatGPT account.".to_string(),
        }),
    }
}

#[tauri::command]
pub async fn logout_openai() -> Result<String, String> {
    // Clear OAuth tokens
    crate::services::openai_oauth::clear_tokens();

    // Also try CLI logout if binary is available
    let settings = SettingsService::load_global_settings()
        .map_err(|e| format!("Failed to load settings: {}", e))?;

    let cmd = settings.openai_cli.command.trim().to_string();
    if !cmd.is_empty() {
        let cmd_parts: Vec<&str> = cmd.split_whitespace().collect();
        let (bin, args) = (cmd_parts[0], &cmd_parts[1..]);

        if crate::utils::env::command_exists(bin) {
            let logout_args: Vec<&str> = if bin.eq_ignore_ascii_case("codex") {
                vec!["logout"]
            } else if bin.eq_ignore_ascii_case("openai") {
                vec!["auth", "logout"]
            } else {
                vec!["logout"]
            };

            let _ = tokio::time::timeout(std::time::Duration::from_secs(5), async {
                tokio::process::Command::new(bin)
                    .args(args)
                    .args(&logout_args)
                    .output()
                    .await
            }).await;
        }
    }

    Ok("OpenAI logout complete. OAuth tokens and local auth markers cleared.".to_string())
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
            let mut custom = HashMap::new();
            custom.insert("GOOGLE_ANTIGRAVITY_AUTH_MARKER".to_string(), chrono::Utc::now().to_rfc3339());
            let _ = SecretsService::save_secrets(&Secrets {
                claude_api_key: None,
                gemini_api_key: None,
                n8n_webhook_url: None,
                custom_api_keys: custom,
            });
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
            let mut custom = HashMap::new();
            custom.insert("GOOGLE_ANTIGRAVITY_AUTH_MARKER".to_string(), chrono::Utc::now().to_rfc3339());
            let _ = SecretsService::save_secrets(&Secrets {
                claude_api_key: None,
                gemini_api_key: None,
                n8n_webhook_url: None,
                custom_api_keys: custom,
            });
            Ok("Authentication dialog opened".to_string())
        } else {
            let err = String::from_utf8_lossy(&output.stderr);
            Err(format!("Failed to open authentication dialog: {}", err))
        }
    }
}

#[tauri::command]
pub async fn get_google_auth_status() -> Result<GoogleAuthStatus, String> {
    let settings = SettingsService::load_global_settings()
        .map_err(|e| format!("Failed to load settings: {}", e))?;

    // API-key fallback also counts as connected.
    let has_api_key = SecretsService::get_secret("GEMINI_API_KEY")
        .map_err(|e| format!("Failed to read GEMINI_API_KEY: {}", e))?
        .map(|v| !v.trim().is_empty())
        .unwrap_or(false);

    if has_api_key {
        return Ok(GoogleAuthStatus {
            connected: true,
            method: "gemini-api-key".to_string(),
            details: "GEMINI_API_KEY is configured.".to_string(),
        });
    }

    let cmd = settings.gemini_cli.command.trim().to_string();
    if cmd.is_empty() {
        return Ok(GoogleAuthStatus {
            connected: false,
            method: "google-antigravity-login".to_string(),
            details: "Gemini CLI command is empty.".to_string(),
        });
    }

    let cmd_parts: Vec<&str> = cmd.split_whitespace().collect();
    let (bin, args) = (cmd_parts[0], &cmd_parts[1..]);

    // Same probe as detector: models list
    let output = tokio::time::timeout(std::time::Duration::from_secs(6), async {
        tokio::process::Command::new(bin)
            .args(args)
            .arg("models")
            .arg("list")
            .output()
            .await
    }).await;

    match output {
        Ok(Ok(out)) => {
            let stdout = String::from_utf8_lossy(&out.stdout);
            let stderr = String::from_utf8_lossy(&out.stderr);
            let combined = format!("{} {}", stdout, stderr).to_lowercase();

            let unauth = combined.contains("not authenticated")
                || combined.contains("api key")
                || combined.contains("unauthorized")
                || combined.contains("authentication required");
            let connected = out.status.success() && !unauth;

            Ok(GoogleAuthStatus {
                connected,
                method: "google-antigravity-login".to_string(),
                details: if connected {
                    "Google/Gemini CLI session looks authenticated.".to_string()
                } else {
                    format!("Google/Gemini auth not verified yet. ({})", combined.trim())
                },
            })
        }
        Ok(Err(e)) => Ok(GoogleAuthStatus {
            connected: false,
            method: "google-antigravity-login".to_string(),
            details: format!("Failed to execute Gemini auth status check: {}", e),
        }),
        Err(_) => Ok(GoogleAuthStatus {
            connected: false,
            method: "google-antigravity-login".to_string(),
            details: "Google status check timed out. You can still try Login / Change Method.".to_string(),
        }),
    }
}

#[tauri::command]
pub async fn logout_google() -> Result<String, String> {
    let settings = SettingsService::load_global_settings()
        .map_err(|e| format!("Failed to load settings: {}", e))?;

    let cmd = settings.gemini_cli.command.trim().to_string();
    if cmd.is_empty() {
        return Err("Gemini CLI command is empty".to_string());
    }

    let cmd_parts: Vec<&str> = cmd.split_whitespace().collect();
    let (bin, args) = (cmd_parts[0], &cmd_parts[1..]);

    // Best-effort logout; gemini CLI may or may not implement /logout depending on version.
    let _ = tokio::process::Command::new(bin)
        .args(args)
        .arg("/logout")
        .output()
        .await;

    let mut custom = HashMap::new();
    custom.insert("GOOGLE_ANTIGRAVITY_AUTH_MARKER".to_string(), "".to_string());
    let _ = SecretsService::save_secrets(&Secrets {
        claude_api_key: None,
        gemini_api_key: None,
        n8n_webhook_url: None,
        custom_api_keys: custom,
    });

    Ok("Google logout requested and local auth marker cleared.".to_string())
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
