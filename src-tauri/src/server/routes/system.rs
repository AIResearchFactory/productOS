use crate::commands::installation_commands;
use crate::detector;
use axum::{routing::{get, post}, Json, Router, extract::State, response::sse::{Event, Sse}};
use futures_util::stream::{Stream, StreamExt};
use tokio_stream::wrappers::BroadcastStream;
use std::convert::Infallible;
use super::utils::internal_error;

pub fn router() -> Router<super::super::AppState> {
    Router::new()
        .route("/detect/claude", get(detect_claude))
        .route("/detect/ollama", get(detect_ollama))
        .route("/detect/gemini", get(detect_gemini))
        .route("/detect/openai", get(detect_openai))
        .route("/detect/clear-cache", post(clear_all_caches))
        .route("/data-directory", get(get_data_directory))
        .route("/update/check", get(check_update).post(check_update))
        .route("/update/install", post(install_update))
        .route("/installation/status", get(get_installation_status))
        .route("/ask", post(ask))
        .route("/message", post(message_dialog))
        .route("/open", post(open_dialog))
        .route("/save", post(save_dialog))
        .route("/relaunch", post(relaunch))
        .route("/exit", post(exit_app))
        .route("/shutdown", post(shutdown))
        .route("/first-install", get(is_first_install))
        .route("/trace-logs", get(trace_logs_stream))
        .route("/events", get(events_stream))
        .route("/maintenance/backup", post(backup_installation_route))
        .route("/maintenance/cleanup", post(cleanup_old_backups_route))
        .route("/maintenance/verify", get(verify_installation_route))
        .route("/maintenance/preserve", post(preserve_structure_route))
        .route("/maintenance/backup-user", post(backup_user_data_route))
        .route("/maintenance/restore", post(restore_from_backup_route))
        .route("/maintenance/backups", get(list_backups_route))
}

async fn get_data_directory() -> Result<Json<String>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    crate::utils::paths::get_app_data_dir()
        .map(|p| p.to_string_lossy().to_string())
        .map(Json)
        .map_err(internal_error)
}

async fn detect_claude() -> Result<Json<Option<detector::ClaudeCodeInfo>>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    installation_commands::detect_claude_code().await.map(Json).map_err(internal_error)
}

async fn detect_ollama() -> Result<Json<Option<detector::OllamaInfo>>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    installation_commands::detect_ollama().await.map(Json).map_err(internal_error)
}

async fn detect_gemini() -> Result<Json<Option<detector::GeminiInfo>>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    installation_commands::detect_gemini().await.map(Json).map_err(internal_error)
}

async fn detect_openai() -> Result<Json<Option<installation_commands::OpenAiCliInfo>>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    installation_commands::detect_openai_cli().await.map(Json).map_err(internal_error)
}

async fn clear_all_caches() -> Result<(), (axum::http::StatusCode, Json<serde_json::Value>)> {
    installation_commands::clear_all_cli_detection_caches().map_err(internal_error)?;
    Ok(())
}

#[derive(serde::Deserialize)]
struct ShutdownQuery {
    source: Option<String>,
}

async fn check_update() -> Result<Json<serde_json::Value>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    Ok(Json(serde_json::json!({
        "available": false,
        "currentVersion": env!("CARGO_PKG_VERSION"),
        "latestVersion": env!("CARGO_PKG_VERSION"),
        "version": env!("CARGO_PKG_VERSION")
    })))
}

async fn install_update() -> Result<(), (axum::http::StatusCode, Json<serde_json::Value>)> {
    Ok(())
}

#[derive(serde::Deserialize)]
struct AskRequest {
    message: String,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct FileFilter {
    name: String,
    extensions: Vec<String>,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct OpenOptions {
    directory: Option<bool>,
    multiple: Option<bool>,
    default_path: Option<String>,
    title: Option<String>,
    filters: Option<Vec<FileFilter>>,
}


#[derive(serde::Deserialize)]
struct MessageRequest {
    message: String,
}

async fn ask(Json(req): Json<AskRequest>) -> Result<Json<bool>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    println!("ASK PROMPT: {}", req.message);
    
    // In a local server environment, we can use rfd to show a native dialog.
    // On macOS, this must be on the main thread or handled carefully.
    // We use spawn_blocking with catch_unwind to prevent process panics.
    let confirmed = tokio::task::spawn_blocking(move || {
        println!("Opening native ASK dialog...");
        std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            rfd::MessageDialog::new()
                .set_title("Confirm")
                .set_description(&req.message)
                .set_level(rfd::MessageLevel::Info)
                .set_buttons(rfd::MessageButtons::YesNo)
                .show() == rfd::MessageDialogResult::Yes
        })).unwrap_or_else(|_| {
            eprintln!("CRITICAL: rfd::MessageDialog panicked! This usually happens on macOS when running in a NonWindowed environment from a background thread.");
            false
        })
    }).await.unwrap_or(false);

    Ok(Json(confirmed))
}

