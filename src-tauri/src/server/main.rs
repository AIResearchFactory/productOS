use app_lib::services::ai_service::AIService;
use app_lib::utils::paths;
use axum::{
    http::Method,
    routing::get,
    Json, Router,
};
use serde_json::json;
use std::sync::Arc;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;
use tower_http::services::{ServeDir, ServeFile};

mod routes;

#[derive(Clone)]
pub struct AppState {
    pub ai_service: Arc<AIService>,
    pub orchestrator: Arc<app_lib::services::agent_orchestrator::AgentOrchestrator>,
    pub trace_log_sender: tokio::sync::broadcast::Sender<String>,
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
    let (trace_log_sender, _) = tokio::sync::broadcast::channel::<String>(100);
    let mut orchestrator_inner = app_lib::services::agent_orchestrator::AgentOrchestrator::new(
        ai_service.clone(),
        None,
    );
    orchestrator_inner.trace_sender = Some(trace_log_sender.clone());
    let orchestrator = Arc::new(orchestrator_inner);

    // Start background services
    app_lib::services::workflow_scheduler_service::WorkflowSchedulerService::spawn_headless();

    let app_state = AppState { ai_service, orchestrator, trace_log_sender };

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods([
            Method::GET, 
            Method::POST, 
            Method::PUT, 
            Method::DELETE, 
            Method::OPTIONS,
            Method::PATCH,
        ])
        .allow_headers(Any)
        .expose_headers(Any);


    let serve_dir = ServeDir::new("../dist")
        .not_found_service(ServeFile::new("../dist/index.html"));

    let app = Router::new()
        .route("/api/health", get(health))
        .nest("/api", routes::api_router())
        .fallback_service(serve_dir)
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
                println!("✅ Local server bound successfully to localhost:{}", port);
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

    println!("🚀 Server listening on http://localhost:{}", port);

    if let Err(e) = axum::serve(listener, app).await {
        eprintln!("CRITICAL: Server error: {}", e);
    }
}
