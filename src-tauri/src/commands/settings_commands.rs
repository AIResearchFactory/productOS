use crate::models::settings::{GlobalSettings, ProjectSettings};
use crate::services::project_service::ProjectService;
use crate::services::secrets_service::SecretsService;
use crate::services::settings_service::SettingsService;
use crate::utils::paths;
use crate::models::error::{AppResult, AppError};
use serde::Serialize;


#[tauri::command]
pub async fn get_app_data_directory() -> AppResult<String> {
    paths::get_app_data_dir()
        .map(|p| p.to_string_lossy().to_string())
        .map_err(|e| AppError::Io(format!("Failed to get app data directory: {}", e)))
}

#[tauri::command]
pub async fn get_global_settings() -> AppResult<GlobalSettings> {
    SettingsService::load_global_settings()
        .map_err(|e| AppError::Settings(format!("Failed to load global settings: {}", e)))
}

#[tauri::command]
pub async fn save_global_settings(settings: GlobalSettings) -> AppResult<()> {
    SettingsService::save_global_settings(&settings)
        .map_err(|e| AppError::Settings(format!("Failed to save global settings: {}", e)))
}

#[tauri::command]
pub async fn get_project_settings(project_id: String) -> AppResult<Option<ProjectSettings>> {
    let project_path = ProjectService::resolve_project_path(&project_id)
        .map_err(|e| AppError::NotFound(format!("Failed to resolve project path: {}", e)))?;

    SettingsService::load_project_settings(&project_path)
        .map_err(|e| AppError::Settings(format!("Failed to load project settings: {}", e)))
}

