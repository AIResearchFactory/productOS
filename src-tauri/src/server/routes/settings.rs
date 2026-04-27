use crate::commands::settings_commands;
use crate::models::settings::{GlobalSettings, ProjectSettings};
use crate::models::ai::{CustomCliConfig, ProviderType};
use crate::models::cost::UsageStatistics;
use axum::{extract::{Query, State}, routing::{get, post}, Json, Router};
use serde::Deserialize;
use super::utils::internal_error;
use serde_json::json;

pub fn router() -> Router<super::super::AppState> {
    Router::new()
        .route("/global", get(get_global_settings).post(save_global_settings))
        .route("/project", get(get_project_settings).post(save_project_settings))
        .route("/usage", get(get_usage_statistics))
        .route("/custom_cli", post(add_custom_cli).delete(remove_custom_cli))
        .route("/providers", get(list_available_providers))
        .route("/paths", get(get_settings_paths))
}

#[derive(Deserialize)]
struct ProjectQuery {
    project_id: String,
}

#[derive(Deserialize)]
struct RemoveCliRequest {
    name: String,
}

async fn get_global_settings() -> Result<Json<GlobalSettings>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    settings_commands::get_global_settings().await.map(Json).map_err(internal_error)
}

async fn save_global_settings(Json(settings): Json<GlobalSettings>) -> Result<(), (axum::http::StatusCode, Json<serde_json::Value>)> {
    settings_commands::save_global_settings(settings).await.map_err(internal_error)?;
    Ok(())
}

async fn get_project_settings(Query(q): Query<ProjectQuery>) -> Result<Json<Option<ProjectSettings>>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    settings_commands::get_project_settings(q.project_id).await.map(Json).map_err(internal_error)
}

async fn save_project_settings(
    State(state): State<super::super::AppState>,
    Query(q): Query<ProjectQuery>, 
    Json(settings): Json<ProjectSettings>
) -> Result<(), (axum::http::StatusCode, Json<serde_json::Value>)> {
    settings_commands::save_project_settings(q.project_id.clone(), settings).await.map_err(internal_error)?;
    
    let event = json!({
        "event": "project-modified",
        "payload": q.project_id
    });
    let _ = state.event_sender.send(event.to_string());
    
    Ok(())
}

async fn get_usage_statistics() -> Result<Json<UsageStatistics>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    settings_commands::get_usage_statistics(None).await.map(Json).map_err(internal_error)
}

async fn add_custom_cli(Json(config): Json<CustomCliConfig>) -> Result<(), (axum::http::StatusCode, Json<serde_json::Value>)> {
    settings_commands::add_custom_cli(config).await.map_err(internal_error)?;
    Ok(())
}

async fn remove_custom_cli(Query(req): Query<RemoveCliRequest>) -> Result<(), (axum::http::StatusCode, Json<serde_json::Value>)> {
    settings_commands::remove_custom_cli(req.name).await.map_err(internal_error)?;
    Ok(())
}

async fn list_available_providers() -> Result<Json<Vec<ProviderType>>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    settings_commands::list_available_providers().await.map(Json).map_err(internal_error)
}

#[derive(serde::Serialize)]
struct SettingsPathsResponse {
    global_settings_path: String,
    secrets_path: String,
}

async fn get_settings_paths() -> Result<Json<SettingsPathsResponse>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    let global_settings_path = settings_commands::get_global_settings_path().await.map_err(internal_error)?;
    let secrets_path = settings_commands::get_secrets_path().await.map_err(internal_error)?;
    
    Ok(Json(SettingsPathsResponse {
        global_settings_path,
        secrets_path,
    }))
}
