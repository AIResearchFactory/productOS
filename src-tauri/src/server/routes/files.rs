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

async fn write_file(
    State(state): State<super::super::AppState>,
    Json(req): Json<WriteFileRequest>
) -> Result<(), (axum::http::StatusCode, Json<serde_json::Value>)> {
    file_commands::write_markdown_file(req.project_id.clone(), req.file_name.clone(), req.content)
        .await
        .map_err(internal_error)?;
    
    let _ = state.event_sender.send(crate::server::GenericEvent {
        event: "file-changed".to_string(),
        payload: serde_json::json!((req.project_id, req.file_name)),
    });

    Ok(())
}

async fn delete_file(
    State(state): State<super::super::AppState>,
    Query(q): Query<FileQuery>
) -> Result<(), (axum::http::StatusCode, Json<serde_json::Value>)> {
    file_commands::delete_markdown_file(q.project_id.clone(), q.file_name.clone())
        .await
        .map_err(internal_error)?;
    
    let _ = state.event_sender.send(crate::server::GenericEvent {
        event: "file-changed".to_string(),
        payload: serde_json::json!((q.project_id, q.file_name)),
    });

    Ok(())
}

#[derive(Deserialize)]
struct RenameFileRequest {
    project_id: String,
    old_name: String,
    new_name: String,
}

async fn rename_file(
    State(state): State<super::super::AppState>,
    Json(req): Json<RenameFileRequest>
) -> Result<(), (axum::http::StatusCode, Json<serde_json::Value>)> {
    file_commands::rename_markdown_file(req.project_id.clone(), req.old_name.clone(), req.new_name.clone())
        .await
        .map_err(internal_error)?;
    
    let _ = state.event_sender.send(crate::server::GenericEvent {
        event: "file-changed".to_string(),
        payload: serde_json::json!((req.project_id, req.new_name)),
    });

    Ok(())
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

async fn replace_in_files(
    State(state): State<super::super::AppState>,
    Json(req): Json<ReplaceRequest>
) -> Result<Json<usize>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    let count = file_commands::replace_in_files(req.project_id.clone(), req.search_text, req.replace_text, req.case_sensitive, req.file_names)
        .await
        .map_err(internal_error)?;
    
    let _ = state.event_sender.send(crate::server::GenericEvent {
        event: "file-changed".to_string(),
        payload: serde_json::json!((req.project_id, "multiple".to_string())),
    });

    Ok(Json(count))
}

#[derive(Deserialize)]
struct ImportRequest {
    project_id: String,
    source_path: String,
}

async fn import_document(
    State(state): State<super::super::AppState>,
    Json(req): Json<ImportRequest>
) -> Result<Json<String>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    let new_name = file_commands::import_document(req.project_id.clone(), req.source_path)
        .await
        .map_err(internal_error)?;
    
    let _ = state.event_sender.send(crate::server::GenericEvent {
        event: "file-changed".to_string(),
        payload: serde_json::json!((req.project_id, new_name.clone())),
    });

    Ok(Json(new_name))
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
    let new_name = file_commands::import_transcript(req.project_id.clone(), req.source_path, state.ai_service.clone())
        .await
        .map_err(internal_error)?;
    
    let _ = state.event_sender.send(crate::server::GenericEvent {
        event: "file-changed".to_string(),
        payload: serde_json::json!((req.project_id, new_name.clone())),
    });

    Ok(Json(new_name))
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
