use crate::services::ai_service::AIService;
use crate::utils::paths;
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

pub mod routes;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct GenericEvent {
    pub event: String,
    pub payload: serde_json::Value,
}

#[derive(Clone)]
pub struct AppState {
    pub ai_service: Arc<AIService>,
    pub orchestrator: Arc<crate::services::agent_orchestrator::AgentOrchestrator>,
    pub trace_log_sender: tokio::sync::broadcast::Sender<String>,
    pub event_sender: tokio::sync::broadcast::Sender<GenericEvent>,
}

async fn health() -> Json<serde_json::Value> {
    Json(json!({
        "ok": true,
        "version": env!("CARGO_PKG_VERSION")
    }))
}

pub async fn start_server() {
    // Initialize logging
    tracing_subscriber::fmt::init();
    
    #[cfg(target_os = "macos")]
    crate::utils::env::fix_macos_env();

    paths::initialize_directory_structure().expect("Failed to initialize directories");

    let ai_service = Arc::new(AIService::new().await.expect("Failed to initialize AI Service"));
    let (trace_log_sender, _) = tokio::sync::broadcast::channel::<String>(100);
    let (event_sender, _) = tokio::sync::broadcast::channel::<GenericEvent>(100);
    
    let mut orchestrator_inner = crate::services::agent_orchestrator::AgentOrchestrator::new(
        ai_service.clone(),
    );
    orchestrator_inner.trace_sender = Some(trace_log_sender.clone());
    orchestrator_inner.event_sender = Some(event_sender.clone());
    let orchestrator = Arc::new(orchestrator_inner);

    // Start background services
    crate::services::workflow_scheduler_service::WorkflowSchedulerService::spawn_headless(Some(event_sender.clone()));

    let app_state = AppState { ai_service, orchestrator, trace_log_sender, event_sender };

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
            Err(e) => {
                // Fallback to 0.0.0.0 if loopback is not available
                let ipv4_addr = format!("0.0.0.0:{}", port);
                match tokio::net::TcpListener::bind(&ipv4_addr).await {
                    Ok(l) => {
                        println!("✅ Local server bound successfully to 0.0.0.0:{}", port);
                        break l;
                    },
                    Err(_) => panic!("CRITICAL: Failed to bind to {} or {}: {}", addr, ipv4_addr, e),
                }
            }
        }
    };

    println!("🚀 Server listening on http://{}", addr);

    if let Err(e) = axum::serve(listener, app).await {
        eprintln!("CRITICAL: Server error: {}", e);
    }
}
