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
pub async fn authenticate_openai(_app: tauri::AppHandle) -> Result<String, String> {
    let settings = SettingsService::load_global_settings()
        .map_err(|e| format!("Failed to load settings: {}", e))?;

    let cmd = settings.openai_cli.command.trim().to_string();
    if cmd.is_empty() {
        return Err("OpenAI CLI command is empty".to_string());
    }

    let cmd_parts: Vec<&str> = cmd.split_whitespace().collect();
    let (bin, args) = (cmd_parts[0], &cmd_parts[1..]);

    let login_args: Vec<&str> = if bin.eq_ignore_ascii_case("codex") {
        vec!["login"]
    } else if bin.eq_ignore_ascii_case("openai") {
        vec!["auth", "login"]
    } else {
        vec!["login"]
    };

    let output = tokio::process::Command::new(bin)
        .args(args)
        .args(&login_args)
        .output()
        .await
        .map_err(|e| format!("Failed to execute OpenAI login flow: {}", e))?;

    if output.status.success() {
        Ok("OpenAI CLI login flow completed or started successfully.".to_string())
    } else {
        let err = String::from_utf8_lossy(&output.stderr);
        Err(format!("OpenAI authentication failed: {}", err))
    }
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

    // 2. Try CLI status probe if binary is available
    let settings = SettingsService::load_global_settings()
        .map_err(|e| format!("Failed to load settings: {}", e))?;

    let cmd = settings.openai_cli.command.trim().to_string();
    if cmd.is_empty() {
        return Ok(OpenAiAuthStatus {
            connected: false,
            method: "openai-cli-login".to_string(),
            details: "Not authenticated. Click 'Login / Refresh Session' to sign in with your local OpenAI/Codex CLI.".to_string(),
        });
    }

    let cmd_parts: Vec<&str> = cmd.split_whitespace().collect();
    let bin = cmd_parts[0];

    // Quick check if binary exists
    if !crate::utils::env::command_exists(bin) {
        return Ok(OpenAiAuthStatus {
            connected: false,
            method: "openai-cli-login".to_string(),
            details: "OpenAI/Codex CLI not found in PATH. Install it first, then login.".to_string(),
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
            let combined = format!("{} {}", String::from_utf8_lossy(&out.stdout), String::from_utf8_lossy(&out.stderr)).to_lowercase();
            let connected = out.status.success() && !combined.contains("not logged") && !combined.contains("not authenticated");

            Ok(OpenAiAuthStatus {
                connected,
                method: "openai-cli-login".to_string(),
                details: if connected {
                    "OpenAI CLI session looks authenticated.".to_string()
                } else {
                    "Not authenticated. Click 'Login / Refresh Session' to sign in with your local OpenAI/Codex CLI.".to_string()
                },
            })
        }
        Ok(Err(_)) | Err(_) => Ok(OpenAiAuthStatus {
            connected: false,
            method: "openai-cli-login".to_string(),
            details: "Not authenticated. Click 'Login / Refresh Session' to sign in with your local OpenAI/Codex CLI.".to_string(),
        }),
    }
}

#[tauri::command]
pub async fn logout_openai() -> Result<String, String> {
    // CLI-only mode: perform CLI logout if available.
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

    Ok("OpenAI CLI logout requested.".to_string())
}

#[tauri::command]
pub async fn authenticate_gemini(app: tauri::AppHandle) -> Result<String, String> {
    let settings = SettingsService::load_global_settings()
        .map_err(|e| format!("Failed to load settings: {}", e))?;

    let cmd = settings.gemini_cli.command.trim().to_string();
    if cmd.is_empty() {
        return Err("Gemini CLI command is empty".to_string());
    }

    let cmd_parts: Vec<&str> = cmd.split_whitespace().collect();
    let (bin, args) = (cmd_parts[0], &cmd_parts[1..]);

    log::info!("[Gemini] Starting authentication via {}...", bin);
    
    // On macOS, we open a Terminal window so the user can see the progress/prompts
    #[cfg(target_os = "macos")]
    {
        let args_str = args.join(" ");
        // Removed /auth signin as per user feedback that it's not accepted.
        let script = format!("tell application \"Terminal\" to activate\ntell application \"Terminal\" to do script \"'{}' {}\"", bin, args_str);
        let status = tokio::process::Command::new("osascript")
            .arg("-e")
            .arg(&script)
            .status()
            .await
            .map_err(|e| format!("Failed to launch Terminal: {}", e))?;
            
        if !status.success() {
            return Err("Failed to launch terminal for authentication".to_string());
        }
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = tokio::process::Command::new(bin)
            .args(args)
            .spawn()
            .map_err(|e| format!("Failed to execute gemini: {}", e))?;
    }

    // Set auth marker
    let mut custom = HashMap::new();
    custom.insert("GOOGLE_ANTIGRAVITY_AUTH_MARKER".to_string(), chrono::Utc::now().to_rfc3339());
    let _ = SecretsService::save_secrets(&Secrets {
        claude_api_key: None,
        gemini_api_key: None,
        n8n_webhook_url: None,
        custom_api_keys: custom,
    });

    // Emit event so the frontend knows it can refresh status immediately
    use tauri::Emitter;
    let _ = app.emit("google-auth-updated", ());
    
    Ok("Authentication window opened in Terminal. Please complete the login and return here.".to_string())
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

    // Same probe as detector: --list-sessions
    let output = tokio::time::timeout(std::time::Duration::from_secs(6), async {
        tokio::process::Command::new(bin)
            .args(args)
            .arg("--list-sessions")
            .output()
            .await
    }).await;

    match output {
        Ok(Ok(out)) => {
            let combined = format!("{} {}", String::from_utf8_lossy(&out.stdout), String::from_utf8_lossy(&out.stderr));
            let connected = combined.contains("Loaded cached credentials.");

            Ok(GoogleAuthStatus {
                connected,
                method: "google-antigravity-login".to_string(),
                details: if connected {
                    "Google/Gemini CLI session looks authenticated.".to_string()
                } else {
                    "Google/Gemini auth not verified yet. Please login via Terminal.".to_string()
                },
            })
        }
        _ => {
            // Fallback to marker check if command fails or times out
            let secrets = SecretsService::load_secrets().unwrap_or_default();
            let has_marker = secrets.custom_api_keys.get("GOOGLE_ANTIGRAVITY_AUTH_MARKER")
                .map(|v| !v.trim().is_empty())
                .unwrap_or(false);
            
            let connected = has_marker;
            
            Ok(GoogleAuthStatus {
                connected,
                method: "google-antigravity-login-marker".to_string(),
                details: if connected {
                    "Connected via Google auth marker (CLI session check timed out).".to_string()
                } else {
                    "Google/Gemini auth not verified yet. Please login via Terminal.".to_string()
                },
            })
        }
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

#[tauri::command]
pub async fn get_usage_statistics() -> Result<crate::models::cost::UsageStatistics, String> {
    let projects = ProjectService::discover_projects()
        .map_err(|e| format!("Failed to discover projects: {}", e))?;

    let mut global_stats = crate::models::cost::UsageStatistics::default();
    let mut combined_provider_map: std::collections::HashMap<
        String,
        crate::models::cost::ProviderUsage,
    > = std::collections::HashMap::new();

    for project in projects {
        let cost_log_path = project.path.join(".metadata").join("cost_log.json");
        if let Ok(log) = crate::models::cost::CostLog::load(&cost_log_path) {
            let project_stats = log.get_usage_statistics();

            global_stats.total_prompts += project_stats.total_prompts;
            global_stats.total_responses += project_stats.total_responses;
            global_stats.total_cost_usd += project_stats.total_cost_usd;
            global_stats.total_time_saved_minutes += project_stats.total_time_saved_minutes;
            global_stats.total_input_tokens += project_stats.total_input_tokens;
            global_stats.total_output_tokens += project_stats.total_output_tokens;
            global_stats.total_cache_read_tokens += project_stats.total_cache_read_tokens;
            global_stats.total_cache_creation_tokens += project_stats.total_cache_creation_tokens;
            global_stats.total_reasoning_tokens += project_stats.total_reasoning_tokens;
            global_stats.total_tool_calls += project_stats.total_tool_calls;

            for provider_use in project_stats.provider_breakdown {
                let entry = combined_provider_map
                    .entry(provider_use.provider.clone())
                    .or_insert(crate::models::cost::ProviderUsage {
                        provider: provider_use.provider.clone(),
                        prompt_count: 0,
                        response_count: 0,
                        total_cost_usd: 0.0,
                        total_input_tokens: 0,
                        total_output_tokens: 0,
                        total_cache_read_tokens: 0,
                        total_cache_creation_tokens: 0,
                        total_reasoning_tokens: 0,
                    });
                entry.prompt_count += provider_use.prompt_count;
                entry.response_count += provider_use.response_count;
                entry.total_cost_usd += provider_use.total_cost_usd;
                entry.total_input_tokens += provider_use.total_input_tokens;
                entry.total_output_tokens += provider_use.total_output_tokens;
                entry.total_cache_read_tokens += provider_use.total_cache_read_tokens;
                entry.total_cache_creation_tokens += provider_use.total_cache_creation_tokens;
                entry.total_reasoning_tokens += provider_use.total_reasoning_tokens;
            }
        }
    }

    global_stats.provider_breakdown = combined_provider_map.into_values().collect();
    global_stats.provider_breakdown.sort_by(|a, b| b.response_count.cmp(&a.response_count));

    Ok(global_stats)
}
