use app_lib::commands::installation_commands;
use app_lib::detector;
use axum::{routing::{get, post}, Json, Router};
use super::utils::internal_error;

pub fn router() -> Router<super::super::AppState> {
    Router::new()
        .route("/detect/claude", get(detect_claude))
        .route("/detect/ollama", get(detect_ollama))
        .route("/detect/gemini", get(detect_gemini))
        .route("/detect/openai", get(detect_openai))
        .route("/detect/clear-cache", post(clear_all_caches))
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
