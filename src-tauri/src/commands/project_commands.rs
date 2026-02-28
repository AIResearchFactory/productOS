use crate::models::project::Project;
use crate::services::project_service::ProjectService;
use crate::services::settings_service::SettingsService;

#[tauri::command]
pub async fn get_all_projects() -> Result<Vec<Project>, String> {
    ProjectService::discover_projects()
        .map_err(|e| format!("Failed to load all projects: {}", e))
}

#[tauri::command]
pub async fn get_project(project_id: String) -> Result<Project, String> {
    let projects_path = SettingsService::get_projects_path()
        .map_err(|e| format!("Failed to get projects path: {}", e))?;

    let project_path = projects_path.join(&project_id);

    ProjectService::load_project(&project_path)
        .map_err(|e| format!("Failed to load project: {}", e))
}

#[tauri::command]
pub async fn create_project(name: String, goal: String, skills: Vec<String>) -> Result<Project, String> {
    log::info!("Creating project: {}", name);
    match ProjectService::create_project(&name, &goal, skills) {
        Ok(project) => {
            log::info!("Project created successfully: {:?}", project.id);
            Ok(project)
        },
        Err(e) => {
            log::error!("Failed to create project: {}", e);
            Err(format!("Failed to create project: {}", e))
        }
    }
}

#[tauri::command]
pub async fn get_project_files(project_id: String) -> Result<Vec<String>, String> {
    ProjectService::list_project_files(&project_id)
        .map_err(|e| format!("Failed to list project files: {}", e))
}

#[tauri::command]
pub async fn delete_project(project_id: String) -> Result<(), String> {
    log::info!("Deleting project: {}", project_id);
    ProjectService::delete_project(&project_id)
        .map_err(|e| format!("Failed to delete project: {}", e))
}

#[tauri::command]
pub async fn rename_project(project_id: String, new_name: String) -> Result<(), String> {
    log::info!("Renaming project {} to {}", project_id, new_name);
    ProjectService::update_project_metadata(&project_id, Some(new_name), None)
        .map_err(|e| format!("Failed to rename project: {}", e))
}

#[tauri::command]
pub async fn get_project_cost(project_id: String) -> Result<f64, String> {
    let project = ProjectService::load_project_by_id(&project_id)
        .map_err(|e| format!("Failed to load project: {}", e))?;
    let cost_log_path = project.path.join(".metadata").join("cost_log.json");
    let cost_log = crate::models::cost::CostLog::load(&cost_log_path).unwrap_or_default();
    Ok(cost_log.total_cost())
}
