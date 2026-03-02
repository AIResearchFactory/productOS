use std::collections::HashSet;
use std::str::FromStr;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use chrono::{DateTime, Utc};
use chrono_tz::Tz;
use cron::Schedule;
use tauri::{AppHandle, Emitter};

use crate::services::project_service::ProjectService;
use crate::services::workflow_service::WorkflowService;

pub struct WorkflowSchedulerService;

impl WorkflowSchedulerService {
    pub fn spawn(app_handle: AppHandle) {
        let running = Arc::new(Mutex::new(HashSet::<String>::new()));

        tauri::async_runtime::spawn(async move {
            loop {
                if let Err(e) = Self::tick(&app_handle, &running).await {
                    log::error!("Workflow scheduler tick failed: {}", e);
                }

                tokio::time::sleep(Duration::from_secs(30)).await;
            }
        });
    }

    async fn tick(app_handle: &AppHandle, running: &Arc<Mutex<HashSet<String>>>) -> Result<(), String> {
        let projects = ProjectService::discover_projects().map_err(|e| e.to_string())?;

        for project in projects {
            let workflows = match WorkflowService::load_project_workflows(&project.id) {
                Ok(w) => w,
                Err(e) => {
                    log::warn!("Failed to load workflows for {}: {}", project.id, e);
                    continue;
                }
            };

            for mut workflow in workflows {
                let Some(schedule) = workflow.schedule.as_mut() else {
                    continue;
                };

                if !schedule.enabled {
                    continue;
                }

                let tz = schedule
                    .timezone
                    .as_deref()
                    .unwrap_or("UTC")
                    .parse::<Tz>()
                    .unwrap_or(chrono_tz::UTC);

                let parsed_schedule = match Schedule::from_str(&schedule.cron) {
                    Ok(s) => s,
                    Err(e) => {
                        log::warn!("Invalid cron expression for workflow {}: {}", workflow.id, e);
                        continue;
                    }
                };

                let now_local = Utc::now().with_timezone(&tz);

                // initialize next run if missing
                if schedule.next_run_at.is_none() {
                    if let Some(next_local) = parsed_schedule.after(&now_local).next() {
                        schedule.next_run_at = Some(next_local.with_timezone(&Utc).to_rfc3339());
                        let _ = WorkflowService::save_workflow(&workflow);
                    }
                    continue;
                }

                let Some(next_run_at) = schedule
                    .next_run_at
                    .as_deref()
                    .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
                    .map(|dt| dt.with_timezone(&Utc))
                else {
                    schedule.next_run_at = None;
                    let _ = WorkflowService::save_workflow(&workflow);
                    continue;
                };

                if next_run_at > Utc::now() {
                    continue;
                }

                let run_key = format!("{}::{}", workflow.project_id, workflow.id);
                {
                    let mut guard = running.lock().map_err(|_| "scheduler lock poisoned".to_string())?;
                    if guard.contains(&run_key) {
                        continue;
                    }
                    guard.insert(run_key.clone());
                }

                // Calculate next scheduled run before we execute
                if let Some(next_local) = parsed_schedule.after(&now_local).next() {
                    schedule.next_run_at = Some(next_local.with_timezone(&Utc).to_rfc3339());
                } else {
                    schedule.next_run_at = None;
                }
                schedule.last_triggered_at = Some(Utc::now().to_rfc3339());
                let _ = WorkflowService::save_workflow(&workflow);

                let app = app_handle.clone();
                let running_ref = running.clone();
                let project_id = workflow.project_id.clone();
                let workflow_id = workflow.id.clone();
                let run_key_clone = run_key.clone();

                tauri::async_runtime::spawn(async move {
                    let _ = app.emit("workflow-scheduled-started", serde_json::json!({
                        "project_id": project_id,
                        "workflow_id": workflow_id,
                        "trigger": "schedule"
                    }));

                    let app_for_progress = app.clone();

                    let result = WorkflowService::execute_workflow(
                        &project_id,
                        &workflow_id,
                        None,
                        move |progress| {
                            let _ = app_for_progress.emit("workflow-progress", &progress);
                        },
                    )
                    .await;

                    match result {
                        Ok(execution) => {
                            let _ = app.emit("workflow-scheduled-finished", serde_json::json!({
                                "project_id": project_id,
                                "workflow_id": workflow_id,
                                "status": format!("{:?}", execution.status)
                            }));
                        }
                        Err(e) => {
                            let _ = app.emit("workflow-scheduled-failed", serde_json::json!({
                                "project_id": project_id,
                                "workflow_id": workflow_id,
                                "error": e.to_string()
                            }));
                        }
                    }

                    if let Ok(mut guard) = running_ref.lock() {
                        guard.remove(&run_key_clone);
                    }
                });
            }
        }

        Ok(())
    }
}
