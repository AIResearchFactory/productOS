use crate::commands::project_commands;
use crate::models::project::Project;
use axum::{extract::{Query, State}, routing::{get, post, delete}, Json, Router};
use serde::Deserialize;
use super::utils::internal_error;
use serde_json::json;

pub fn router() -> Router<super::super::AppState> {
    Router::new()
        .route("/", get(get_all_projects))
        .route("/get", get(get_project))
        .route("/create", post(create_project))
        .route("/files", get(get_project_files))
        .route("/delete", delete(delete_project))
        .route("/rename", post(rename_project))
        .route("/cost", get(get_project_cost))
}

fn emit_project_modified(state: &super::super::AppState, project_id: &str) {
    let event = json!({
        "event": "project-modified",
        "payload": project_id
    });
    let _ = state.event_sender.send(event.to_string());
}

async fn get_all_projects() -> Result<Json<Vec<Project>>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    project_commands::get_all_projects()
        .await
        .map(Json)
        .map_err(internal_error)
}

#[derive(Deserialize)]
struct ProjectIdQuery {
    project_id: String,
}

async fn get_project(Query(q): Query<ProjectIdQuery>) -> Result<Json<Project>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    project_commands::get_project(q.project_id)
        .await
        .map(Json)
        .map_err(|e| {
            if e.to_string().to_lowercase().contains("not found") {
                (axum::http::StatusCode::NOT_FOUND, Json(serde_json::json!({ "error": e.to_string() })))
            } else {
                internal_error(e)
            }
        })
}

#[derive(Deserialize)]
struct CreateProjectRequest {
    name: String,
    goal: String,
    skills: Vec<String>,
}

async fn create_project(
    State(state): State<super::super::AppState>,
    Json(req): Json<CreateProjectRequest>
) -> Result<Json<Project>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    let project = project_commands::create_project(req.name, req.goal, req.skills)
        .await
        .map_err(internal_error)?;
    
    let event = json!({
        "event": "project-added",
        "payload": project
    });
    let _ = state.event_sender.send(event.to_string());

    Ok(Json(project))
}

async fn get_project_files(Query(q): Query<ProjectIdQuery>) -> Result<Json<Vec<String>>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    project_commands::get_project_files(q.project_id)
        .await
        .map(Json)
        .map_err(|e| {
            if e.to_string().to_lowercase().contains("not found") {
                (axum::http::StatusCode::NOT_FOUND, Json(serde_json::json!({ "error": e.to_string() })))
            } else {
                internal_error(e)
            }
        })
}

async fn delete_project(
    State(state): State<super::super::AppState>,
    Query(q): Query<ProjectIdQuery>
) -> Result<(), (axum::http::StatusCode, Json<serde_json::Value>)> {
    project_commands::delete_project(q.project_id.clone())
        .await
        .map_err(internal_error)?;
    
    let event = json!({
        "event": "project-removed",
        "payload": q.project_id
    });
    let _ = state.event_sender.send(event.to_string());

    Ok(())
}

#[derive(Deserialize)]
struct RenameProjectRequest {
    project_id: String,
    new_name: String,
}

async fn rename_project(
    State(state): State<super::super::AppState>,
    Json(req): Json<RenameProjectRequest>
) -> Result<(), (axum::http::StatusCode, Json<serde_json::Value>)> {
    project_commands::rename_project(req.project_id.clone(), req.new_name)
        .await
        .map_err(internal_error)?;
    
    emit_project_modified(&state, &req.project_id);
    Ok(())
}

async fn get_project_cost(Query(q): Query<ProjectIdQuery>) -> Result<Json<f64>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    project_commands::get_project_cost(q.project_id)
        .await
        .map(Json)
        .map_err(internal_error)
}