async fn message_dialog(Json(req): Json<MessageRequest>) -> Result<(), (axum::http::StatusCode, Json<serde_json::Value>)> {
    println!("MESSAGE DIALOG: {}", req.message);
    
    tokio::task::spawn_blocking(move || {
        let _ = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            rfd::MessageDialog::new()
                .set_title("Information")
                .set_description(&req.message)
                .set_level(rfd::MessageLevel::Info)
                .set_buttons(rfd::MessageButtons::Ok)
                .show();
        }));
    }).await.unwrap_or(());

    Ok(())
}

async fn open_dialog(Json(options): Json<OpenOptions>) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    println!("Opening native OPEN dialog...");
    
    let mut dialog = rfd::AsyncFileDialog::new();
    
    if let Some(title) = options.title {
        dialog = dialog.set_title(&title);
    }
    
    if let Some(default_path) = options.default_path {
        dialog = dialog.set_directory(default_path);
    }
    
    if let Some(filters) = options.filters {
        for filter in filters {
            let extensions: Vec<&str> = filter.extensions.iter().map(|s| s.as_str()).collect();
            dialog = dialog.add_filter(&filter.name, &extensions);
        }
    }

    let selected = if options.directory == Some(true) {
        dialog.pick_folder().await.map(|h| serde_json::to_value(h.path().to_string_lossy().to_string()).unwrap())
    } else if options.multiple == Some(true) {
        dialog.pick_files().await.map(|handles| {
            let path_strings: Vec<String> = handles.iter().map(|h| h.path().to_string_lossy().to_string()).collect();
            serde_json::to_value(path_strings).unwrap()
        })
    } else {
        dialog.pick_file().await.map(|h| serde_json::to_value(h.path().to_string_lossy().to_string()).unwrap())
    };

    println!("Native OPEN dialog selected: {:?}", selected);
    match selected {
        Some(val) => Ok(Json(val)),
        None => Ok(Json(serde_json::Value::Null)),
    }
}

async fn save_dialog(Json(options): Json<OpenOptions>) -> Result<Json<Option<String>>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    println!("Opening native SAVE dialog...");
    
    let mut dialog = rfd::AsyncFileDialog::new();
    
    if let Some(title) = options.title {
        dialog = dialog.set_title(&title);
    }
    
    if let Some(default_path) = options.default_path {
        let path = std::path::Path::new(&default_path);
        if path.is_absolute() {
            if let Some(parent) = path.parent() {
                dialog = dialog.set_directory(parent.to_path_buf());
            }
            if let Some(file_name) = path.file_name() {
                dialog = dialog.set_file_name(file_name.to_string_lossy().into_owned());
            }
        } else {
            dialog = dialog.set_file_name(default_path);
        }
    }
    
    if let Some(filters) = options.filters {
        for filter in filters {
            let extensions: Vec<&str> = filter.extensions.iter().map(|s| s.as_str()).collect();
            dialog = dialog.add_filter(&filter.name, &extensions);
        }
    }

    let selected = dialog.save_file().await.map(|h| h.path().to_string_lossy().to_string());

    println!("Native SAVE dialog selected: {:?}", selected);
    Ok(Json(selected))
}

async fn relaunch() -> Result<(), (axum::http::StatusCode, Json<serde_json::Value>)> {
    println!("Relaunch requested. Restarting...");
    tokio::spawn(async move {
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
        std::process::exit(0);
    });
    Ok(())
}

#[derive(serde::Deserialize)]
struct ExitRequest {
    code: i32,
}

async fn exit_app(Json(req): Json<ExitRequest>) -> Result<(), (axum::http::StatusCode, Json<serde_json::Value>)> {
    println!("Exit requested with code: {}", req.code);
    tokio::spawn(async move {
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
        std::process::exit(req.code);
    });
    Ok(())
}

