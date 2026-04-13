use app_lib::commands::settings_commands;
use app_lib::models::settings::{GlobalSettings, ProjectSettings};
use app_lib::models::ai::{CustomCliConfig, ProviderType};
use app_lib::models::cost::UsageStatistics;
use axum::{extract::Query, routing::{get, post, delete}, Json, Router};
use serde::{Deserialize, Serialize};
use super::utils::internal_error;

pub fn router() -> Router<super::super::AppState> {
    Router::new()
        .route("/global", get(get_global_settings).post(save_global_settings))
        .route("/project", get(get_project_settings).post(save_project_settings))
        .route("/usage", get(get_usage_statistics))
        .route("/custom_cli", post(add_custom_cli).delete(remove_custom_cli))
        .route("/providers", get(list_available_providers))
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

async fn save_project_settings(Query(q): Query<ProjectQuery>, Json(settings): Json<ProjectSettings>) -> Result<(), (axum::http::StatusCode, Json<serde_json::Value>)> {
    settings_commands::save_project_settings(q.project_id, settings).await.map_err(internal_error)?;
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
