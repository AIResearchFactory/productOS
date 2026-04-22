use axum::{routing::{get, post}, Json, Router};
use app_lib::commands::settings_commands::{
    authenticate_gemini_internal, authenticate_openai_internal, get_google_auth_status, get_openai_auth_status,
    logout_google, logout_openai, GoogleAuthStatus, OpenAiAuthStatus,
};
use super::utils::internal_error;

async fn gemini_login() -> Result<Json<String>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    authenticate_gemini_internal()
        .await
        .map(Json)
        .map_err(internal_error)
}

async fn gemini_status() -> Result<Json<GoogleAuthStatus>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    get_google_auth_status()
        .await
        .map(Json)
        .map_err(internal_error)
}

async fn gemini_logout() -> Result<Json<String>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    logout_google()
        .await
        .map(Json)
        .map_err(internal_error)
}

async fn openai_login() -> Result<Json<String>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    authenticate_openai_internal()
        .await
        .map(Json)
        .map_err(internal_error)
}

async fn openai_status() -> Result<Json<OpenAiAuthStatus>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    get_openai_auth_status()
        .await
        .map(Json)
        .map_err(internal_error)
}

async fn openai_logout() -> Result<Json<String>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    logout_openai()
        .await
        .map(Json)
        .map_err(internal_error)
}

pub fn router() -> Router<super::super::AppState> {
    Router::new()
        .route("/gemini/login", post(gemini_login))
        .route("/gemini/status", get(gemini_status))
        .route("/gemini/logout", post(gemini_logout))
        .route("/openai/login", post(openai_login))
        .route("/openai/status", get(openai_status))
        .route("/openai/logout", post(openai_logout))
}
