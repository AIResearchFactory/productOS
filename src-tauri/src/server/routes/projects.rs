use app_lib::commands::project_commands;
use app_lib::models::project::Project;
use axum::{routing::get, Json, Router};
use super::utils::internal_error;

pub fn router() -> Router<super::super::AppState> {
    Router::new()
        .route("/", get(get_all_projects))
}

async fn get_all_projects() -> Result<Json<Vec<Project>>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    project_commands::get_all_projects()
        .await
        .map(Json)
        .map_err(internal_error)
}
