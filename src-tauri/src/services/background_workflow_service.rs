use crate::models::workflow::*;
use crate::services::workflow_service::WorkflowService;
use crate::services::project_service::ProjectService;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};
use chrono::Utc;
use std::fs;

use once_cell::sync::Lazy;

static ACTIVE_RUNS: Lazy<Arc<Mutex<HashMap<String, WorkflowExecution>>>> = Lazy::new(|| Arc::new(Mutex::new(HashMap::new())));

pub struct BackgroundWorkflowService;

impl BackgroundWorkflowService {
    pub async fn execute_in_background(
        project_id: String,
        workflow_id: String,
        parameters: Option<HashMap<String, String>>,
        trigger: String,
        app_handle: AppHandle,
    ) -> String {
        let run_id = uuid::Uuid::new_v4().to_string();
        let composite_key = format!("{}::{}", project_id, workflow_id);
        
        // 1. Load workflow to get name and check existence
        let workflow = match WorkflowService::load_workflow(&project_id, &workflow_id) {
            Ok(w) => w,
            Err(e) => return format!("Error: Failed to load workflow: {}", e),
        };
        let workflow_name = workflow.name.clone();

        let mut active_runs = ACTIVE_RUNS.lock().unwrap();
        active_runs.insert(composite_key.clone(), WorkflowExecution {
            workflow_id: workflow_id.clone(),
            started: Utc::now().to_rfc3339(),
            completed: None,
            status: ExecutionStatus::Running,
            error: None,
            step_results: HashMap::new(),
        });
        drop(active_runs);

        // Update workflow status in main file
        let mut workflow = workflow;
        workflow.active_execution_id = Some(run_id.clone());
        workflow.status = Some("Running".to_string());
        let _ = WorkflowService::save_workflow(&workflow);

        let run_id_clone = run_id.clone();
        let project_id_clone = project_id.clone();
        let workflow_id_clone = workflow_id.clone();
        let app_handle_clone = app_handle.clone();
        let composite_key_clone = composite_key.clone();

        tauri::async_runtime::spawn(async move {
            let execution_result = WorkflowService::execute_workflow(
                &project_id_clone,
                &workflow_id_clone,
                parameters,
                |progress| {
                    let _ = app_handle_clone.emit("workflow-progress", &progress);
                }
            ).await;

            let (status, error_msg) = match &execution_result {
                Ok(exec) => (exec.status.clone(), exec.error.clone()),
                Err(e) => (ExecutionStatus::Failed, Some(e.to_string())),
            };

            // Save to history
            let record = match &execution_result {
                Ok(exec) => WorkflowRunRecord {
                    id: run_id_clone.clone(),
                    workflow_id: workflow_id_clone.clone(),
                    workflow_name: workflow_name.clone(),
                    project_id: project_id_clone.clone(),
                    started: exec.started.clone(),
                    completed: exec.completed.clone(),
                    status: exec.status.clone(),
                    error: exec.error.clone(),
                    trigger: trigger.clone(),
                    step_results: exec.step_results.clone(),
                },
                Err(e) => WorkflowRunRecord {
                    id: run_id_clone.clone(),
                    workflow_id: workflow_id_clone.clone(),
                    workflow_name: workflow_name.clone(),
                    project_id: project_id_clone.clone(),
                    started: Utc::now().to_rfc3339(),
                    completed: Some(Utc::now().to_rfc3339()),
                    status: ExecutionStatus::Failed,
                    error: Some(e.to_string()),
                    trigger: trigger.clone(),
                    step_results: HashMap::new(),
                },
            };
            let _ = Self::save_run_record(&record);

            // Cleanup active run
            let mut active_runs = ACTIVE_RUNS.lock().unwrap();
            active_runs.remove(&composite_key_clone);
            drop(active_runs);

            if let Ok(mut workflow) = WorkflowService::load_workflow(&project_id_clone, &workflow_id_clone) {
                workflow.active_execution_id = None;
                workflow.status = Some(format!("{:?}", status));
                let _ = WorkflowService::save_workflow(&workflow);
            }

            let _ = app_handle_clone.emit("workflow-finished", serde_json::json!({
                "project_id": project_id_clone,
                "workflow_id": workflow_id_clone,
                "run_id": run_id_clone,
                "status": status,
                "error": error_msg
            }));
            
            // Also emit workflow-changed to trigger list refreshes
            let _ = app_handle_clone.emit("workflow-changed", &project_id_clone);
        });

        run_id
    }

    pub fn get_active_runs() -> HashMap<String, WorkflowExecution> {
        ACTIVE_RUNS.lock().unwrap().clone()
    }

    fn save_run_record(record: &WorkflowRunRecord) -> Result<(), String> {
        let project_path = ProjectService::resolve_project_path(&record.project_id)
            .map_err(|e| e.to_string())?;
        let history_dir = project_path.join(".metadata").join("workflow_runs");
        
        if !history_dir.exists() {
            fs::create_dir_all(&history_dir).map_err(|e| e.to_string())?;
        }

        let file_path = history_dir.join(format!("{}.json", record.id));
        let content = serde_json::to_string_pretty(record).map_err(|e| e.to_string())?;
        fs::write(file_path, content).map_err(|e| e.to_string())?;
        
        Ok(())
    }

    pub fn get_workflow_history(project_id: &str, workflow_id: &str) -> Vec<WorkflowRunRecord> {
        let mut history = Vec::new();
        let Ok(project_path) = ProjectService::resolve_project_path(project_id) else {
            return history;
        };
        let history_dir = project_path.join(".metadata").join("workflow_runs");
        
        if !history_dir.exists() {
            return history;
        }

        if let Ok(entries) = fs::read_dir(history_dir) {
            for entry in entries.flatten() {
                if let Ok(content) = fs::read_to_string(entry.path()) {
                    if let Ok(record) = serde_json::from_str::<WorkflowRunRecord>(&content) {
                        if record.workflow_id == workflow_id {
                            history.push(record);
                        }
                    }
                }
            }
        }

        history.sort_by(|a, b| b.started.cmp(&a.started));
        history
    }
}
