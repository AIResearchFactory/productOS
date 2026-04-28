use crate::commands::installation_commands;
use crate::detector;
use crate::utils::paths;
use crate::commands::update_commands;
use axum::{routing::{get, post}, Json, Router, extract::{State, Query}, response::sse::{Event, Sse}};
use futures_util::stream::{Stream, StreamExt};
use tokio_stream::wrappers::BroadcastStream;
use std::convert::Infallible;
use super::utils::internal_error;
use serde::Deserialize;

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
    paths::get_app_data_dir()
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

async fn ask(Json(req): Json<AskRequest>) -> Result<Json<bool>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    println!("ASK PROMPT: {}", req.message);
    // Native dialogs are not safe for headless/server mode as they block.
    // We return NOT_IMPLEMENTED to trigger the frontend's browser fallback (window.confirm).
    Err((axum::http::StatusCode::NOT_IMPLEMENTED, Json(serde_json::json!({ "error": "Native dialogs not supported in headless mode" }))))
}

async fn message_dialog(Json(req): Json<AskRequest>) -> Result<(), (axum::http::StatusCode, Json<serde_json::Value>)> {
    println!("MESSAGE DIALOG: {}", req.message);
    // Native dialogs are not safe for headless/server mode as they block.
    // We return NOT_IMPLEMENTED to trigger the frontend's browser fallback (window.alert).
    Err((axum::http::StatusCode::NOT_IMPLEMENTED, Json(serde_json::json!({ "error": "Native dialogs not supported in headless mode" }))))
}

#[derive(serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct FileFilter {
    name: String,
    extensions: Vec<String>,
}

#[derive(serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenOptions {
    directory: Option<bool>,
    filters: Option<Vec<FileFilter>>,
    multiple: Option<bool>,
    default_path: Option<String>,
    title: Option<String>,
}

async fn open_dialog(Json(options): Json<OpenOptions>) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    let current_exe = std::env::current_exe().map_err(internal_error)?;
    let mut child = tokio::process::Command::new(current_exe)
        .arg("--dialog")
        .arg("open")
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .spawn()
        .map_err(internal_error)?;

    if let Some(mut stdin) = child.stdin.take() {
        use tokio::io::AsyncWriteExt;
        let opts_json = serde_json::to_string(&options).unwrap();
        let _ = stdin.write_all(opts_json.as_bytes()).await;
    }

    let output = child.wait_with_output().await.map_err(internal_error)?;
    if let Ok(result_str) = String::from_utf8(output.stdout) {
        if let Ok(val) = serde_json::from_str::<serde_json::Value>(result_str.trim()) {
            return Ok(Json(val));
        }
    }
    
    Ok(Json(serde_json::Value::Null))
}

pub fn run_sync_dialog(mode: &str, options: serde_json::Value) {
    let options: OpenOptions = serde_json::from_value(options).unwrap_or(OpenOptions {
        directory: None,
        filters: None,
        multiple: None,
        default_path: None,
        title: None,
    });

    match mode {
        "open" => {
            let mut dialog = rfd::FileDialog::new();
            if let Some(title) = options.title {
                dialog = dialog.set_title(&title);
            }
            if let Some(path) = options.default_path {
                dialog = dialog.set_directory(path);
            }
            if let Some(filters) = options.filters {
                for f in filters {
                    let exts: Vec<&str> = f.extensions.iter().map(|s| s.as_str()).collect();
                    dialog = dialog.add_filter(&f.name, &exts);
                }
            }

            if options.directory == Some(true) {
                if let Some(path) = dialog.pick_folder() {
                    println!("{}", path.to_string_lossy());
                }
            } else if options.multiple == Some(true) {
                if let Some(paths) = dialog.pick_files() {
                    let result: Vec<String> = paths.into_iter().map(|p| p.to_string_lossy().to_string()).collect();
                    println!("{}", serde_json::to_string(&result).unwrap());
                }
            } else {
                if let Some(path) = dialog.pick_file() {
                    println!("{}", path.to_string_lossy());
                }
            }
        }
        "save" => {
            let mut dialog = rfd::FileDialog::new();
            if let Some(title) = options.title {
                dialog = dialog.set_title(&title);
            }
            if let Some(path) = options.default_path {
                let p = std::path::Path::new(&path);
                if p.is_dir() {
                    dialog = dialog.set_directory(path);
                } else {
                    if let Some(parent) = p.parent() {
                        if !parent.as_os_str().is_empty() {
                            dialog = dialog.set_directory(parent);
                        }
                    }
                    if let Some(file_name) = p.file_name() {
                        dialog = dialog.set_file_name(&file_name.to_string_lossy());
                    }
                }
            }
            if let Some(filters) = options.filters {
                for f in filters {
                    let exts: Vec<&str> = f.extensions.iter().map(|s| s.as_str()).collect();
                    dialog = dialog.add_filter(&f.name, &exts);
                }
            }
            if let Some(path) = dialog.save_file() {
                println!("{}", path.to_string_lossy());
            }
        }
        _ => {}
    }
}

