use crate::models::workflow::*;
use crate::services::workflow_service::WorkflowService;
use crate::services::background_workflow_service::BackgroundWorkflowService;
use axum::{extract::Query, routing::{get, post, put, delete}, Json, Router};
use chrono::Utc;
use serde::Deserialize;
use super::utils::internal_error;

pub fn router() -> Router<super::super::AppState> {
    Router::new()
        .route("/", get(get_project_workflows))
        .route("/get", get(get_workflow))
        .route("/create", post(create_workflow))
        .route("/save", put(save_workflow))
        .route("/delete", delete(delete_workflow))
        .route("/execute", post(execute_workflow))
        .route("/stop", post(stop_workflow_execution))
        .route("/stop-execution", post(stop_workflow_execution))
        .route("/history", get(get_workflow_history))
        .route("/active", get(get_active_runs))
        .route("/schedule/set", post(set_workflow_schedule))
        .route("/schedule/clear", post(clear_workflow_schedule))
        .route("/validate", post(validate_workflow))
        .route("/step/add", post(add_workflow_step))
        .route("/step/remove", post(remove_workflow_step))
}

#[derive(Deserialize)]
struct ProjectQuery {
    project_id: String,
}

#[derive(Deserialize)]
struct WorkflowQuery {
    project_id: String,
    workflow_id: String,
}

async fn get_project_workflows(Query(q): Query<ProjectQuery>) -> Result<Json<Vec<Workflow>>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    WorkflowService::load_project_workflows(&q.project_id)
        .map(Json)
        .map_err(internal_error)
}

async fn get_workflow(Query(q): Query<WorkflowQuery>) -> Result<Json<Workflow>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    WorkflowService::load_workflow(&q.project_id, &q.workflow_id)
        .map(Json)
        .map_err(internal_error)
}

#[derive(Deserialize)]
struct CreateWorkflowRequest {
    project_id: String,
    name: String,
    description: String,
}

async fn create_workflow(Json(req): Json<CreateWorkflowRequest>) -> Result<Json<Workflow>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    let workflow_id = req.name
        .to_lowercase()
        .replace(' ', "-")
        .chars()
        .filter(|c| c.is_alphanumeric() || *c == '-' || *c == '_')
        .collect::<String>();

    let now = Utc::now().to_rfc3339();

    let workflow = Workflow {
        id: workflow_id,
        project_id: req.project_id,
        name: req.name,
        description: req.description,
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

    WorkflowService::save_workflow(&workflow).map_err(internal_error)?;
    Ok(Json(workflow))
}

async fn save_workflow(Json(mut workflow): Json<Workflow>) -> Result<(), (axum::http::StatusCode, Json<serde_json::Value>)> {
    workflow.updated = Utc::now().to_rfc3339();
    WorkflowService::save_workflow(&workflow).map_err(internal_error)
}

async fn delete_workflow(Query(q): Query<WorkflowQuery>) -> Result<(), (axum::http::StatusCode, Json<serde_json::Value>)> {
    WorkflowService::delete_workflow(&q.project_id, &q.workflow_id).map_err(internal_error)
}

#[derive(Deserialize)]
struct ExecuteWorkflowRequest {
    project_id: String,
    workflow_id: String,
    parameters: Option<std::collections::HashMap<String, String>>,
}

async fn execute_workflow(
    axum::extract::State(state): axum::extract::State<super::super::AppState>,
    Json(req): Json<ExecuteWorkflowRequest>,
) -> Result<Json<String>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    // In server mode we don't have a Tauri AppHandle, so we use the service directly
    // without emitting window events.
    let run_id = BackgroundWorkflowService::execute_in_background_headless(
        req.project_id,
        req.workflow_id,
        req.parameters,
        "manual".to_string(),
        state.ai_service.clone(),
    ).await;

    Ok(Json(run_id))
}

async fn get_workflow_history(Query(q): Query<WorkflowQuery>) -> Result<Json<Vec<WorkflowRunRecord>>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    Ok(Json(BackgroundWorkflowService::get_workflow_history(&q.project_id, &q.workflow_id)))
}

async fn get_active_runs() -> Result<Json<std::collections::HashMap<String, WorkflowExecution>>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    Ok(Json(BackgroundWorkflowService::get_active_runs()))
}

#[derive(Deserialize)]
struct SetScheduleRequest {
    project_id: String,
    workflow_id: String,
    schedule: WorkflowSchedule,
}

async fn set_workflow_schedule(Json(req): Json<SetScheduleRequest>) -> Result<Json<Workflow>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    let mut workflow = WorkflowService::load_workflow(&req.project_id, &req.workflow_id)
        .map_err(internal_error)?;

    let mut schedule = req.schedule;
    schedule.next_run_at = None;
    workflow.schedule = Some(schedule);
    workflow.updated = Utc::now().to_rfc3339();

    WorkflowService::save_workflow(&workflow).map_err(internal_error)?;
    Ok(Json(workflow))
}

async fn clear_workflow_schedule(Json(req): Json<WorkflowQuery>) -> Result<Json<Workflow>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    let mut workflow = WorkflowService::load_workflow(&req.project_id, &req.workflow_id)
        .map_err(internal_error)?;

    workflow.schedule = None;
    workflow.updated = Utc::now().to_rfc3339();

    WorkflowService::save_workflow(&workflow).map_err(internal_error)?;
    Ok(Json(workflow))
}

async fn validate_workflow(Json(workflow): Json<Workflow>) -> Result<Json<Vec<String>>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    match workflow.validate() {
        Ok(_) => Ok(Json(Vec::new())),
        Err(errors) => Ok(Json(errors)),
    }
}

#[derive(Deserialize)]
struct AddStepRequest {
    project_id: String,
    workflow_id: String,
    step: WorkflowStep,
}

async fn add_workflow_step(Json(req): Json<AddStepRequest>) -> Result<Json<Workflow>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    let mut workflow = WorkflowService::load_workflow(&req.project_id, &req.workflow_id)
        .map_err(internal_error)?;

    workflow.steps.push(req.step);
    workflow.updated = Utc::now().to_rfc3339();

    WorkflowService::save_workflow(&workflow).map_err(internal_error)?;
    Ok(Json(workflow))
}

#[derive(Deserialize)]
struct RemoveStepRequest {
    project_id: String,
    workflow_id: String,
    step_id: String,
}

async fn remove_workflow_step(Json(req): Json<RemoveStepRequest>) -> Result<Json<Workflow>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    let mut workflow = WorkflowService::load_workflow(&req.project_id, &req.workflow_id)
        .map_err(internal_error)?;

    workflow.steps.retain(|s| s.id != req.step_id);
    workflow.updated = Utc::now().to_rfc3339();

    WorkflowService::save_workflow(&workflow).map_err(internal_error)?;
    Ok(Json(workflow))
}

async fn stop_workflow_execution(Json(req): Json<WorkflowQuery>) -> Result<(), (axum::http::StatusCode, Json<serde_json::Value>)> {
    BackgroundWorkflowService::stop_workflow(&req.project_id, &req.workflow_id);
    Ok(())
}
