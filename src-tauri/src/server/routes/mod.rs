use axum::Router;
use super::AppState;

mod utils;
mod system;
mod secrets;
mod projects;
mod settings;

pub fn api_router() -> Router<AppState> {
    Router::new()
        .nest("/system", system::router())
        .nest("/secrets", secrets::router())
        .nest("/projects", projects::router())
        .nest("/settings", settings::router())
}