async fn save_dialog(Json(options): Json<OpenOptions>) -> Result<Json<Option<String>>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    let current_exe = std::env::current_exe().map_err(internal_error)?;
    let mut child = tokio::process::Command::new(current_exe)
        .arg("--dialog")
        .arg("save")
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .spawn()
        .map_err(internal_error)?;

    if let Some(mut stdin) = child.stdin.take() {
        use tokio::io::AsyncWriteExt;
        let opts_json = serde_json::to_string(&options).unwrap();
        let _ = stdin.write_all(opts_json.as_bytes()).await;
    }

    let output = child.wait_with_output().await.map_err(internal_error)?;
    if let Ok(result_str) = String::from_utf8(output.stdout) {
        if let Ok(val) = serde_json::from_str::<Option<String>>(result_str.trim()) {
            return Ok(Json(val));
        }
    }
    
    Ok(Json(None))
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

async fn shutdown(Query(query): Query<ShutdownQuery>) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, Json<serde_json::Value>)> {
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
    let app_data_dir = paths::get_app_data_dir().map_err(internal_error)?;
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

#[derive(Deserialize)]
struct EventQuery {
    event: Option<String>,
}

async fn events_stream(
    State(state): State<super::super::AppState>,
    Query(query): Query<EventQuery>,
) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    let receiver = state.event_sender.subscribe();
    let target_event = query.event;
    
    let stream = BroadcastStream::new(receiver).filter_map(move |msg| {
        let target = target_event.clone();
        async move {
            match msg {
                Ok(evt) => {
                    // Multiplexing logic:
                    // If target_event is specified, only return matching events.
                    // If target_event is NOT specified (multiplexed mode), return everything.
                    if let Some(ref t) = target {
                        if evt.event != *t {
                            return None;
                        }
                    }
                    
                    if let Ok(evt_json) = serde_json::to_string(&evt) {
                        Some(Ok(Event::default().data(evt_json)))
                    } else {
                        None
                    }
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
    let app_data_dir = paths::get_app_data_dir().map_err(internal_error)?;
    crate::directory::create_directory_structure(&app_data_dir).await.map_err(internal_error)?;
    Ok(())
}

async fn backup_user_data_route() -> Result<Json<String>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    update_commands::backup_user_data().await.map(Json).map_err(internal_error)
}

async fn restore_from_backup_route(Json(backup_path): Json<String>) -> Result<Json<String>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    update_commands::restore_from_backup(backup_path).await.map(|_| Json("Success".to_string())).map_err(internal_error)
}

async fn list_backups_route() -> Result<Json<Vec<String>>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    update_commands::list_backups().await.map(Json).map_err(internal_error)
}

async fn get_installation_status() -> Result<Json<crate::installer::InstallationConfig>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    installation_commands::check_installation_status().await.map(Json).map_err(internal_error)
}
