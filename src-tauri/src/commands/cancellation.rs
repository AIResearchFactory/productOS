use anyhow::Result;
use crate::services::cancellation_service::CancellationService;

#[tauri::command]
pub async fn stop_agent_execution() -> Result<(), String> {
    log::info!("Tauri command: stop_agent_execution called");
    CancellationService::global()
        .cancel_process("chat")
        .await
        .map_err(|e| e.to_string())
}
