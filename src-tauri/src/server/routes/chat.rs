use app_lib::commands::chat_commands;
use axum::{routing::{get, post}, Json, Router};
use serde::Deserialize;
use super::utils::internal_error;


pub fn router() -> Router<super::super::AppState> {
    Router::new()
        // Note: For endpoints requiring State / State<Arc<AgentOrchestrator>> 
        // we might need to manually extract from Axum state or adjust the command.
        // For now, we stub or skip complex ones if they require Tauri AppHandle.
}
