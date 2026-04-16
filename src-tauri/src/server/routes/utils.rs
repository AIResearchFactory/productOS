use axum::{http::StatusCode, Json};
use serde_json::json;

pub fn internal_error<E: std::fmt::Display>(err: E) -> (StatusCode, Json<serde_json::Value>) {
    tracing::error!(error = %err, "Internal server error");
    (
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(json!({ "error": err.to_string() })),
    )
}
