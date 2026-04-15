use app_lib::models::ai::Message;
use axum::{extract::State, routing::post, Json, Router};
use serde::{Deserialize, Serialize};
use super::utils::internal_error;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SendMessageRequest {
    messages: Vec<Message>,
    project_id: Option<String>,
    #[allow(dead_code)]
    skill_id: Option<String>,
}

#[derive(Serialize)]
struct SendMessageResponse {
    content: String,
}

async fn send_message(
    State(state): State<super::super::AppState>,
    Json(req): Json<SendMessageRequest>,
) -> Result<Json<SendMessageResponse>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    let response = state
        .orchestrator
        .run_agent_loop(
            req.messages,
            None, // System prompt handled internally by orchestrator
            req.project_id,
            req.skill_id,
            None, // skill_params
        )
        .await
        .map_err(internal_error)?;

    Ok(Json(SendMessageResponse {
        content: response.content,
    }))
}

async fn get_completion(
    State(state): State<super::super::AppState>,
    Json(req): Json<SendMessageRequest>,
) -> Result<Json<SendMessageResponse>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    let response = state
        .ai_service
        .completion(req.messages, None, req.project_id)
        .await
        .map_err(internal_error)?;

    Ok(Json(SendMessageResponse {
        content: response.content,
    }))
}

pub fn router() -> Router<super::super::AppState> {
    Router::new()
        .route("/send", post(send_message))
        .route("/completion", post(get_completion))
}

