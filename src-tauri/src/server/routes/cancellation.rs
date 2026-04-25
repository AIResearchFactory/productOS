use crate::services::cancellation_service::CancellationService;
use axum::{routing::post, Json, Router};
use super::utils::internal_error;

pub fn router() -> Router<super::super::AppState> {
    Router::new()
        .route("/stop", post(stop_agent_execution))
}

async fn stop_agent_execution() -> Result<(), (axum::http::StatusCode, Json<serde_json::Value>)> {
    CancellationService::global()
        .cancel_process("chat")
        .await
        .map_err(internal_error)
}
