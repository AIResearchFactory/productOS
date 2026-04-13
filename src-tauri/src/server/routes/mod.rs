use axum::Router;
use super::AppState;

pub fn api_router() -> Router<AppState> {
    Router::new()
        // We will mount sub-routers here, e.g.:
        // .nest("/projects", projects_router())
}
