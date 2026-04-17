use app_lib::commands::mcp;
use app_lib::models::mcp::McpServerConfig;
use axum::{extract::Query, routing::{get, post, put, delete}, Json, Router};
use serde::Deserialize;
use super::utils::internal_error;

pub fn router() -> Router<super::super::AppState> {
    Router::new()
        .route("/servers", get(get_mcp_servers))
        .route("/servers/add", post(add_mcp_server))
        .route("/servers/remove", delete(remove_mcp_server))
        .route("/servers/toggle", post(toggle_mcp_server))
        .route("/servers/update", put(update_mcp_server))
        .route("/marketplace", get(fetch_marketplace))
        .route("/sync", post(sync_mcp_with_clis))
        .route("/litellm/test", post(test_litellm_connection))
}

async fn get_mcp_servers() -> Result<Json<Vec<McpServerConfig>>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    mcp::get_mcp_servers()
        .await
        .map(Json)
        .map_err(internal_error)
}

async fn add_mcp_server(Json(config): Json<McpServerConfig>) -> Result<(), (axum::http::StatusCode, Json<serde_json::Value>)> {
    mcp::add_mcp_server(config)
        .await
        .map_err(internal_error)
}

#[derive(Deserialize)]
struct RemoveQuery {
    id: String,
}

async fn remove_mcp_server(Query(q): Query<RemoveQuery>) -> Result<(), (axum::http::StatusCode, Json<serde_json::Value>)> {
    mcp::remove_mcp_server(q.id)
        .await
        .map_err(internal_error)
}

#[derive(Deserialize)]
struct ToggleRequest {
    id: String,
    enabled: bool,
}

async fn toggle_mcp_server(Json(req): Json<ToggleRequest>) -> Result<(), (axum::http::StatusCode, Json<serde_json::Value>)> {
    mcp::toggle_mcp_server(req.id, req.enabled)
        .await
        .map_err(internal_error)
}

async fn update_mcp_server(Json(config): Json<McpServerConfig>) -> Result<(), (axum::http::StatusCode, Json<serde_json::Value>)> {
    mcp::update_mcp_server(config)
        .await
        .map_err(internal_error)
}

#[derive(Deserialize)]
struct MarketplaceQuery {
    query: Option<String>,
}

async fn fetch_marketplace(Query(q): Query<MarketplaceQuery>) -> Result<Json<Vec<McpServerConfig>>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    mcp::fetch_mcp_marketplace(q.query)
        .await
        .map(Json)
        .map_err(internal_error)
}

async fn sync_mcp_with_clis() -> Result<Json<Vec<String>>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    mcp::sync_mcp_with_clis()
        .await
        .map(Json)
        .map_err(internal_error)
}

#[derive(Deserialize)]
struct LitellmTestRequest {
    base_url: String,
    api_key_secret_id: String,
}

async fn test_litellm_connection(Json(req): Json<LitellmTestRequest>) -> Result<Json<String>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    mcp::test_litellm_connection(req.base_url, req.api_key_secret_id)
        .await
        .map(Json)
        .map_err(internal_error)
}
