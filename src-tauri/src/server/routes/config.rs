use app_lib::commands::config_commands;
use app_lib::config::AppConfig;
use axum::{routing::{get, post, delete}, Json, Router};
use serde::Deserialize;
use super::utils::internal_error;

pub fn router() -> Router<super::super::AppState> {
    Router::new()
        .route("/", get(get_app_config).post(save_app_config))
        .route("/exists", get(config_exists))
        .route("/claude", post(update_claude_code_config))
        .route("/ollama", post(update_ollama_config))
        .route("/last-check", post(update_last_check))
        .route("/reset", delete(reset_config))
}

async fn get_app_config() -> Result<Json<Option<AppConfig>>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    config_commands::get_app_config()
        .await
        .map(Json)
        .map_err(internal_error)
}

async fn save_app_config(Json(config): Json<AppConfig>) -> Result<(), (axum::http::StatusCode, Json<serde_json::Value>)> {
    config_commands::save_app_config(config)
        .await
        .map_err(internal_error)
}

async fn config_exists() -> Result<Json<bool>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    config_commands::config_exists()
        .await
        .map(Json)
        .map_err(internal_error)
}

#[derive(Deserialize)]
struct UpdateClaudeRequest {
    enabled: bool,
    path: Option<String>,
}

async fn update_claude_code_config(Json(req): Json<UpdateClaudeRequest>) -> Result<Json<AppConfig>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    config_commands::update_claude_code_config(req.enabled, req.path)
        .await
        .map(Json)
        .map_err(internal_error)
}

#[derive(Deserialize)]
struct UpdateOllamaRequest {
    enabled: bool,
    path: Option<String>,
}

async fn update_ollama_config(Json(req): Json<UpdateOllamaRequest>) -> Result<Json<AppConfig>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    config_commands::update_ollama_config(req.enabled, req.path)
        .await
        .map(Json)
        .map_err(internal_error)
}

async fn update_last_check() -> Result<Json<AppConfig>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    config_commands::update_last_check()
        .await
        .map(Json)
        .map_err(internal_error)
}

async fn reset_config() -> Result<(), (axum::http::StatusCode, Json<serde_json::Value>)> {
    config_commands::reset_config()
        .await
        .map_err(internal_error)
}