#[tauri::command]
pub async fn save_project_settings(
    project_id: String,
    settings: ProjectSettings,
) -> AppResult<()> {
    let project_path = ProjectService::resolve_project_path(&project_id)
        .map_err(|e| AppError::NotFound(format!("Failed to resolve project path: {}", e)))?;

    SettingsService::save_project_settings(&project_path, &settings)
        .map_err(|e| AppError::Settings(format!("Failed to save project settings: {}", e)))?;

    // Also update the .project.md file if name or goal is provided
    if settings.name.is_some() || settings.goal.is_some() {
        crate::services::project_service::ProjectService::update_project_metadata(
            &project_id,
            settings.name,
            settings.goal,
        )
        .map_err(|e| AppError::Internal(format!("Failed to update project metadata: {}", e)))?;
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
pub async fn authenticate_openai(app: tauri::AppHandle) -> AppResult<String> {
    authenticate_openai_internal(Some(app)).await
}

pub async fn authenticate_openai_internal(_app: Option<tauri::AppHandle>) -> AppResult<String> {
    let settings = SettingsService::load_global_settings()
        .map_err(|e| AppError::Settings(format!("Failed to load settings: {}", e)))?;

    crate::detector::clear_detection_cache("openai");

    let parsed = crate::utils::process::parse_command_string(&settings.open_ai_cli.command)
        .map_err(|e| AppError::Validation(format!("Invalid OpenAI CLI command: {}", e)))?;
    let _manual_login = crate::services::openai_cli_service::manual_login_command(&settings.open_ai_cli)
        .unwrap_or_else(|_| "codex login".to_string());
    let _ = &_manual_login; // Suppress unused warning on non-Windows

    #[cfg(target_os = "macos")]
    {
        let mut command_parts = vec![format!("'{}'", parsed.program)];
        command_parts.extend(parsed.args.iter().cloned());
        command_parts.push("login".to_string());
        let script = format!(
            "tell application \"Terminal\" to activate\ntell application \"Terminal\" to do script \"{}\"",
            command_parts.join(" ")
        );
        let status = tokio::process::Command::new("osascript")
            .arg("-e")
            .arg(&script)
            .status()
            .await
            .map_err(|e| AppError::Internal(format!("Failed to launch Terminal: {}", e)))?;

        if !status.success() {
            return Err(AppError::Auth("Failed to launch terminal for authentication".to_string()));
        }

        return Ok("Authentication window opened in Terminal. Please complete the login and return here.".to_string());
    }

    #[cfg(target_os = "windows")]
    {
        return Ok(format!(
            "On Windows, productOS will not auto-open a terminal for OpenAI/Codex login. Please run `{}` manually in your own terminal, complete the login there, then return here and refresh status.",
            _manual_login
        ));
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        let _ = crate::utils::process::tokio_command(&parsed.program)
            .args(&parsed.args)
            .arg("login")
            .spawn()
            .map_err(|e| AppError::Internal(format!("Failed to execute OpenAI login flow: {}", e)))?;

        Ok("Authentication command launched. Please complete the login in your terminal and return here.".to_string())
    }
}

#[tauri::command]
pub async fn get_openai_auth_status() -> AppResult<OpenAiAuthStatus> {
    let has_api_key = SecretsService::get_secret("OPENAI_API_KEY")
        .map_err(|e| AppError::Internal(format!("Failed to read OPENAI_API_KEY: {}", e)))?
        .map(|v| !v.trim().is_empty())
        .unwrap_or(false);

    if has_api_key {
        return Ok(OpenAiAuthStatus {
            connected: true,
            method: "openai-api-key".to_string(),
            details: "OPENAI_API_KEY is configured.".to_string(),
        });
    }

    let settings = SettingsService::load_global_settings()
        .map_err(|e| AppError::Settings(format!("Failed to load settings: {}", e)))?;

    let probe = crate::services::openai_cli_service::probe_openai_cli_auth(&settings.open_ai_cli).await;

    Ok(OpenAiAuthStatus {
        connected: probe.connected,
        method: probe.method,
        details: probe.details,
    })
}

#[tauri::command]
pub async fn logout_openai() -> AppResult<String> {
    let settings = SettingsService::load_global_settings()
        .map_err(|e| AppError::Settings(format!("Failed to load settings: {}", e)))?;

    crate::detector::clear_detection_cache("openai");
    match crate::services::openai_cli_service::logout_openai_cli(&settings.open_ai_cli).await {
        Ok(()) => Ok("OpenAI/Codex CLI logout requested.".to_string()),
        Err(err) => Ok(format!(
            "OpenAI/Codex CLI logout was not run automatically: {}",
            err
        )),
    }
}

#[tauri::command]
pub async fn authenticate_gemini(app: tauri::AppHandle) -> AppResult<String> {
    authenticate_gemini_internal(Some(app)).await
}

pub async fn authenticate_gemini_internal(app: Option<tauri::AppHandle>) -> AppResult<String> {
    let settings = SettingsService::load_global_settings()
        .map_err(|e| AppError::Settings(format!("Failed to load settings: {}", e)))?;

    crate::detector::clear_detection_cache("gemini");

    let parsed = crate::utils::process::parse_command_string(&settings.gemini_cli.command)
        .map_err(|e| AppError::Validation(format!("Invalid Gemini CLI command: {}", e)))?;
    let manual_command = if parsed.args.is_empty() {
        parsed.program.clone()
    } else {
        format!("{} {}", parsed.program, parsed.args.join(" "))
    };
    let _ = &manual_command;

    log::info!("[Gemini] Starting authentication via {}...", parsed.program);

    #[cfg(target_os = "macos")]
    {
        let script = format!(
            "tell application \"Terminal\" to activate\ntell application \"Terminal\" to do script \"'{}' {}\"",
            parsed.program,
            parsed.args.join(" ")
        );
        let status = tokio::process::Command::new("osascript")
            .arg("-e")
            .arg(&script)
            .status()
            .await
            .map_err(|e| AppError::Internal(format!("Failed to launch Terminal: {}", e)))?;

        if !status.success() {
            return Err(AppError::Auth("Failed to launch terminal for authentication".to_string()));
        }
    }

    #[cfg(target_os = "windows")]
    {
        use tauri::Emitter;
        if let Some(a) = app {
            let _ = a.emit("google-auth-updated", ());
        }
        crate::detector::clear_detection_cache("gemini");
        return Ok(format!(
            "On Windows, productOS will not auto-open a terminal for Gemini login. Please run `{}` manually in your own terminal, complete the Gemini auth flow there, then return here and refresh status.",
            manual_command
        ));
    }

    #[cfg(not(target_os = "windows"))]
    {
        #[cfg(not(target_os = "macos"))]
        {
            let _ = crate::utils::process::tokio_command(&parsed.program)
                .args(&parsed.args)
                .spawn()
                .map_err(|e| AppError::Internal(format!("Failed to execute gemini: {}", e)))?;
        }

    use tauri::Emitter;
    if let Some(a) = app {
        let _ = a.emit("google-auth-updated", ());
    }
    crate::detector::clear_detection_cache("gemini");

        Ok("Authentication command launched. Please complete the login in your terminal and return here.".to_string())
    }
}

#[tauri::command]
pub async fn authenticate_claude(_app: tauri::AppHandle) -> AppResult<String> {
    crate::detector::clear_detection_cache("claude-code");
    #[cfg(target_os = "macos")]
    {
        let script = "tell application \"Terminal\" to activate\ntell application \"Terminal\" to do script \"claude login\"";
        let status = tokio::process::Command::new("osascript")
            .arg("-e")
            .arg(&script)
            .status()
            .await
            .map_err(|e| AppError::Internal(format!("Failed to launch Terminal: {}", e)))?;

        if !status.success() {
            return Err(AppError::Auth("Failed to launch terminal for authentication".to_string()));
        }

        return Ok("Authentication window opened in Terminal. Please complete the login and return here.".to_string());
    }

    #[cfg(target_os = "windows")]
    {
        return Ok("On Windows, productOS will not auto-open a terminal for Claude login. Please run `claude login` manually in your own terminal, complete the login there, then return here and refresh status.".to_string());
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        let _ = tokio::process::Command::new("claude")
            .arg("login")
            .spawn()
            .map_err(|e| AppError::Internal(format!("Failed to execute Claude login: {}", e)))?;

        crate::detector::clear_detection_cache("claude-code");
        Ok("Authentication command launched. Please complete the login in your terminal and return here.".to_string())
    }
}

#[tauri::command]
pub async fn get_google_auth_status() -> AppResult<GoogleAuthStatus> {
    let settings = SettingsService::load_global_settings()
        .map_err(|e| AppError::Settings(format!("Failed to load settings: {}", e)))?;

    let has_api_key = SecretsService::get_secret("GEMINI_API_KEY")
        .map_err(|e| AppError::Internal(format!("Failed to read GEMINI_API_KEY: {}", e)))?
        .map(|v| !v.trim().is_empty())
        .unwrap_or(false);

    if has_api_key {
        return Ok(GoogleAuthStatus {
            connected: true,
            method: "gemini-api-key".to_string(),
            details: "GEMINI_API_KEY is configured.".to_string(),
        });
    }

    let detected = crate::detector::detect_gemini_with_path(settings.gemini_cli.detected_path.clone())
        .await
        .map_err(|e| AppError::Internal(format!("Failed to detect Gemini CLI: {}", e)))?;

    let manual_details = format!(
        "Gemini CLI is not authenticated yet. On Windows, run `{}` manually in your own terminal, complete login there, then refresh status here.",
        settings.gemini_cli.command.trim()
    );

    match detected {
        Some(info) if info.authenticated == Some(true) => Ok(GoogleAuthStatus {
            connected: true,
            method: "google-antigravity-login".to_string(),
            details: "Gemini CLI session looks authenticated.".to_string(),
        }),
        Some(_) => Ok(GoogleAuthStatus {
            connected: false,
            method: "google-antigravity-login".to_string(),
            details: manual_details,
        }),
        None => Ok(GoogleAuthStatus {
            connected: false,
            method: "google-antigravity-login".to_string(),
            details: "Gemini CLI not found. Install or configure it first, then refresh status.".to_string(),
        }),
    }
}

#[tauri::command]
pub async fn logout_google() -> AppResult<String> {
    let settings = SettingsService::load_global_settings()
        .map_err(|e| AppError::Settings(format!("Failed to load settings: {}", e)))?;

    let parsed = crate::utils::process::parse_command_string(&settings.gemini_cli.command)
        .map_err(|e| AppError::Validation(format!("Invalid Gemini CLI command: {}", e)))?;

    let _ = crate::utils::process::tokio_command(&parsed.program)
        .args(&parsed.args)
        .arg("/logout")
        .output()
        .await;

    crate::detector::clear_detection_cache("gemini");
    Ok("Google logout requested and local auth marker cleared.".to_string())
}

#[tauri::command]
pub async fn add_custom_cli(mut config: crate::models::ai::CustomCliConfig) -> AppResult<()> {
    let mut settings = SettingsService::load_global_settings()
        .map_err(|e| AppError::Settings(format!("Failed to load settings: {}", e)))?;

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
        .map_err(|e| AppError::Settings(format!("Failed to save settings: {}", e)))
}

#[tauri::command]
pub async fn remove_custom_cli(id: String) -> AppResult<()> {
    let mut settings = SettingsService::load_global_settings()
        .map_err(|e| AppError::Settings(format!("Failed to load settings: {}", e)))?;

    settings.custom_clis.retain(|c| c.id != id);

    SettingsService::save_global_settings(&settings)
        .map_err(|e| AppError::Settings(format!("Failed to save settings: {}", e)))
}

#[tauri::command]
pub async fn list_available_providers() -> AppResult<Vec<crate::models::ai::ProviderType>> {
    crate::services::ai_service::AIService::list_available_providers()
        .await
        .map_err(|e| AppError::Ai(e.to_string()))
}

#[tauri::command]
pub async fn get_system_username() -> AppResult<String> {
    crate::utils::user::get_system_username().map_err(|e| AppError::Internal(e.to_string()))
}

#[tauri::command]
pub async fn get_formatted_owner_name() -> AppResult<String> {
    crate::utils::user::get_formatted_owner_name().map_err(|e| AppError::Internal(e.to_string()))
}

#[tauri::command]
pub async fn get_usage_statistics(project_id: Option<String>) -> AppResult<crate::models::cost::UsageStatistics> {
    let projects = if let Some(pid) = project_id {
        vec![crate::services::project_service::ProjectService::load_project_by_id(&pid)
            .map_err(|e| AppError::NotFound(format!("Project {} not found: {}", pid, e)))?]
    } else {
        crate::services::project_service::ProjectService::discover_projects()
            .map_err(|e| AppError::Internal(e.to_string()))?
    };

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
#[tauri::command]
pub async fn open_browser(app: tauri::AppHandle, url: String) -> AppResult<()> {
    use tauri_plugin_opener::OpenerExt;
    app.opener().open_url(&url, None::<&str>).map_err(|e| AppError::Internal(format!("Failed to open browser: {}", e)))
}

