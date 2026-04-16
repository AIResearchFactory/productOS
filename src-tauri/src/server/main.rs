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
    pub orchestrator: Arc<app_lib::services::agent_orchestrator::AgentOrchestrator>,
}

async fn health() -> Json<serde_json::Value> {
    Json(json!({
        "ok": true,
        "version": env!("CARGO_PKG_VERSION")
    }))
}

#[tokio::main]
async fn main() {
    // Initialize logging
    tracing_subscriber::fmt::init();
    
    #[cfg(target_os = "macos")]
    app_lib::utils::env::fix_macos_env();

    paths::initialize_directory_structure().expect("Failed to initialize directories");

    let ai_service = Arc::new(AIService::new().await.expect("Failed to initialize AI Service"));
    let orchestrator = Arc::new(app_lib::services::agent_orchestrator::AgentOrchestrator::new(
        ai_service.clone(),
        None,
    ));

    // Start background services
    app_lib::services::workflow_scheduler_service::WorkflowSchedulerService::spawn_headless();

    let app_state = AppState { ai_service, orchestrator };

    let cors = CorsLayer::new()
        .allow_origin([
            "http://localhost:5173".parse::<HeaderValue>().unwrap(),
            "http://127.0.0.1:5173".parse::<HeaderValue>().unwrap(),
        ])
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
    
    // Retry binding to the port to handle rapid restarts and transient AddrInUse errors
    let mut retry_count = 0;
    let listener = loop {
        match tokio::net::TcpListener::bind(&addr).await {
            Ok(l) => {
                println!("✅ Local server bound successfully to {}", addr);
                break l;
            },
            Err(e) if e.kind() == std::io::ErrorKind::AddrInUse && retry_count < 30 => {
                retry_count += 1;
                if retry_count % 5 == 0 {
                    println!("Port {} in use, still retrying... (attempt {}/30)", port, retry_count);
                }
                tokio::time::sleep(std::time::Duration::from_secs(1)).await;
            }
            Err(e) => panic!("CRITICAL: Failed to bind to {}: {}", addr, e),
        }
    };

    println!("🚀 Server listening on http://{}", addr);

    if let Err(e) = axum::serve(listener, app).await {
        eprintln!("CRITICAL: Server error: {}", e);
    }
}
