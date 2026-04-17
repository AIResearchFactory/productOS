use app_lib::commands::markdown_commands;
use app_lib::services::markdown_service::TocEntry;
use axum::{routing::post, Json, Router};
use serde::Deserialize;
use super::utils::internal_error;

pub fn router() -> Router<super::super::AppState> {
    Router::new()
        .route("/render", post(render_markdown_to_html))
        .route("/links", post(extract_markdown_links))
        .route("/toc", post(generate_markdown_toc))
}

#[derive(Deserialize)]
struct MarkdownRequest {
    markdown: String,
}

async fn render_markdown_to_html(Json(req): Json<MarkdownRequest>) -> Result<Json<String>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    markdown_commands::render_markdown_to_html(req.markdown)
        .await
        .map(Json)
        .map_err(internal_error)
}

async fn extract_markdown_links(Json(req): Json<MarkdownRequest>) -> Result<Json<Vec<String>>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    markdown_commands::extract_markdown_links(req.markdown)
        .await
        .map(Json)
        .map_err(internal_error)
}

async fn generate_markdown_toc(Json(req): Json<MarkdownRequest>) -> Result<Json<Vec<TocEntry>>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    markdown_commands::generate_markdown_toc(req.markdown)
        .await
        .map(Json)
        .map_err(internal_error)
}