async fn shutdown(axum::extract::Query(query): axum::extract::Query<ShutdownQuery>) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    println!("Shutdown requested. Exiting in 500ms...");
    
    let is_ui = query.source.as_deref() == Some("ui");

    // Spawn a task to exit the process after a short delay
    tokio::spawn(async move {
        if is_ui {
            println!("Triggered from UI. Spawning npm stop sequence...");
            let _ = tokio::process::Command::new("npm")
                .arg("run")
                .arg("stop")
                .current_dir("..")
                .spawn();
        }

        tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
        std::process::exit(0);
    });

    Ok(Json(serde_json::json!({ "status": "shutting_down" })))
}

async fn is_first_install() -> Result<Json<bool>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    let app_data_dir = crate::utils::paths::get_app_data_dir().map_err(internal_error)?;
    Ok(Json(crate::directory::is_first_install(&app_data_dir)))
}

async fn trace_logs_stream(
    State(state): State<super::super::AppState>,
) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    let receiver = state.trace_log_sender.subscribe();
    let stream = BroadcastStream::new(receiver).map(|msg| {
        match msg {
            Ok(text) => Ok(Event::default().data(text)),
            Err(_) => Ok(Event::default().data("Log stream lagged...")),
        }
    });

    Sse::new(stream).keep_alive(axum::response::sse::KeepAlive::default())
}

#[derive(serde::Deserialize)]
struct EventQuery {
    event: Option<String>,
}

async fn events_stream(
    State(state): State<super::super::AppState>,
    axum::extract::Query(query): axum::extract::Query<EventQuery>,
) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    let receiver = state.event_sender.subscribe();
    let target_event = query.event;
    
    let stream = BroadcastStream::new(receiver).filter_map(move |msg| {
        let target = target_event.clone();
        async move {
            match msg {
                Ok(evt) => {
                    if let Some(ref t) = target {
                        if evt.event != *t {
                            return None;
                        }
                    }
                    let data = serde_json::to_string(&serde_json::json!({
                        "event": evt.event,
                        "payload": evt.payload
                    })).unwrap_or_else(|_| "{}".to_string());
                    Some(Ok(Event::default().data(data)))
                },
                _ => None,
            }
        }
    });

    Sse::new(stream).keep_alive(axum::response::sse::KeepAlive::default())
}

async fn backup_installation_route() -> Result<Json<String>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    installation_commands::backup_installation().await.map(Json).map_err(internal_error)
}

#[derive(serde::Deserialize)]
struct CleanupBackupsRequest {
    keep_count: usize,
}

async fn cleanup_old_backups_route(Json(req): Json<CleanupBackupsRequest>) -> Result<Json<String>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    installation_commands::cleanup_old_backups(req.keep_count).await.map(Json).map_err(internal_error)
}

async fn verify_installation_route() -> Result<Json<bool>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    installation_commands::verify_directory_structure().await.map(Json).map_err(internal_error)
}

async fn preserve_structure_route() -> Result<(), (axum::http::StatusCode, Json<serde_json::Value>)> {
    let app_data_dir = crate::utils::paths::get_app_data_dir().map_err(internal_error)?;
    crate::directory::create_directory_structure(&app_data_dir).await.map_err(internal_error)?;
    Ok(())
}

async fn backup_user_data_route() -> Result<Json<String>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    // For now, use the same backup logic as it includes projects and skills
    installation_commands::backup_installation().await.map(Json).map_err(internal_error)
}

#[derive(serde::Deserialize)]
struct RestoreRequest {
    _path: String,
}

async fn restore_from_backup_route(Json(_req): Json<RestoreRequest>) -> Result<(), (axum::http::StatusCode, Json<serde_json::Value>)> {
    // Restore logic not yet fully implemented in headless mode
    // Returning success for type compatibility
    Ok(())
}

async fn list_backups_route() -> Result<Json<Vec<String>>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    let app_data_dir = crate::utils::paths::get_app_data_dir().map_err(internal_error)?;
    let backups_dir = app_data_dir.join("backups");
    
    if !backups_dir.exists() {
        return Ok(Json(vec![]));
    }

    let entries = std::fs::read_dir(backups_dir).map_err(internal_error)?;
    let mut backups = Vec::new();
    for entry in entries.filter_map(|e| e.ok()) {
        if entry.file_type().map(|ft| ft.is_dir()).unwrap_or(false) {
            backups.push(entry.path().to_string_lossy().to_string());
        }
    }
    
    backups.sort();
    backups.reverse();
    Ok(Json(backups))
}

async fn get_installation_status() -> Result<Json<crate::installer::InstallationConfig>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    installation_commands::check_installation_status().await.map(Json).map_err(internal_error)
}
