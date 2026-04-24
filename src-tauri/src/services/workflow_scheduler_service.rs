use std::collections::HashSet;
use std::str::FromStr;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use chrono::{DateTime, Utc};
use chrono_tz::Tz;
use cron::Schedule;
use tauri::{AppHandle, Manager};

use crate::services::project_service::ProjectService;
use crate::services::workflow_service::WorkflowService;
use crate::services::background_workflow_service::BackgroundWorkflowService;

pub struct WorkflowSchedulerService;

impl WorkflowSchedulerService {
    pub fn spawn(app_handle: AppHandle) {
        let running = Arc::new(Mutex::new(HashSet::<String>::new()));

        tauri::async_runtime::spawn(async move {
            loop {
                if let Err(e) = Self::tick(Some(app_handle.clone()), &running).await {
                    log::error!("Workflow scheduler tick failed: {}", e);
                }

                tokio::time::sleep(Duration::from_secs(30)).await;
            }
        });
    }

    pub fn spawn_headless() {
        let running = Arc::new(Mutex::new(HashSet::<String>::new()));

        tokio::spawn(async move {
            loop {
                if let Err(e) = Self::tick(None, &running).await {
                    log::error!("Headless workflow scheduler tick failed: {}", e);
                }

                tokio::time::sleep(Duration::from_secs(30)).await;
            }
        });
    }

    async fn tick(app_handle: Option<AppHandle>, running: &Arc<Mutex<HashSet<String>>>) -> Result<(), String> {
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

                let running_ref = running.clone();
                let project_id = workflow.project_id.clone();
                let workflow_id = workflow.id.clone();
                let run_key_clone = run_key.clone();
                let h = app_handle.clone();

                tokio::spawn(async move {
                    match h {
                        Some(app) => {
                             let ai_service = app.state::<Arc<crate::services::ai_service::AIService>>().inner().clone();
                             BackgroundWorkflowService::execute_in_background(
                                project_id,
                                workflow_id,
                                None,
                                "schedule".to_string(),
                                app,
                                ai_service,
                            ).await;
                        }
                        None => {
                             if let Ok(ai_service) = crate::services::ai_service::AIService::new().await {
                                 let ai_service_arc = Arc::new(ai_service);
                                 BackgroundWorkflowService::execute_in_background_headless(
                                    project_id,
                                    workflow_id,
                                    None,
                                    "schedule".to_string(),
                                    ai_service_arc,
                                ).await;
                             }
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
