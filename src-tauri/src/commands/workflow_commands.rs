use crate::models::workflow::*;
use crate::services::ai_service::AIService;
use crate::services::workflow_service::WorkflowService;
use crate::services::background_workflow_service::BackgroundWorkflowService;
use chrono::Utc;
use std::sync::Arc;



pub async fn get_project_workflows(project_id: String) -> Result<Vec<Workflow>, String> {
    WorkflowService::load_project_workflows(&project_id).map_err(|e| e.to_string())
}


pub async fn get_workflow(project_id: String, workflow_id: String) -> Result<Workflow, String> {
    WorkflowService::load_workflow(&project_id, &workflow_id).map_err(|e| e.to_string())
}


pub async fn create_workflow(
    project_id: String,
    name: String,
    description: String,
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
        notify_on_completion: false,
    };

    // Save the new workflow
    WorkflowService::save_workflow(&workflow).map_err(|e| e.to_string())?;

    // Emit workflow-changed event to refresh frontend
    

    Ok(workflow)
}


pub async fn save_workflow(workflow: Workflow) -> Result<(), String> {
    // Update the timestamp
    let mut workflow = workflow;
    workflow.updated = Utc::now().to_rfc3339();

    WorkflowService::save_workflow(&workflow).map_err(|e| e.to_string())?;

    // Emit workflow-changed event to refresh frontend
    

    Ok(())
}


pub async fn delete_workflow(
    project_id: String,
    workflow_id: String,
) -> Result<(), String> {
    WorkflowService::delete_workflow(&project_id, &workflow_id).map_err(|e| e.to_string())?;

    // Emit workflow-changed event to refresh frontend
    

    Ok(())
}


pub async fn execute_workflow(
    project_id: String,
    workflow_id: String,
    parameters: Option<std::collections::HashMap<String, String>>,
    ai_service: Arc<AIService>,
) -> Result<String, String> {
    let run_id = BackgroundWorkflowService::execute_in_background_headless(
        project_id,
        workflow_id,
        parameters,
        "manual".to_string(),
        ai_service,
        None, // event_sender
    ).await;

    Ok(run_id)
}


pub async fn get_workflow_history(
    project_id: String,
    workflow_id: String,
) -> Result<Vec<WorkflowRunRecord>, String> {
    Ok(BackgroundWorkflowService::get_workflow_history(&project_id, &workflow_id))
}


pub async fn get_active_runs() -> Result<std::collections::HashMap<String, WorkflowExecution>, String> {
    let _active_runs = BackgroundWorkflowService::get_active_runs();
    Ok(_active_runs) // Added to make the function syntactically correct and return the value
}


pub async fn set_workflow_schedule(
    project_id: String,
    workflow_id: String,
    schedule: WorkflowSchedule,
) -> Result<Workflow, String> {
    let mut workflow = WorkflowService::load_workflow(&project_id, &workflow_id)
        .map_err(|e| e.to_string())?;

    let mut updated_schedule = schedule;
    updated_schedule.next_run_at = None;

    workflow.schedule = Some(updated_schedule);
    workflow.updated = Utc::now().to_rfc3339();

    WorkflowService::save_workflow(&workflow)
        .map_err(|e| e.to_string())?;

    

    Ok(workflow)
}


pub async fn clear_workflow_schedule(
    project_id: String,
    workflow_id: String,
) -> Result<Workflow, String> {
    let mut workflow = WorkflowService::load_workflow(&project_id, &workflow_id)
        .map_err(|e| e.to_string())?;

    workflow.schedule = None;
    workflow.updated = Utc::now().to_rfc3339();

    WorkflowService::save_workflow(&workflow)
        .map_err(|e| e.to_string())?;

    

    Ok(workflow)
}


pub async fn validate_workflow(workflow: Workflow) -> Result<Vec<String>, String> {
    match workflow.validate() {
        Ok(_) => Ok(Vec::new()),
        Err(errors) => Ok(errors),
    }
}


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


pub async fn stop_workflow_execution(project_id: String, workflow_id: String) -> Result<(), String> {
    log::info!("Tauri command: stop_workflow_execution called for {}::{}", project_id, workflow_id);
    BackgroundWorkflowService::stop_workflow(&project_id, &workflow_id);
    Ok(())
}
