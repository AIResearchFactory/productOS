use crate::models::research_log::ResearchLogEntry;
use crate::services::research_log_service::ResearchLogService;
use anyhow::Result;

#[tauri::command]
pub async fn get_research_log(project_id: String) -> Result<Vec<ResearchLogEntry>, String> {
    ResearchLogService::get_log(&project_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn clear_research_log(project_id: String) -> Result<(), String> {
    ResearchLogService::clear_log(&project_id).map_err(|e| e.to_string())
}
