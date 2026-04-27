use axum::{
    extract::{Query, State},
    response::sse::{Event, Sse},
    Json,
};
use futures_util::stream::Stream;
use serde_json::json;
use std::convert::Infallible;
use tokio_stream::wrappers::BroadcastStream;
use tokio_stream::StreamExt;

pub fn system_router() -> axum::Router<super::super::AppState> {
    axum::Router::new()
        .route("/detect/claude", axum::routing::get(detect_claude))
        .route("/detect/ollama", axum::routing::get(detect_ollama))
        .route("/detect/gemini", axum::routing::get(detect_gemini))
        .route("/detect/openai", axum::routing::get(detect_openai))
        .route("/data-directory", axum::routing::get(get_data_directory))
        .route("/shutdown", axum::routing::post(shutdown))
        .route("/health", axum::routing::get(health_check))
        .route("/trace-logs", axum::routing::get(trace_logs_stream))
        .route("/events", axum::routing::get(events_stream))
}

async fn detect_claude() -> Json<serde_json::Value> {
    let res = crate::commands::installation_commands::detect_claude_code().await.unwrap_or_default();
    Json(json!(res))
}

async fn detect_ollama() -> Json<serde_json::Value> {
    let res = crate::commands::installation_commands::detect_ollama().await.unwrap_or_default();
    Json(json!(res))
}

async fn detect_gemini() -> Json<serde_json::Value> {
    let res = crate::commands::installation_commands::detect_gemini().await.unwrap_or_default();
    Json(json!(res))
}

async fn detect_openai() -> Json<serde_json::Value> {
    let res = crate::commands::installation_commands::detect_openai_cli().await.unwrap_or_default();
    Json(json!(res))
}

async fn get_data_directory() -> Json<String> {
    let path = crate::utils::paths::get_app_data_dir().unwrap_or_default().to_string_lossy().to_string();
    Json(path)
}

async fn shutdown() -> Json<serde_json::Value> {
    std::process::exit(0);
}

async fn health_check() -> Json<serde_json::Value> {
    Json(json!({ "status": "ok" }))
}

async fn trace_logs_stream(
    State(state): State<super::super::AppState>,
) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    let receiver = state.trace_log_sender.subscribe();
    let stream = BroadcastStream::new(receiver).map(|msg| {
        match msg {
            Ok(text) => Ok(Event::default().data(text)),
            Err(_) => Ok(Event::default().data("lagged")),
        }
    });

    Sse::new(stream).keep_alive(axum::response::sse::KeepAlive::default())
}

#[derive(serde::Deserialize)]
struct EventQuery {
    event: Option<String>,
}

async fn events_stream(
    State(state): State<super::super::AppState>,
    Query(q): Query<EventQuery>,
) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    log::info!("[SSE] New event stream connection. Filter: {:?}", q.event);
    let receiver = state.event_sender.subscribe();
    let target_event = q.event.clone();

    let stream = BroadcastStream::new(receiver).filter_map(move |msg| {
        let text = match msg {
            Ok(t) => t,
            Err(_) => {
                log::warn!("[SSE] Event stream lagged");
                return Some(Ok(Event::default().data("lagged")));
            }
        };

        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&text) {
            let event_name = json.get("event").and_then(|v| v.as_str());
            
            match &target_event {
                Some(target) => {
                    if event_name == Some(target) {
                        let payload = json.get("payload").unwrap_or(&json!({})).to_string();
                        Some(Ok(Event::default().data(payload)))
                    } else {
                        None
                    }
                }
                None => {
                    // Send the full JSON if no filter is provided
                    Some(Ok(Event::default().data(text)))
                }
            }
        } else {
            if target_event.is_none() {
                Some(Ok(Event::default().data(text)))
            } else {
                None
            }
        }
    });

    Sse::new(stream).keep_alive(axum::response::sse::KeepAlive::default())
}
