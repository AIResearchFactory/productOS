use crate::models::project::Project;
use crate::services::project_service::ProjectService;
use crate::services::settings_service::SettingsService;
use crate::models::error::{AppResult, AppError};


pub async fn get_all_projects() -> AppResult<Vec<Project>> {
    ProjectService::discover_projects().map_err(|e| AppError::Internal(e.to_string()))
}


pub async fn get_project(project_id: String) -> AppResult<Project> {
    let projects_path = SettingsService::get_projects_path()?;

    let project_path = projects_path.join(&project_id);

    ProjectService::load_project(&project_path).map_err(|e| AppError::NotFound(e.to_string()))
}


pub async fn create_project(
    name: String,
    goal: String,
    skills: Vec<String>,
) -> AppResult<Project> {
    log::info!("Creating project: {}", name);
    ProjectService::create_project(&name, &goal, skills)
        .map_err(|e| AppError::Validation(format!("Failed to create project: {}", e)))
}


pub async fn get_project_files(project_id: String) -> AppResult<Vec<String>> {
    ProjectService::list_project_files(&project_id).map_err(Into::into)
}


pub async fn delete_project(project_id: String) -> AppResult<()> {
    log::info!("Deleting project: {}", project_id);
    ProjectService::delete_project(&project_id).map_err(Into::into)
}


pub async fn rename_project(project_id: String, new_name: String) -> AppResult<()> {
    log::info!("Renaming project {} to {}", project_id, new_name);
    ProjectService::update_project_metadata(&project_id, Some(new_name), None).map_err(Into::into)
}


pub async fn get_project_cost(project_id: String) -> AppResult<f64> {
    let project = ProjectService::load_project_by_id(&project_id)
        .map_err(|e| AppError::NotFound(format!("Project {} not found: {}", project_id, e)))?;
    let cost_log_path = project.path.join(".metadata").join("cost_log.json");
    let cost_log = crate::models::cost::CostLog::load(&cost_log_path).unwrap_or_default();
    Ok(cost_log.total_cost())
}
