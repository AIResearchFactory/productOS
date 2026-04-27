use axum::{
    extract::{State, Json},
    response::sse::{Event, Sse},
    routing::{get, post},
    Router,
};
use futures_util::stream::Stream;
use serde::Deserialize;
use std::convert::Infallible;
use tokio_stream::StreamExt;
use tokio_stream::wrappers::BroadcastStream;
use crate::utils::paths;
use crate::commands::installation_commands;
use crate::utils::detector;
use crate::server::utils::internal_error;

#[derive(Deserialize)]
struct EventQuery {
    event: Option<String>,
}

pub fn router() -> Router<super::super::AppState> {
    Router::new()
        .route("/data-dir", get(get_data_directory))
        .route("/detect/claude", get(detect_claude))
        .route("/detect/ollama", get(detect_ollama))
        .route("/detect/gemini", get(detect_gemini))
        .route("/detect/openai", get(detect_openai))
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
    installation_commands::detect_openai().await.map(Json).map_err(internal_error)
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
                Ok(evt_json) => {
                    // Multiplexing logic:
                    // If target_event is specified, only return matching events.
                    // If target_event is NOT specified (multiplexed mode), return everything.
                    if let Some(ref t) = target {
                        // Attempt to parse to check event type
                        if let Ok(val) = serde_json::from_str::<serde_json::Value>(&evt_json) {
                            if val["event"] != *t {
                                return None;
                            }
                        } else {
                            return None;
                        }
                    }
                    Some(Ok(Event::default().data(evt_json)))
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
    installation_commands::backup_user_data().await.map(Json).map_err(internal_error)
}

async fn restore_from_backup_route(Json(backup_path): Json<String>) -> Result<Json<String>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    installation_commands::restore_from_backup(backup_path).await.map(Json).map_err(internal_error)
}

async fn list_backups_route() -> Result<Json<Vec<String>>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    installation_commands::list_backups().await.map(Json).map_err(internal_error)
}
