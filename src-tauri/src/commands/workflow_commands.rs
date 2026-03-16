use crate::models::workflow::*;
use crate::services::workflow_service::WorkflowService;
use crate::services::background_workflow_service::BackgroundWorkflowService;
use chrono::Utc;
use tauri::{Emitter, Window, Manager};

#[tauri::command]
pub async fn get_project_workflows(project_id: String) -> Result<Vec<Workflow>, String> {
    WorkflowService::load_project_workflows(&project_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_workflow(project_id: String, workflow_id: String) -> Result<Workflow, String> {
    WorkflowService::load_workflow(&project_id, &workflow_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_workflow(
    project_id: String,
    name: String,
    description: String,
    window: Window,
) -> Result<Workflow, String> {
    // Generate workflow ID from name
    let workflow_id = name
        .to_lowercase()
        .replace(' ', "-")
        .chars()
        .filter(|c| c.is_alphanumeric() || *c == '-' || *c == '_')
        .collect::<String>();

    let now = Utc::now().to_rfc3339();

    let workflow = Workflow {
        id: workflow_id,
        project_id: project_id.clone(),
        name,
        description,
        steps: vec![WorkflowStep {
            id: "input-1".to_string(),
            name: "Input".to_string(),
            step_type: StepType::Input,
            config: StepConfig {
                source_type: Some("manual".to_string()),
                source_value: Some("".to_string()),
                ..Default::default()
            },
            depends_on: vec![],
        }],
        version: "1.0.0".to_string(),
        created: now.clone(),
        updated: now,
        status: None,
        last_run: None,
        active_execution_id: None,
        schedule: None,
    };

    // Save the new workflow
    WorkflowService::save_workflow(&workflow).map_err(|e| e.to_string())?;

    // Emit workflow-changed event to refresh frontend
    let _ = window.emit("workflow-changed", &project_id);

    Ok(workflow)
}

#[tauri::command]
pub async fn save_workflow(workflow: Workflow, window: Window) -> Result<(), String> {
    // Update the timestamp
    let mut workflow = workflow;
    workflow.updated = Utc::now().to_rfc3339();

    WorkflowService::save_workflow(&workflow).map_err(|e| e.to_string())?;

    // Emit workflow-changed event to refresh frontend
    let _ = window.emit("workflow-changed", &workflow.project_id);

    Ok(())
}

#[tauri::command]
pub async fn delete_workflow(
    project_id: String,
    workflow_id: String,
    window: Window,
) -> Result<(), String> {
    WorkflowService::delete_workflow(&project_id, &workflow_id).map_err(|e| e.to_string())?;

    // Emit workflow-changed event to refresh frontend
    let _ = window.emit("workflow-changed", &project_id);

    Ok(())
}

#[tauri::command]
pub async fn execute_workflow(
    project_id: String,
    workflow_id: String,
    parameters: Option<std::collections::HashMap<String, String>>,
    window: Window,
) -> Result<String, String> {
    let app_handle = window.app_handle().clone();
    
    let run_id = BackgroundWorkflowService::execute_in_background(
        project_id.clone(),
        workflow_id.clone(),
        parameters,
        "manual".to_string(),
        app_handle,
    ).await;

    // Emit workflow-changed event so lists (like WorkflowList) know to refresh status
    let _ = window.emit("workflow-changed", &project_id);

    Ok(run_id)
}

#[tauri::command]
pub async fn get_workflow_history(
    project_id: String,
    workflow_id: String,
) -> Result<Vec<WorkflowRunRecord>, String> {
    Ok(BackgroundWorkflowService::get_workflow_history(&project_id, &workflow_id))
}

#[tauri::command]
pub async fn get_active_runs() -> Result<std::collections::HashMap<String, WorkflowExecution>, String> {
    let _active_runs = BackgroundWorkflowService::get_active_runs();
    Ok(_active_runs) // Added to make the function syntactically correct and return the value
}

#[tauri::command]
pub async fn set_workflow_schedule(
    project_id: String,
    workflow_id: String,
    schedule: WorkflowSchedule,
    window: Window,
) -> Result<Workflow, String> {
    let mut workflow = WorkflowService::load_workflow(&project_id, &workflow_id)
        .map_err(|e| e.to_string())?;

    let mut updated_schedule = schedule;
    updated_schedule.next_run_at = None;

    workflow.schedule = Some(updated_schedule);
    workflow.updated = Utc::now().to_rfc3339();

    WorkflowService::save_workflow(&workflow)
        .map_err(|e| e.to_string())?;

    let _ = window.emit("workflow-changed", &project_id);

    Ok(workflow)
}

#[tauri::command]
pub async fn clear_workflow_schedule(
    project_id: String,
    workflow_id: String,
    window: Window,
) -> Result<Workflow, String> {
    let mut workflow = WorkflowService::load_workflow(&project_id, &workflow_id)
        .map_err(|e| e.to_string())?;

    workflow.schedule = None;
    workflow.updated = Utc::now().to_rfc3339();

    WorkflowService::save_workflow(&workflow)
        .map_err(|e| e.to_string())?;

    let _ = window.emit("workflow-changed", &project_id);

    Ok(workflow)
}

#[tauri::command]
pub async fn validate_workflow(workflow: Workflow) -> Result<Vec<String>, String> {
    match workflow.validate() {
        Ok(_) => Ok(Vec::new()),
        Err(errors) => Ok(errors),
    }
}

#[tauri::command]
pub async fn add_workflow_step(
    project_id: String,
    workflow_id: String,
    step: WorkflowStep,
) -> Result<Workflow, String> {
    // Load workflow
    let mut workflow =
        WorkflowService::load_workflow(&project_id, &workflow_id).map_err(|e| e.to_string())?;

    // Add step to workflow
    workflow.steps.push(step);

    // Update timestamp
    workflow.updated = Utc::now().to_rfc3339();

    // Save workflow
    WorkflowService::save_workflow(&workflow).map_err(|e| e.to_string())?;

    Ok(workflow)
}

#[tauri::command]
pub async fn remove_workflow_step(
    project_id: String,
    workflow_id: String,
    step_id: String,
) -> Result<Workflow, String> {
    // Load workflow
    let mut workflow =
        WorkflowService::load_workflow(&project_id, &workflow_id).map_err(|e| e.to_string())?;

    // Remove step with matching ID
    workflow.steps.retain(|s| s.id != step_id);

    // Update timestamp
    workflow.updated = Utc::now().to_rfc3339();

    // Save workflow
    WorkflowService::save_workflow(&workflow).map_err(|e| e.to_string())?;

    Ok(workflow)
}

