use app_lib::commands::installation_commands;
use app_lib::detector;
use axum::{routing::{get, post}, Json, Router};
use super::utils::internal_error;

pub fn router() -> Router<super::super::AppState> {
    Router::new()
        .route("/detect/claude", get(detect_claude))
        .route("/detect/ollama", get(detect_ollama))
        .route("/detect/gemini", get(detect_gemini))
        .route("/detect/openai", get(detect_openai))
        .route("/detect/clear-cache", post(clear_all_caches))
        .route("/data-directory", get(get_data_directory))
        .route("/update/check", get(check_update))
        .route("/update/install", post(install_update))
        .route("/ask", post(ask))
        .route("/message", post(message_dialog))
        .route("/open", post(open_dialog))
        .route("/save", post(save_dialog))
        .route("/relaunch", post(relaunch))
        .route("/exit", post(exit_app))
        .route("/shutdown", post(shutdown))
}

async fn get_data_directory() -> Result<Json<String>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    app_lib::utils::paths::get_app_data_dir()
        .map(|p| p.to_string_lossy().to_string())
        .map(Json)
        .map_err(internal_error)
}

async fn detect_claude() -> Result<Json<Option<detector::ClaudeCodeInfo>>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    installation_commands::detect_claude_code().await.map(Json).map_err(internal_error)
}

async fn detect_ollama() -> Result<Json<Option<detector::OllamaInfo>>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    installation_commands::detect_ollama().await.map(Json).map_err(internal_error)
}

async fn detect_gemini() -> Result<Json<Option<detector::GeminiInfo>>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    installation_commands::detect_gemini().await.map(Json).map_err(internal_error)
}

async fn detect_openai() -> Result<Json<Option<installation_commands::OpenAiCliInfo>>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    installation_commands::detect_openai_cli().await.map(Json).map_err(internal_error)
}

async fn clear_all_caches() -> Result<(), (axum::http::StatusCode, Json<serde_json::Value>)> {
    installation_commands::clear_all_cli_detection_caches().map_err(internal_error)?;
    Ok(())
}

#[derive(serde::Deserialize)]
struct ShutdownQuery {
    source: Option<String>,
}

async fn check_update() -> Result<Json<serde_json::Value>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    Ok(Json(serde_json::json!({
        "available": false,
        "currentVersion": env!("CARGO_PKG_VERSION"),
        "latestVersion": env!("CARGO_PKG_VERSION"),
        "version": env!("CARGO_PKG_VERSION")
    })))
}

async fn install_update() -> Result<(), (axum::http::StatusCode, Json<serde_json::Value>)> {
    Ok(())
}

#[derive(serde::Deserialize)]
struct AskRequest {
    message: String,
}

async fn ask(Json(req): Json<AskRequest>) -> Result<Json<bool>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    println!("ASK PROMPT: {}", req.message);
    // In headless/browser mode, we default to true to avoid blocking, 
    // or return false if we want the frontend to use its own fallback.
    Ok(Json(true))
}

#[derive(serde::Deserialize)]
struct MessageRequest {
    message: String,
}

async fn message_dialog(Json(req): Json<MessageRequest>) -> Result<(), (axum::http::StatusCode, Json<serde_json::Value>)> {
    println!("MESSAGE DIALOG: {}", req.message);
    Ok(())
}

async fn open_dialog() -> Result<Json<Option<Vec<String>>>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    Ok(Json(None))
}

async fn save_dialog() -> Result<Json<Option<String>>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    Ok(Json(None))
}

async fn relaunch() -> Result<(), (axum::http::StatusCode, Json<serde_json::Value>)> {
    println!("Relaunch requested. Restarting...");
    tokio::spawn(async move {
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
        std::process::exit(0);
    });
    Ok(())
}

#[derive(serde::Deserialize)]
struct ExitRequest {
    code: i32,
}

async fn exit_app(Json(req): Json<ExitRequest>) -> Result<(), (axum::http::StatusCode, Json<serde_json::Value>)> {
    println!("Exit requested with code: {}", req.code);
    tokio::spawn(async move {
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
        std::process::exit(req.code);
    });
    Ok(())
}

async fn shutdown(axum::extract::Query(query): axum::extract::Query<ShutdownQuery>) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    println!("Shutdown requested. Exiting in 500ms...");
    
    let is_ui = query.source.as_deref() == Some("ui");

    // Spawn a task to exit the process after a short delay
    tokio::spawn(async move {
        if is_ui {
            println!("Triggered from UI. Spawning npm stop sequence...");
            let _ = tokio::process::Command::new("npm")
                .arg("run")
                .arg("stop")
                .current_dir("..")
                .spawn();
        }

        tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
        std::process::exit(0);
    });

    Ok(Json(serde_json::json!({ "status": "shutting_down" })))
}
