use crate::commands::artifact_commands;
use crate::models::artifact::{Artifact, ArtifactType};
use axum::{extract::Query, routing::{get, post, put, delete}, Json, Router};
use serde::Deserialize;
use super::utils::internal_error;

pub fn router() -> Router<super::super::AppState> {
    Router::new()
        .route("/create", post(create_artifact))
        .route("/get", get(get_artifact))
        .route("/list", get(list_artifacts))
        .route("/save", put(save_artifact))
        .route("/delete", delete(delete_artifact))
        .route("/import", post(import_artifact))
        .route("/export", post(export_artifact))
        .route("/update-metadata", post(update_artifact_metadata))
}

#[derive(Deserialize)]
struct CreateArtifactRequest {
    project_id: String,
    artifact_type: ArtifactType,
    title: String,
}

async fn create_artifact(Json(req): Json<CreateArtifactRequest>) -> Result<Json<Artifact>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    artifact_commands::create_artifact(req.project_id, req.artifact_type, req.title)
        .await
        .map(Json)
        .map_err(internal_error)
}

#[derive(Deserialize)]
struct GetArtifactQuery {
    project_id: String,
    artifact_type: ArtifactType,
    artifact_id: String,
}

async fn get_artifact(Query(q): Query<GetArtifactQuery>) -> Result<Json<Artifact>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    artifact_commands::get_artifact(q.project_id, q.artifact_type, q.artifact_id)
        .await
        .map(Json)
        .map_err(internal_error)
}

#[derive(Deserialize)]
struct ListArtifactsQuery {
    project_id: String,
    artifact_type: Option<ArtifactType>,
}

async fn list_artifacts(Query(q): Query<ListArtifactsQuery>) -> Result<Json<Vec<Artifact>>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    artifact_commands::list_artifacts(q.project_id, q.artifact_type)
        .await
        .map(Json)
        .map_err(internal_error)
}

async fn save_artifact(Json(artifact): Json<Artifact>) -> Result<(), (axum::http::StatusCode, Json<serde_json::Value>)> {
    artifact_commands::save_artifact(artifact)
        .await
        .map_err(internal_error)
}

#[derive(Deserialize)]
struct DeleteArtifactQuery {
    project_id: String,
    artifact_type: ArtifactType,
    artifact_id: String,
}

async fn delete_artifact(Query(q): Query<DeleteArtifactQuery>) -> Result<(), (axum::http::StatusCode, Json<serde_json::Value>)> {
    artifact_commands::delete_artifact(q.project_id, q.artifact_type, q.artifact_id)
        .await
        .map_err(internal_error)
}

#[derive(Deserialize)]
struct ImportArtifactRequest {
    project_id: String,
    artifact_type: ArtifactType,
    source_path: String,
}

async fn import_artifact(Json(req): Json<ImportArtifactRequest>) -> Result<Json<Artifact>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    artifact_commands::import_artifact(req.project_id, req.artifact_type, req.source_path)
        .await
        .map(Json)
        .map_err(internal_error)
}

#[derive(Deserialize)]
struct ExportArtifactRequest {
    project_id: String,
    artifact_id: String,
    artifact_type: ArtifactType,
    target_path: String,
    export_format: String,
}

async fn export_artifact(Json(req): Json<ExportArtifactRequest>) -> Result<(), (axum::http::StatusCode, Json<serde_json::Value>)> {
    artifact_commands::export_artifact(req.project_id, req.artifact_id, req.artifact_type, req.target_path, req.export_format)
        .await
        .map_err(internal_error)
}

#[derive(Deserialize)]
struct UpdateArtifactMetadataRequest {
    project_id: String,
    artifact_type: ArtifactType,
    artifact_id: String,
    title: Option<String>,
    confidence: Option<f64>,
}

async fn update_artifact_metadata(Json(req): Json<UpdateArtifactMetadataRequest>) -> Result<(), (axum::http::StatusCode, Json<serde_json::Value>)> {
    artifact_commands::update_artifact_metadata(req.project_id, req.artifact_type, req.artifact_id, req.title, req.confidence)
        .await
        .map_err(internal_error)
}
