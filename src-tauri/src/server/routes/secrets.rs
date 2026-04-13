use app_lib::commands::secrets_commands;
use axum::{extract::Query, routing::{get, post}, Json, Router};
use serde::{Deserialize, Serialize};
use super::utils::internal_error;

pub fn router() -> Router<super::super::AppState> {
    Router::new()
        .route("/has", get(has_secret))
        .route("/get", get(get_secret))
        .route("/set", post(set_secret))
        .route("/list", get(list_secrets))
}

#[derive(Deserialize)]
struct SecretQuery {
    id: String,
}

#[derive(Serialize)]
struct HasSecretResponse {
    has_secret: bool,
}

#[derive(Serialize)]
struct GetSecretResponse {
    value: Option<String>,
}

#[derive(Deserialize)]
struct SetSecretRequest {
    id: String,
    value: String,
}

async fn has_secret(Query(q): Query<SecretQuery>) -> Result<Json<HasSecretResponse>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    let result = secrets_commands::has_secret(q.id).await.map_err(internal_error)?;
    Ok(Json(HasSecretResponse { has_secret: result }))
}

async fn get_secret(Query(q): Query<SecretQuery>) -> Result<Json<GetSecretResponse>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    let val = app_lib::services::secrets_service::SecretsService::get_secret(&q.id)
        .map_err(internal_error)?;
    Ok(Json(GetSecretResponse { value: val }))
}

async fn set_secret(Json(req): Json<SetSecretRequest>) -> Result<(), (axum::http::StatusCode, Json<serde_json::Value>)> {
    app_lib::services::secrets_service::SecretsService::set_secret(&req.id, &req.value).map_err(internal_error)?;
    Ok(())
}

async fn list_secrets() -> Result<Json<Vec<String>>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    secrets_commands::list_saved_secret_ids().await.map(Json).map_err(internal_error)
}
