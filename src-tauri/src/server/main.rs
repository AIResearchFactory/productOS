use app_lib::services::ai_service::AIService;
use app_lib::utils::paths;
use axum::{
    http::{HeaderValue, Method},
    routing::get,
    Json, Router,
};
use serde_json::json;
use std::sync::Arc;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;

mod routes;

#[derive(Clone)]
pub struct AppState {
    pub ai_service: Arc<AIService>,
}

async fn health() -> Json<serde_json::Value> {
    Json(json!({
        "ok": true,
        "version": env!("CARGO_PKG_VERSION")
    }))
}

#[tokio::main]
async fn main() {
    
    #[cfg(target_os = "macos")]
    app_lib::utils::env::fix_macos_env();

    paths::initialize_directory_structure().expect("Failed to initialize directories");

    let ai_service = Arc::new(AIService::new().await.expect("Failed to initialize AI Service"));
    let app_state = AppState { ai_service };

    let cors = CorsLayer::new()
        .allow_origin(
            "http://localhost:5173"
                .parse::<HeaderValue>()
                .expect("Failed to parse CORS origin"),
        )
        .allow_methods([Method::GET, Method::POST, Method::PUT, Method::DELETE])
        .allow_headers(Any);

    let app = Router::new()
        .route("/api/health", get(health))
        .nest("/api", routes::api_router())
        .layer(cors)
        .layer(TraceLayer::new_for_http())
        .with_state(app_state);

    let port = 51423u16;
    let addr = format!("127.0.0.1:{}", port);
    println!("Server starting on http://{}", addr);
    println!("✅ Local server is READY and listening for requests");

    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
