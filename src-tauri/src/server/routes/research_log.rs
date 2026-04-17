use app_lib::commands::research_log_commands;
use app_lib::models::research_log::ResearchLogEntry;
use axum::{extract::Query, routing::{get, post}, Json, Router};
use serde::Deserialize;
use super::utils::internal_error;

pub fn router() -> Router<super::super::AppState> {
    Router::new()
        .route("/", get(get_research_log))
        .route("/clear", post(clear_research_log))
}

#[derive(Deserialize)]
struct ProjectQuery {
    project_id: String,
}

async fn get_research_log(Query(q): Query<ProjectQuery>) -> Result<Json<Vec<ResearchLogEntry>>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    research_log_commands::get_research_log(q.project_id)
        .await
        .map(Json)
        .map_err(internal_error)
}

async fn clear_research_log(Json(q): Json<ProjectQuery>) -> Result<(), (axum::http::StatusCode, Json<serde_json::Value>)> {
    research_log_commands::clear_research_log(q.project_id)
        .await
        .map_err(internal_error)
}
