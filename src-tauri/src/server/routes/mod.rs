use axum::Router;
use super::AppState;

mod utils;
mod system;
mod secrets;
mod projects;
mod settings;
mod chat;
mod auth;
mod files;
mod workflows;
mod artifacts;
mod skills;
mod channels;
mod mcp_routes;
mod config;
mod research_log;
mod markdown;
mod cancellation;

pub fn api_router() -> Router<AppState> {
    Router::new()
        .nest("/system", system::router())
        .nest("/secrets", secrets::router())
        .nest("/projects", projects::router())
        .nest("/settings", settings::router())
        .nest("/chat", chat::router())
        .nest("/auth", auth::router())
        .nest("/files", files::router())
        .nest("/workflows", workflows::router())
        .nest("/artifacts", artifacts::router())
        .nest("/skills", skills::router())
        .nest("/channels", channels::router())
        .nest("/mcp", mcp_routes::router())
        .nest("/config", config::router())
        .nest("/research-log", research_log::router())
        .nest("/markdown", markdown::router())
        .nest("/cancellation", cancellation::router())
}
