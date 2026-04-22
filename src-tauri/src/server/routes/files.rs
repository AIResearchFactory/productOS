use crate::commands::file_commands::{self, SearchMatch};
use axum::{extract::{Query, State}, routing::{get, post, put, delete}, Json, Router};
use serde::Deserialize;
use super::utils::internal_error;

pub fn router() -> Router<super::super::AppState> {
    Router::new()
        .route("/read", get(read_file))
        .route("/exists", get(check_file_exists))
        .route("/write", put(write_file))
        .route("/delete", delete(delete_file))
        .route("/rename", post(rename_file))
        .route("/search", post(search_in_files))
        .route("/replace", post(replace_in_files))
        .route("/import", post(import_document))
        .route("/import/transcript", post(import_transcript))
        .route("/export", post(export_document))
}

#[derive(Deserialize)]
struct FileQuery {
    project_id: String,
    file_name: String,
}

async fn read_file(Query(q): Query<FileQuery>) -> Result<Json<String>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    file_commands::read_markdown_file(q.project_id, q.file_name)
        .await
        .map(Json)
        .map_err(|e| {
            if e.to_string().contains("File does not exist") {
                (axum::http::StatusCode::NOT_FOUND, Json(serde_json::json!({ "error": e.to_string() })))
            } else {
                internal_error(e)
            }
        })
}

async fn check_file_exists(Query(q): Query<FileQuery>) -> Result<Json<bool>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    file_commands::check_file_exists(q.project_id, q.file_name)
        .await
        .map(Json)
        .map_err(internal_error)
}

#[derive(Deserialize)]
struct WriteFileRequest {
    project_id: String,
    file_name: String,
    content: String,
}

async fn write_file(Json(req): Json<WriteFileRequest>) -> Result<(), (axum::http::StatusCode, Json<serde_json::Value>)> {
    file_commands::write_markdown_file(req.project_id, req.file_name, req.content)
        .await
        .map_err(internal_error)
}

async fn delete_file(Query(q): Query<FileQuery>) -> Result<(), (axum::http::StatusCode, Json<serde_json::Value>)> {
    file_commands::delete_markdown_file(q.project_id, q.file_name)
        .await
        .map_err(internal_error)
}

#[derive(Deserialize)]
struct RenameFileRequest {
    project_id: String,
    old_name: String,
    new_name: String,
}

async fn rename_file(Json(req): Json<RenameFileRequest>) -> Result<(), (axum::http::StatusCode, Json<serde_json::Value>)> {
    file_commands::rename_markdown_file(req.project_id, req.old_name, req.new_name)
        .await
        .map_err(internal_error)
}

#[derive(Deserialize)]
struct SearchRequest {
    project_id: String,
    search_text: String,
    case_sensitive: bool,
    use_regex: bool,
}

async fn search_in_files(Json(req): Json<SearchRequest>) -> Result<Json<Vec<SearchMatch>>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    file_commands::search_in_files(req.project_id, req.search_text, req.case_sensitive, req.use_regex)
        .await
        .map(Json)
        .map_err(internal_error)
}

#[derive(Deserialize)]
struct ReplaceRequest {
    project_id: String,
    search_text: String,
    replace_text: String,
    case_sensitive: bool,
    file_names: Vec<String>,
}

async fn replace_in_files(Json(req): Json<ReplaceRequest>) -> Result<Json<usize>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    file_commands::replace_in_files(req.project_id, req.search_text, req.replace_text, req.case_sensitive, req.file_names)
        .await
        .map(Json)
        .map_err(internal_error)
}

#[derive(Deserialize)]
struct ImportRequest {
    project_id: String,
    source_path: String,
}

async fn import_document(Json(req): Json<ImportRequest>) -> Result<Json<String>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    file_commands::import_document(req.project_id, req.source_path)
        .await
        .map(Json)
        .map_err(internal_error)
}

#[derive(Deserialize)]
struct ImportTranscriptRequest {
    project_id: String,
    source_path: String,
}

async fn import_transcript(
    State(state): State<super::super::AppState>,
    Json(req): Json<ImportTranscriptRequest>,
) -> Result<Json<String>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    file_commands::import_transcript(req.project_id, req.source_path, state.ai_service.clone())
        .await
        .map(Json)
        .map_err(internal_error)
}

#[derive(Deserialize)]
struct ExportDocumentRequest {
    project_id: String,
    file_name: String,
    target_path: String,
    export_format: String,
}

async fn export_document(Json(req): Json<ExportDocumentRequest>) -> Result<(), (axum::http::StatusCode, Json<serde_json::Value>)> {
    file_commands::export_document(req.project_id, req.file_name, req.target_path, req.export_format)
        .await
        .map_err(internal_error)
}
