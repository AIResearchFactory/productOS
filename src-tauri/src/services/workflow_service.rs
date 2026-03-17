use crate::models::ai::Message;
use crate::models::workflow::*;
use crate::services::ai_service::AIService;
use crate::services::output_cleaner_service::OutputCleanerService;
use crate::services::project_service::ProjectService;
use crate::services::skill_service::SkillService;
use crate::services::chat_service::ChatService;
use crate::services::artifact_service::ArtifactService;
use chrono::Utc;
use futures_util::stream::{FuturesUnordered, StreamExt};
use glob::glob as glob_pattern;
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};

pub struct WorkflowService;

impl WorkflowService {
    /// Load all workflows for a project
    /// Reads all .json files from {projects}/{project_id}/.workflows/
    pub fn load_project_workflows(project_id: &str) -> Result<Vec<Workflow>, WorkflowError> {
        let project_path = ProjectService::resolve_project_path(project_id).map_err(|e| {
            WorkflowError::ReadError(std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                format!("Failed to resolve project path: {}", e),
            ))
        })?;

        let workflows_dir = project_path.join(".workflows");

        // If directory doesn't exist, return empty list
        if !workflows_dir.exists() {
            return Ok(Vec::new());
        }

        let mut workflows = Vec::new();

        // Read all .json files
        let entries = fs::read_dir(&workflows_dir).map_err(WorkflowError::ReadError)?;

        for entry in entries {
            let entry = entry?;
            let path = entry.path();

            // Only process .json files
            if path.extension().and_then(|s| s.to_str()) == Some("json") {
                // Read and deserialize each workflow, skipping invalid files
                match fs::read_to_string(&path) {
                    Ok(content) => {
                        match serde_json::from_str::<Workflow>(&content) {
                            Ok(workflow) => workflows.push(workflow),
                            Err(e) => {
                                log::warn!(
                                    "Skipping workflow file {:?} due to parse error: {}",
                                    path, e
                                );
                            }
                        }
                    }
                    Err(e) => {
                        log::warn!("Skipping workflow file {:?} - could not read: {}", path, e);
                    }
                }
            }
        }

        Ok(workflows)
    }

    /// Load a specific workflow by ID
    /// Path: {project}/.workflows/{workflow_id}.json
    pub fn load_workflow(project_id: &str, workflow_id: &str) -> Result<Workflow, WorkflowError> {
        let project_path = ProjectService::resolve_project_path(project_id).map_err(|e| {
            WorkflowError::ReadError(std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                format!("Failed to resolve project path: {}", e),
            ))
        })?;

        let workflow_path = project_path
            .join(".workflows")
            .join(format!("{}.json", workflow_id));

        // Check if file exists
        if !workflow_path.exists() {
            return Err(WorkflowError::NotFound(format!(
                "Workflow {} not found in project {}",
                workflow_id, project_id
            )));
        }

        // Read and deserialize
        let content = fs::read_to_string(&workflow_path)?;
        let workflow: Workflow = serde_json::from_str(&content)
            .map_err(|e| WorkflowError::ParseError(format!("Failed to parse workflow: {}", e)))?;

        Ok(workflow)
    }

    /// Save a workflow to disk
    /// Validates, creates directory if needed, and saves as JSON
    pub fn save_workflow(workflow: &Workflow) -> Result<(), WorkflowError> {
        // Validate workflow first
        workflow
            .validate()
            .map_err(WorkflowError::ValidationError)?;

        let project_path = ProjectService::resolve_project_path(&workflow.project_id).map_err(|e| {
            WorkflowError::ReadError(std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                format!("Failed to resolve project path: {}", e),
            ))
        })?;

        let workflows_dir = project_path.join(".workflows");

        // Create .workflows/ directory if it doesn't exist
        if !workflows_dir.exists() {
            fs::create_dir_all(&workflows_dir)?;
        }

        // Serialize to pretty JSON
        let json_content = serde_json::to_string_pretty(workflow).map_err(|e| {
            WorkflowError::ParseError(format!("Failed to serialize workflow: {}", e))
        })?;

        // Write to file
        let workflow_path = workflows_dir.join(format!("{}.json", workflow.id));
        fs::write(&workflow_path, json_content)?;

        Ok(())
    }

    /// Delete a workflow
    /// Removes the JSON file, returns Ok even if file doesn't exist
    pub fn delete_workflow(project_id: &str, workflow_id: &str) -> Result<(), WorkflowError> {
        let project_path = ProjectService::resolve_project_path(project_id).map_err(|e| {
            WorkflowError::ReadError(std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                format!("Failed to resolve project path: {}", e),
            ))
        })?;

        let workflow_path = project_path
            .join(".workflows")
            .join(format!("{}.json", workflow_id));

        // Remove file if it exists (ignore error if file doesn't exist)
        if workflow_path.exists() {
            fs::remove_file(&workflow_path)?;
        }

        Ok(())
    }

    // ===== Execution Engine =====

    /// Execute a workflow by ID
    /// Main entry point for workflow execution
    pub async fn execute_workflow<F>(
        project_id: &str,
        workflow_id: &str,
        parameters: Option<HashMap<String, String>>,
        progress_callback: F,
    ) -> Result<WorkflowExecution, WorkflowError>
    where
        F: Fn(WorkflowProgress) + Send + Sync,
    {
        // Load workflow
        let mut workflow = Self::load_workflow(project_id, workflow_id)?;

        // Create execution instance
        let mut execution = WorkflowExecution {
            workflow_id: workflow_id.to_string(),
            started: Utc::now().to_rfc3339(),
            completed: None,
            status: ExecutionStatus::Running,
            error: None,
            step_results: HashMap::new(),
        };

        // Execute steps
        let result = Self::execute_steps(
            &workflow,
            &mut execution,
            project_id,
            &parameters,
            &progress_callback,
        )
        .await;

        // Update execution status
        execution.completed = Some(Utc::now().to_rfc3339());
        execution.status = match &result {
            Ok(_) => ExecutionStatus::Completed,
            Err(e) => {
                execution.error = Some(e.to_string());
                // Check if any steps succeeded
                let has_success = execution
                    .step_results
                    .values()
                    .any(|r| matches!(r.status, StepStatus::Completed));
                if has_success {
                    ExecutionStatus::PartialSuccess
                } else {
                    ExecutionStatus::Failed
                }
            }
        };

        // Update workflow metadata
        workflow.status = Some(format!("{:?}", execution.status));
        workflow.last_run = Some(execution.started.clone());
        Self::save_workflow(&workflow)?;

        Ok(execution)
    }

    /// Execute workflow steps in dependency order
    async fn execute_steps<F>(
        workflow: &Workflow,
        execution: &mut WorkflowExecution,
        project_id: &str,
        parameters: &Option<HashMap<String, String>>,
        progress_callback: &F,
    ) -> Result<(), WorkflowError>
    where
        F: Fn(WorkflowProgress) + Send + Sync,
    {
        // Get execution layers
        let layers = Self::get_execution_layers(&workflow.steps)?;
        let total_steps = workflow.steps.len();
        let mut completed_count = 0;

        // Execute layers in sequence
        for layer in layers {
            let mut futures = FuturesUnordered::new();

            for step in layer {
                // Check if all dependencies were successful
                let deps_satisfied = step.depends_on.iter().all(|dep_id| {
                    execution
                        .step_results
                        .get(dep_id)
                        .map(|r| matches!(r.status, StepStatus::Completed))
                        .unwrap_or(true) // No dependency means true
                });

                if !deps_satisfied {
                    // Skip this step
                    execution.step_results.insert(
                        step.id.clone(),
                        StepResult {
                            step_id: step.id.clone(),
                            status: StepStatus::Skipped,
                            started: Utc::now().to_rfc3339(),
                            completed: Some(Utc::now().to_rfc3339()),
                            output_files: vec![],
                            error: Some("Dependencies not satisfied".to_string()),
                            detailed_error: None,
                            logs: vec![],
                            next_step_id: None,
                        },
                    );
                    completed_count += 1;

                    // Emit skip status
                    let progress_percent = ((completed_count as f32 / total_steps as f32) * 100.0) as u32;
                    progress_callback(WorkflowProgress {
                        workflow_id: workflow.id.clone(),
                        step_name: step.name.clone(),
                        status: "skipped".to_string(),
                        progress_percent,
                    });
                    continue;
                }

                // Emit running status
                let progress_percent = ((completed_count as f32 / total_steps as f32) * 100.0) as u32;
                progress_callback(WorkflowProgress {
                    workflow_id: workflow.id.clone(),
                    step_name: step.name.clone(),
                    status: "running".to_string(),
                    progress_percent,
                });

                // Prepare for parallel execution
                let step_clone = step.clone();
                let project_id_owned = project_id.to_string();
                let execution_snapshot = execution.clone();
                let parameters_owned = parameters.clone();

                futures.push(async move {
                    let result = Self::execute_step(
                        &step_clone,
                        &project_id_owned,
                        &execution_snapshot,
                        &parameters_owned,
                    ).await;
                    (step_clone, result)
                });
            }

            // Collect results from the current layer
            while let Some((step, result)) = futures.next().await {
                execution
                    .step_results
                    .insert(step.id.clone(), result.clone());
                completed_count += 1;

                // Emit completed/failed status
                let status_str = match result.status {
                    StepStatus::Completed => "completed",
                    StepStatus::Failed => "failed",
                    _ => "unknown",
                };

                let progress_percent = ((completed_count as f32 / total_steps as f32) * 100.0) as u32;
                progress_callback(WorkflowProgress {
                    workflow_id: workflow.id.clone(),
                    step_name: step.name.clone(),
                    status: status_str.to_string(),
                    progress_percent,
                });

                // Handle failure
                if matches!(result.status, StepStatus::Failed) {
                    let continue_on_error = step.config.continue_on_error.unwrap_or(false);
                    if !continue_on_error {
                        return Err(WorkflowError::ExecutionError(format!(
                            "Step '{}' failed: {}",
                            step.name,
                            result.error.unwrap_or_default()
                        )));
                    }
                }
            }
        }

        Ok(())
    }

    /// Execute a single step with retry logic
    async fn execute_step(
        step: &WorkflowStep,
        project_id: &str,
        execution: &WorkflowExecution,
        parameters: &Option<HashMap<String, String>>,
    ) -> StepResult {
        let max_retries = step.config.max_retries.unwrap_or(0);
        let mut last_error = None;

        for attempt in 0..=max_retries {
            if attempt > 0 {
                // Wait before retry (exponential backoff)
                tokio::time::sleep(tokio::time::Duration::from_secs(2_u64.pow(attempt))).await;
            }

            let result = match &step.step_type {
                StepType::Input => Self::execute_input_step(step, project_id, parameters).await,
                StepType::Agent | StepType::Skill => {
                    Self::execute_agent_step(step, project_id, execution, parameters).await
                }
                StepType::Iteration => {
                    Self::execute_iteration_step(step, project_id, execution, parameters).await
                }
                StepType::Synthesis => {
                    Self::execute_synthesis_step(step, project_id, execution, parameters).await
                }
                StepType::Conditional => Self::execute_conditional_step(step, project_id).await,
                StepType::SubAgent => {
                    Self::execute_iteration_step(step, project_id, execution, parameters).await
                }
                _ => {
                    // Legacy step types
                    Self::execute_agent_step(step, project_id, execution, parameters).await
                }
            };

            match result {
                Ok(step_result) => return step_result,
                Err(e) => {
                    last_error = Some(e);
                }
            }
        }

        // All retries failed
        let err_msg = format!(
            "Failed after {} retries: {}",
            max_retries,
            last_error.unwrap_or_default()
        );
        StepResult {
            step_id: step.id.clone(),
            status: StepStatus::Failed,
            started: Utc::now().to_rfc3339(),
            completed: Some(Utc::now().to_rfc3339()),
            output_files: vec![],
            error: Some(err_msg.clone()),
            detailed_error: Some(err_msg),
            logs: vec![],
            next_step_id: None,
        }
    }

    /// Helper to replace parameters in a string
    fn replace_parameters(text: &str, parameters: &Option<HashMap<String, String>>) -> String {
        let mut result = text.to_string();
        if let Some(params) = parameters {
            for (key, value) in params {
                // Support both {{key}} and {key}
                let placeholder1 = format!("{{{{{}}}}}", key);
                let placeholder2 = format!("{{{}}}", key);
                result = result.replace(&placeholder1, value);
                result = result.replace(&placeholder2, value);
            }
        }
        result
    }

    /// Safely join a relative path to the project root and ensure it does not escape.
    fn safe_join_project(project_path: &Path, relative_path: &str) -> Result<PathBuf, String> {
        let candidate = Path::new(relative_path);

        if candidate.is_absolute() {
            return Err("Absolute paths are not allowed in workflow file operations".to_string());
        }

        if relative_path.contains("{{") && relative_path.contains("}}") {
            let start = relative_path.find("{{").unwrap_or(0);
            let end = relative_path.find("}}").unwrap_or(relative_path.len());
            let param_name = &relative_path[start + 2..end];
            return Err(format!(
                "Required parameter '{}' was not provided",
                param_name
            ));
        }

        if candidate
            .components()
            .any(|c| matches!(c, std::path::Component::ParentDir | std::path::Component::Prefix(_)))
        {
            return Err("Path traversal is not allowed in workflow file operations".to_string());
        }

        let full = project_path.join(candidate);
        let canonical_base = project_path.canonicalize().unwrap_or_else(|_| project_path.to_path_buf());
        // When the target file doesn't exist yet (e.g. an output file to be created),
        // canonicalize() will fail. Fall back to joining onto the already-canonical base
        // so the starts_with check works correctly even on systems with symlinked temp dirs.
        let canonical_full = full.canonicalize().unwrap_or_else(|_| canonical_base.join(candidate));

        if !canonical_full.starts_with(&canonical_base) {
            return Err("Resolved path escapes project directory".to_string());
        }

        Ok(full)
    }

    /// Execute input step - read data from various sources
    async fn execute_input_step(
        step: &WorkflowStep,
        project_id: &str,
        parameters: &Option<HashMap<String, String>>,
    ) -> Result<StepResult, String> {
        let started = Utc::now().to_rfc3339();
        let mut logs = Vec::new();

        let source_type = step
            .config
            .source_type
            .as_deref()
            .unwrap_or("ProjectFile");

        // Apply parameter substitution to source_value
        let raw_source_value = step
            .config
            .source_value
            .as_ref()
            .map(|s| s.clone())
            .unwrap_or_else(|| "".to_string());
        let source_value = Self::replace_parameters(&raw_source_value, parameters);

        // Apply parameter substitution to output_file
        let raw_output_file = step
            .config
            .output_file
            .as_ref()
            .ok_or("output_file not specified")?;
        let output_file = Self::replace_parameters(raw_output_file, parameters);

        logs.push(format!("Reading from source type: {}", source_type));

        // Get project directory using ProjectService for accurate path resolution
        let project = ProjectService::load_project_by_id(project_id)
            .map_err(|e| format!("Failed to load project: {}", e))?;
        let project_path = project.path;

        let content = match source_type {
            "TextInput" => {
                logs.push("Using direct text input".to_string());
                source_value.clone()
            }
            "FileUpload" | "ProjectFile" => {
                logs.push(format!("Reading from file: {}", source_value));
                let file_path = Self::safe_join_project(&project_path, &source_value)?;
                fs::read_to_string(&file_path).map_err(|e| format!("Failed to read file: {}", e))?
            }
            "ExternalUrl" => {
                logs.push(format!("Fetching from URL: {}", source_value));
                let response = reqwest::get(source_value)
                    .await
                    .map_err(|e| format!("Failed to fetch URL: {}", e))?;
                response
                    .text()
                    .await
                    .map_err(|e| format!("Failed to read response: {}", e))?
            }
            _ => return Err(format!("Unknown source type: {}", source_type)),
        };

        // Write to output file
        let output_path = Self::safe_join_project(&project_path, &output_file)?;
        if let Some(parent) = output_path.parent() {
            fs::create_dir_all(parent).map_err(|e| format!("Failed to create directory: {}", e))?;
        }
        fs::write(&output_path, content)
            .map_err(|e| format!("Failed to write output file: {}", e))?;

        logs.push(format!("Wrote output to: {}", output_file));

        Ok(StepResult {
            step_id: step.id.clone(),
            status: StepStatus::Completed,
            started,
            completed: Some(Utc::now().to_rfc3339()),
            output_files: vec![output_file.clone()],
            error: None,
            detailed_error: None,
            logs,
            next_step_id: None,
        })
    }

    /// Execute agent step - use skill with Claude API
    async fn execute_agent_step(
        step: &WorkflowStep,
        project_id: &str,
        _execution: &WorkflowExecution,
        parameters: &Option<HashMap<String, String>>,
    ) -> Result<StepResult, String> {
        let started = Utc::now().to_rfc3339();
        let mut logs = Vec::new();

        // Load skill
        let skill_id = step
            .config
            .skill_id
            .as_ref()
            .ok_or("skill_id not specified")?;
        logs.push(format!("Loading skill: {}", skill_id));

        let skill = SkillService::load_skill(skill_id)
            .map_err(|e| format!("Failed to load skill: {}", e))?;

        // Render prompt with parameters
        let mut prompt = skill.prompt_template.clone();
        if let Some(params) = step.config.parameters.as_object() {
            for (key, value) in params {
                let placeholder = format!("{{{{{}}}}}", key);
                let value_string = value.to_string();
                let value_str = value.as_str().unwrap_or(&value_string);
                prompt = prompt.replace(&placeholder, value_str);
            }
        }

        // Apply runtime parameters to prompt
        prompt = Self::replace_parameters(&prompt, parameters);

        // Build context from input files
        let project = ProjectService::load_project_by_id(project_id)
            .map_err(|e| format!("Failed to load project: {}", e))?;
        let project_path = project.path;

        let mut context = String::new();
        if let Some(input_files) = &step.config.input_files {
            for raw_file_name in input_files {
                // Apply parameter substitution to file names
                let file_name = Self::replace_parameters(raw_file_name, parameters);

                logs.push(format!("Reading input file: {}", file_name));
                let file_path = Self::safe_join_project(&project_path, &file_name)?;
                let file_content = fs::read_to_string(&file_path)
                    .map_err(|e| format!("Failed to read input file {}: {}", file_name, e))?;
                context.push_str(&format!("\n\n## File: {}\n\n{}", file_name, file_content));
            }
        }

        if !context.is_empty() {
            prompt.push_str(&format!("\n\nContext:\n{}", context));
        }

        // Context fork logic
        if let Some(context_type) = &step.config.context {
            if context_type == "fork" {
                if let Some(forked_history) = Self::get_context_fork(project_id).await {
                    prompt.push_str(&format!("\n\n### Additional Context (from current chat) ###\n{}", forked_history));
                }
            }
        }

        // Consolidation directive
        prompt.push_str("\n\nIMPORTANT: Return a single consolidated Markdown report ONLY. Do NOT create separate files or directories using any tools (e.g. write_to_file). Your entire output will be saved to a single file by the system.");

        logs.push("Calling AI Service".to_string());

        // Call AI Service
        let ai_service = AIService::new()
            .await
            .map_err(|e| format!("Failed to initialize AI Service: {}", e))?;

        let messages = vec![Message {
            role: "user".to_string(),
            content: prompt,
            tool_calls: None,
            tool_results: None,
        }];

        let response_obj = ai_service
            .chat(messages, None, Some(project_id.to_string()))
            .await
            .map_err(|e| format!("AI Service error: {}", e))?;

        let response = OutputCleanerService::clean(&response_obj.content);

        logs.push(format!("Received response ({} chars)", response.len()));

        // Create Artifact if specified
        if let Some(artifact_type) = &step.config.artifact_type {
            let title = step.config.artifact_title.as_ref()
                .cloned()
                .unwrap_or_else(|| format!("Generated {}", artifact_type.display_name()));
            
            logs.push(format!("Creating artifact: {} ({:?})", title, artifact_type));
            
            match ArtifactService::create_artifact(project_id, artifact_type.clone(), &title) {
                Ok(mut artifact) => {
                    artifact.content = response.clone();
                    if let Err(e) = ArtifactService::save_artifact(&artifact) {
                        logs.push(format!("Warning: Failed to save artifact: {}", e));
                    } else {
                        logs.push(format!("Artifact saved: {}", artifact.id));
                    }
                },
                Err(e) => logs.push(format!("Warning: Failed to create artifact: {}", e)),
            }
        }

        // Save to output file
        let raw_output_file = step
            .config
            .output_file
            .as_ref()
            .ok_or("output_file not specified")?;

        // Apply parameter substitution to output file
        let output_file = Self::replace_parameters(raw_output_file, parameters);

        let output_path = Self::safe_join_project(&project_path, &output_file)?;
        if let Some(parent) = output_path.parent() {
            fs::create_dir_all(parent).map_err(|e| format!("Failed to create directory: {}", e))?;
        }
        fs::write(&output_path, &response)
            .map_err(|e| format!("Failed to write output file: {}", e))?;

        logs.push(format!("Wrote output to: {}", output_file));

        Ok(StepResult {
            step_id: step.id.clone(),
            status: StepStatus::Completed,
            started,
            completed: Some(Utc::now().to_rfc3339()),
            output_files: vec![output_file.clone()],
            error: None,
            detailed_error: None,
            logs,
            next_step_id: None,
        })
    }

    /// Execute iteration step - run skill for multiple items
    async fn execute_iteration_step(
        step: &WorkflowStep,
        project_id: &str,
        execution: &WorkflowExecution,
        parameters: &Option<HashMap<String, String>>,
    ) -> Result<StepResult, String> {
        let started = Utc::now().to_rfc3339();
        let mut logs = Vec::new();

        // Get items list
        let items_source_raw = step
            .config
            .items_source
            .as_ref()
            .ok_or("items_source not specified")?;

        // Resolve dynamic items list
        let items = Self::resolve_items_list(items_source_raw, project_id, execution).await?;

        logs.push(format!("Processing {} items", items.len()));

        let parallel = step.config.parallel.unwrap_or(false);
        let mut output_files = Vec::new();

        if parallel {
            logs.push("Running in parallel".to_string());

            // Execute in parallel
            let mut futures = FuturesUnordered::new();
            for item in &items {
                let future =
                    Self::execute_iteration_item(step, item, project_id, execution, parameters);
                futures.push(future);
            }

            while let Some(result) = futures.next().await {
                match result {
                    Ok((file, item_logs)) => {
                        logs.extend(item_logs);
                        logs.push(format!("Completed item, output: {}", file));
                        output_files.push(file);
                    }
                    Err(e) => {
                        logs.push(format!("Item failed: {}", e));
                        if !step.config.continue_on_error.unwrap_or(false) {
                            return Err(e);
                        }
                    }
                }
            }
        } else {
            logs.push("Running sequentially".to_string());

            // Execute sequentially
            for item in &items {
                match Self::execute_iteration_item(step, item, project_id, execution, parameters)
                    .await
                {
                    Ok((file, item_logs)) => {
                        logs.extend(item_logs);
                        output_files.push(file);
                    }
                    Err(e) => {
                        logs.push(format!("Item '{}' failed: {}", item, e));
                        if !step.config.continue_on_error.unwrap_or(false) {
                            return Err(e);
                        }
                    }
                }
            }
        }

        Ok(StepResult {
            step_id: step.id.clone(),
            status: StepStatus::Completed,
            started,
            completed: Some(Utc::now().to_rfc3339()),
            output_files,
            error: None,
            detailed_error: None,
            logs,
            next_step_id: None,
        })
    }

    /// Execute single iteration item
    async fn execute_iteration_item(
        step: &WorkflowStep,
        item: &str,
        project_id: &str,
        _execution: &WorkflowExecution,
        parameters: &Option<HashMap<String, String>>,
    ) -> Result<(String, Vec<String>), String> {
        let mut logs = Vec::new();
        // Load skill
        let skill_id = step
            .config
            .skill_id
            .as_ref()
            .ok_or("skill_id not specified")?;

        logs.push(format!("Executing item '{}' with skill '{}'", item, skill_id));

        let skill = SkillService::load_skill(skill_id)
            .map_err(|e| format!("Failed to load skill: {}", e))?;

        // Render prompt with parameters, replacing {{item}} or {item}
        let mut prompt = skill.prompt_template.clone();
        prompt = prompt.replace("{{item}}", item);
        prompt = prompt.replace("{item}", item);

        if let Some(params) = step.config.parameters.as_object() {
            for (key, value) in params {
                let placeholder = format!("{{{{{}}}}}", key);
                let value_string = value.to_string();
                let value_str = value.as_str().unwrap_or(&value_string);
                prompt = prompt.replace(&placeholder, value_str);

                let placeholder_alt = format!("{{{}}}", key);
                prompt = prompt.replace(&placeholder_alt, value_str);
            }
        }

        // Apply runtime parameters
        prompt = Self::replace_parameters(&prompt, parameters);

        // Context fork logic
        if let Some(context_type) = &step.config.context {
            if context_type == "fork" {
                if let Some(forked_history) = Self::get_context_fork(project_id).await {
                    prompt.push_str(&format!("\n\n### Additional Context (from latest chat) ###\n{}", forked_history));
                }
            }
        }

        // Consolidation directive
        prompt.push_str("\n\nIMPORTANT: Return a single consolidated Markdown report ONLY. Do NOT create separate files or directories using any tools. Your entire output will be saved to a single file by the system.");

        // Call AI Service
        let ai_service = AIService::new()
            .await
            .map_err(|e| format!("Failed to initialize AI Service: {}", e))?;

        let messages = vec![Message {
            role: "user".to_string(),
            content: prompt,
            tool_calls: None,
            tool_results: None,
        }];

        let response_obj = ai_service
            .chat(messages, None, Some(project_id.to_string()))
            .await
            .map_err(|e| format!("AI Service error: {}", e))?;

        let response = OutputCleanerService::clean(&response_obj.content);


        let output_pattern = step
            .config
            .output_pattern
            .as_ref()
            .ok_or("output_pattern not specified")?;

        // Apply runtime parameters to output pattern
        let mut output_file = Self::replace_parameters(output_pattern, parameters);

        // Replace both {item} and {competitor_name} with the item
        output_file = output_file.replace("{{item}}", item);
        output_file = output_file.replace("{item}", item);
        output_file = output_file.replace("{{competitor_name}}", item);
        output_file = output_file.replace("{competitor_name}", item);

        logs.push(format!("Saving output for '{}' to '{}'", item, output_file));

        let project = ProjectService::load_project_by_id(project_id)
            .map_err(|e| format!("Failed to load project: {}", e))?;
        let project_path = project.path;
        let output_path = Self::safe_join_project(&project_path, &output_file)?;

        if let Some(parent) = output_path.parent() {
            fs::create_dir_all(parent).map_err(|e| format!("Failed to create directory: {}", e))?;
        }
        fs::write(&output_path, &response)
            .map_err(|e| format!("Failed to write output file: {}", e))?;

        Ok((output_file, logs))
    }

    /// Execute synthesis step - combine multiple inputs
    async fn execute_synthesis_step(
        step: &WorkflowStep,
        project_id: &str,
        _execution: &WorkflowExecution,
        parameters: &Option<HashMap<String, String>>,
    ) -> Result<StepResult, String> {
        let started = Utc::now().to_rfc3339();
        let mut logs = Vec::new();

        // Load skill
        let skill_id = step
            .config
            .skill_id
            .as_ref()
            .ok_or("skill_id not specified")?;
        logs.push(format!("Loading skill: {}", skill_id));

        let skill = SkillService::load_skill(skill_id)
            .map_err(|e| format!("Failed to load skill: {}", e))?;

        // Get project directory
        let project = ProjectService::load_project_by_id(project_id)
            .map_err(|e| format!("Failed to load project: {}", e))?;
        let project_path = project.path;

        // Resolve file patterns (support globs)
        let input_files = step
            .config
            .input_files
            .as_ref()
            .ok_or("input_files not specified")?;

        // Apply parameter substitution to input file patterns
        let mut substituted_input_files = Vec::new();
        for file_pattern in input_files {
            substituted_input_files.push(Self::replace_parameters(file_pattern, parameters));
        }

        let resolved_files = Self::resolve_file_patterns(&project_path, &substituted_input_files)?; // Note: verify resolve_file_patterns signature
        logs.push(format!("Resolved {} input files", resolved_files.len()));

        // Read all input files
        let mut context = String::new();
        for file_path in &resolved_files {
            logs.push(format!("Reading: {}", file_path.display()));
            let content = fs::read_to_string(file_path)
                .map_err(|e| format!("Failed to read {}: {}", file_path.display(), e))?;

            let relative_path = file_path
                .strip_prefix(&project_path)
                .unwrap_or(file_path)
                .display();
            context.push_str(&format!("\n\n## File: {}\n\n{}", relative_path, content));
        }

        // Build synthesis prompt
        let mut prompt = skill.prompt_template.clone();
        if let Some(params) = step.config.parameters.as_object() {
            for (key, value) in params {
                let placeholder = format!("{{{{{}}}}}", key);
                let value_string = value.to_string();
                let value_str = value.as_str().unwrap_or(&value_string);
                prompt = prompt.replace(&placeholder, value_str);
            }
        }

        // Apply runtime parameters
        prompt = Self::replace_parameters(&prompt, parameters);

        // Context fork logic
        if let Some(context_type) = &step.config.context {
            if context_type == "fork" {
                if let Some(forked_history) = Self::get_context_fork(project_id).await {
                    prompt.push_str(&format!("\n\n### Additional Context (from latest chat) ###\n{}", forked_history));
                }
            }
        }

        // Consolidation directive
        prompt.push_str("\n\nIMPORTANT: Return a single consolidated Markdown report ONLY. Do NOT create separate files or directories using any tools. Your entire output will be saved to a single file by the system.");

        prompt.push_str(&format!("\n\nInput files to synthesize:\n{}", context));

        logs.push("Calling AI Service for synthesis".to_string());

        // Call AI Service
        let ai_service = AIService::new()
            .await
            .map_err(|e| format!("Failed to initialize AI Service: {}", e))?;

        let messages = vec![Message {
            role: "user".to_string(),
            content: prompt,
            tool_calls: None,
            tool_results: None,
        }];

        let response_obj = ai_service
            .chat(messages, None, Some(project_id.to_string()))
            .await
            .map_err(|e| format!("AI Service error: {}", e))?;

        let response = OutputCleanerService::clean(&response_obj.content);
        logs.push(format!("Received synthesis ({} chars)", response.len()));

        // Save to output file
        let raw_output_file = step
            .config
            .output_file
            .as_ref()
            .ok_or("output_file not specified")?;

        // Apply parameter substitution to output file
        let output_file = Self::replace_parameters(raw_output_file, parameters);

        let output_path = Self::safe_join_project(&project_path, &output_file)?;
        if let Some(parent) = output_path.parent() {
            fs::create_dir_all(parent).map_err(|e| format!("Failed to create directory: {}", e))?;
        }
        fs::write(&output_path, &response)
            .map_err(|e| format!("Failed to write output file: {}", e))?;

        logs.push(format!("Wrote synthesis to: {}", output_file));

        Ok(StepResult {
            step_id: step.id.clone(),
            status: StepStatus::Completed,
            started,
            completed: Some(Utc::now().to_rfc3339()),
            output_files: vec![output_file.clone()],
            error: None,
            detailed_error: None,
            logs,
            next_step_id: None,
        })
    }

    /// Execute conditional step - evaluate condition
    async fn execute_conditional_step(
        step: &WorkflowStep,
        project_id: &str,
    ) -> Result<StepResult, String> {
        let started = Utc::now().to_rfc3339();
        let mut logs = Vec::new();

        let condition = step
            .config
            .condition
            .as_ref()
            .ok_or("condition not specified")?;

        logs.push(format!("Evaluating condition: {}", condition));

        // Evaluate condition
        let project = ProjectService::load_project_by_id(project_id)
            .map_err(|e| format!("Failed to load project: {}", e))?;
        let project_path = project.path;

        let result = Self::evaluate_condition(condition, &project_path)?;
        logs.push(format!("Condition result: {}", result));

        // Determine next step
        let next_step_id = if result {
            step.config.then_step.clone()
        } else {
            step.config.else_step.clone()
        };

        if let Some(ref next_id) = next_step_id {
            logs.push(format!("Next step: {}", next_id));
        }

        Ok(StepResult {
            step_id: step.id.clone(),
            status: StepStatus::Completed,
            started,
            completed: Some(Utc::now().to_rfc3339()),
            output_files: vec![],
            error: None,
            detailed_error: None,
            logs,
            next_step_id,
        })
    }

    /// Helper to get the context for the step
    async fn get_context_fork(project_id: &str) -> Option<String> {
        // Load latest chat
        if let Ok(files) = ChatService::get_chat_files(project_id).await {
            if let Some(latest) = files.first() {
                if let Ok(messages) = ChatService::load_chat_from_file(project_id, latest).await {
                    let mut history = String::new();
                    for msg in messages {
                        let role = if msg.role == "user" { "User" } else { "Assistant" };
                        history.push_str(&format!("\n{}: {}\n", role, msg.content));
                    }
                    if !history.is_empty() {
                        return Some(history);
                    }
                }
            }
        }
        None
    }

    // ===== Helper Functions =====

    /// Topologically sort steps by dependencies
    #[allow(dead_code)]
    fn topological_sort(steps: &[WorkflowStep]) -> Result<Vec<WorkflowStep>, WorkflowError> {
        let mut sorted = Vec::new();
        let mut visited = HashSet::new();
        let mut temp_mark = HashSet::new();

        fn visit(
            step_id: &str,
            steps_map: &HashMap<String, WorkflowStep>,
            visited: &mut HashSet<String>,
            temp_mark: &mut HashSet<String>,
            sorted: &mut Vec<WorkflowStep>,
        ) -> Result<(), WorkflowError> {
            if visited.contains(step_id) {
                return Ok(());
            }
            if temp_mark.contains(step_id) {
                return Err(WorkflowError::DependencyCycle);
            }

            temp_mark.insert(step_id.to_string());

            if let Some(step) = steps_map.get(step_id) {
                for dep_id in &step.depends_on {
                    visit(dep_id, steps_map, visited, temp_mark, sorted)?;
                }
            }

            temp_mark.remove(step_id);
            visited.insert(step_id.to_string());

            if let Some(step) = steps_map.get(step_id) {
                sorted.push(step.clone());
            }

            Ok(())
        }

        let steps_map: HashMap<String, WorkflowStep> =
            steps.iter().map(|s| (s.id.clone(), s.clone())).collect();

        for step in steps {
            if !visited.contains(&step.id) {
                visit(
                    &step.id,
                    &steps_map,
                    &mut visited,
                    &mut temp_mark,
                    &mut sorted,
                )?;
            }
        }

        Ok(sorted)
    }

    /// Group steps into execution layers based on dependencies
    fn get_execution_layers(steps: &[WorkflowStep]) -> Result<Vec<Vec<WorkflowStep>>, WorkflowError> {
        let mut layers = Vec::new();
        let mut executed = HashSet::new();
        let mut remaining: Vec<WorkflowStep> = steps.to_vec();

        while !remaining.is_empty() {
            let mut current_layer = Vec::new();
            let mut next_remaining = Vec::new();

            for step in remaining {
                let deps_satisfied = step.depends_on.iter().all(|dep| executed.contains(dep));
                if deps_satisfied {
                    current_layer.push(step);
                } else {
                    next_remaining.push(step);
                }
            }

            if current_layer.is_empty() {
                // This shouldn't happen if topological sort was successful and no cycles exist
                return Err(WorkflowError::DependencyCycle);
            }

            for step in &current_layer {
                executed.insert(step.id.clone());
            }

            layers.push(current_layer);
            remaining = next_remaining;
        }

        Ok(layers)
    }



    /// Resolve the list of items for iteration or sub-agent steps
    async fn resolve_items_list(
        items_source: &str,
        project_id: &str,
        execution: &WorkflowExecution,
    ) -> Result<Vec<String>, String> {
        let items_source = items_source.trim();
        
        // 1. If it's a JSON array literal, parse it
        if items_source.starts_with('[') {
            return serde_json::from_str::<Vec<String>>(items_source)
                .map_err(|e| format!("Failed to parse items JSON array: {}", e));
        }

        // 2. Check if it's a reference to a previous step output: {{steps.STEP_ID.output}}
        if items_source.starts_with("{{") && items_source.ends_with("}}") {
            let ref_inner = items_source.trim_start_matches("{{").trim_end_matches("}}").trim();
            if let Some(step_id) = ref_inner.strip_prefix("steps.").and_then(|s| s.strip_suffix(".output")) {
                if let Some(result) = execution.step_results.get(step_id) {
                    if let Some(file_name) = result.output_files.first() {
                        let project = ProjectService::load_project_by_id(project_id)
                            .map_err(|e| format!("Failed to load project: {}", e))?;
                        let file_path = project.path.join(file_name);
                        
                        if !file_path.exists() {
                            return Err(format!("Output file from step {} not found: {}", step_id, file_name));
                        }

                        let content = fs::read_to_string(&file_path)
                            .map_err(|e| format!("Failed to read output file from step {}: {}", step_id, e))?;
                        
                        // Try to parse content as JSON array
                        if let Ok(items) = serde_json::from_str::<Vec<String>>(&content) {
                            return Ok(items);
                        } else {
                            // If not JSON array, treat lines as items
                            return Ok(content.lines().map(|l| l.to_string()).filter(|l| !l.is_empty()).collect());
                        }
                    }
                }
            }
        }

        // 3. Treat as a file path relative to project
        let project = ProjectService::load_project_by_id(project_id)
            .map_err(|e| format!("Failed to load project: {}", e))?;
        let file_path = project.path.join(items_source);
        if file_path.exists() {
            let content = fs::read_to_string(&file_path)
                .map_err(|e| format!("Failed to read items file: {}", e))?;
            if let Ok(items) = serde_json::from_str::<Vec<String>>(&content) {
                return Ok(items);
            } else {
                return Ok(content.lines().map(|l| l.to_string()).filter(|l| !l.is_empty()).collect());
            }
        }

        Err(format!("Could not resolve items source: {}", items_source))
    }

    /// Resolve file patterns (expand globs)
    fn resolve_file_patterns(
        project_path: &Path,
        patterns: &[String],
    ) -> Result<Vec<PathBuf>, String> {
        let mut resolved = Vec::new();

        for pattern in patterns {
            // Check if pattern contains glob characters
            if pattern.contains('*') || pattern.contains('?') {
                let full_pattern = Self::safe_join_project(project_path, pattern)?;
                let pattern_str = full_pattern.to_str().ok_or("Invalid path pattern")?;

                // Glob crate requires forward slashes even on Windows
                let pattern_str = if cfg!(windows) {
                    pattern_str.replace("\\", "/")
                } else {
                    pattern_str.to_string()
                };

                for entry in glob_pattern(&pattern_str)
                    .map_err(|e| format!("Invalid glob pattern: {}", e))?
                {
                    match entry {
                        Ok(path) => {
                            let canonical_base = project_path
                                .canonicalize()
                                .unwrap_or_else(|_| project_path.to_path_buf());
                            let canonical_path = path.canonicalize().unwrap_or(path.clone());
                            if canonical_path.starts_with(&canonical_base) {
                                resolved.push(path);
                            }
                        }
                        Err(e) => return Err(format!("Glob error: {}", e)),
                    }
                }
            } else {
                // Plain file path
                resolved.push(Self::safe_join_project(project_path, pattern)?);
            }
        }

        Ok(resolved)
    }

    /// Evaluate a simple condition
    fn evaluate_condition(condition: &str, project_path: &Path) -> Result<bool, String> {
        // Simple condition parser
        // Supports: file_exists:filename
        if let Some(file_name) = condition.strip_prefix("file_exists:") {
            let file_path = Self::safe_join_project(project_path, file_name.trim())?;
            Ok(file_path.exists())
        } else {
            Err(format!("Unknown condition format: {}", condition))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::workflow::{StepConfig, StepType, WorkflowStep};
    use std::env;
    use std::sync::Mutex;
    use tempfile::TempDir;

    // Use a mutex to ensure tests run serially since they share environmental variables
    static TEST_MUTEX: Mutex<()> = Mutex::new(());

    fn setup_test_env() -> (TempDir, String) {
        let temp_dir = TempDir::new().unwrap();
        let project_id = "test-project";

        // Match the real app path resolution used by project service
        // <APPDATA>/ai-researcher/projects/<project_id>
        env::set_var("HOME", temp_dir.path().to_str().unwrap());
        env::set_var("APPDATA", temp_dir.path().to_str().unwrap());

        let projects_root = temp_dir.path().join("ai-researcher").join("projects");
        env::set_var("PROJECTS_DIR", projects_root.to_str().unwrap());

        // Create project directory and .metadata subfolder
        let project_dir = projects_root.join(project_id);
        fs::create_dir_all(&project_dir).unwrap();
        let metadata_dir = project_dir.join(".metadata");
        fs::create_dir_all(&metadata_dir).unwrap();

        // Write a minimal project.json so the project is considered valid
        let project_json = metadata_dir.join("project.json");
        let dummy_json = r#"{
            "id": "test-project",
            "name": "Test Project",
            "goal": "Test Goal",
            "skills": [],
            "created": "2024-01-01T00:00:00Z"
        }"#;
        std::fs::write(project_json, dummy_json).unwrap();

        (temp_dir, project_id.to_string())
    }

    fn create_test_workflow(project_id: &str, workflow_id: &str) -> Workflow {
        Workflow {
            id: workflow_id.to_string(),
            project_id: project_id.to_string(),
            name: "Test Workflow".to_string(),
            description: "A test workflow".to_string(),
            steps: vec![WorkflowStep {
                id: "step1".to_string(),
                name: "Step 1".to_string(),
                step_type: StepType::Skill,
                config: StepConfig {
                    skill_id: Some("skill-1".to_string()),
                    parameters: serde_json::json!({"key": "value"}),
                    ..Default::default()
                },
                depends_on: vec![],
            }],
            version: "1.0.0".to_string(),
            created: "2024-11-13T10:00:00Z".to_string(),
            updated: "2024-11-13T10:00:00Z".to_string(),
            status: None,
            last_run: None,
            active_execution_id: None,
            schedule: None,
        }
    }

    #[test]
    fn test_save_and_load_workflow() {
        let _lock = TEST_MUTEX.lock().unwrap_or_else(|e| e.into_inner());
        let (_temp_dir, project_id) = setup_test_env();
        let workflow = create_test_workflow(&project_id, "workflow-001");

        // Save workflow
        let result = WorkflowService::save_workflow(&workflow);
        assert!(result.is_ok());

        // Load workflow
        let loaded = WorkflowService::load_workflow(&project_id, "workflow-001");
        assert!(
            loaded.is_ok(),
            "Failed to load workflow: {:?}",
            loaded.err()
        );

        let loaded_workflow = loaded.unwrap();
        assert_eq!(loaded_workflow.id, "workflow-001");
        assert_eq!(loaded_workflow.name, "Test Workflow");
        assert_eq!(loaded_workflow.steps.len(), 1);
    }

    #[test]
    fn test_load_project_workflows() {
        let _lock = TEST_MUTEX.lock().unwrap_or_else(|e| e.into_inner());
        let (_temp_dir, project_id) = setup_test_env();

        // Save multiple workflows
        let workflow1 = create_test_workflow(&project_id, "workflow-001");
        let workflow2 = create_test_workflow(&project_id, "workflow-002");

        WorkflowService::save_workflow(&workflow1).unwrap();
        WorkflowService::save_workflow(&workflow2).unwrap();

        // Load all workflows
        let workflows = WorkflowService::load_project_workflows(&project_id);
        assert!(workflows.is_ok());

        let workflows = workflows.unwrap();
        assert_eq!(workflows.len(), 2);
    }

    #[test]
    fn test_delete_workflow() {
        let _lock = TEST_MUTEX.lock().unwrap_or_else(|e| e.into_inner());
        let (_temp_dir, project_id) = setup_test_env();
        let workflow = create_test_workflow(&project_id, "workflow-001");

        // Save and then delete
        WorkflowService::save_workflow(&workflow).unwrap();
        let result = WorkflowService::delete_workflow(&project_id, "workflow-001");
        assert!(result.is_ok());

        // Verify it's deleted
        let loaded = WorkflowService::load_workflow(&project_id, "workflow-001");
        assert!(loaded.is_err());
    }

    #[test]
    fn test_delete_nonexistent_workflow() {
        let _lock = TEST_MUTEX.lock().unwrap_or_else(|e| e.into_inner());
        let (_temp_dir, project_id) = setup_test_env();

        // Delete non-existent workflow (should succeed)
        let result = WorkflowService::delete_workflow(&project_id, "nonexistent");
        assert!(result.is_ok());
    }

    #[test]
    fn test_load_nonexistent_workflow() {
        let _lock = TEST_MUTEX.lock().unwrap_or_else(|e| e.into_inner());
        let (_temp_dir, project_id) = setup_test_env();

        let result = WorkflowService::load_workflow(&project_id, "nonexistent");
        assert!(result.is_err());

        if let Err(WorkflowError::NotFound(_)) = result {
            // Expected error
        } else {
            panic!("Expected NotFound error");
        }
    }

    #[test]
    fn test_save_invalid_workflow() {
        let _lock = TEST_MUTEX.lock().unwrap_or_else(|e| e.into_inner());
        let (_temp_dir, project_id) = setup_test_env();

        // Create invalid workflow (empty steps)
        let mut workflow = create_test_workflow(&project_id, "workflow-001");
        workflow.steps.clear();

        let result = WorkflowService::save_workflow(&workflow);
        assert!(result.is_err());

        if let Err(WorkflowError::ValidationError(_)) = result {
            // Expected error
        } else {
            panic!("Expected ValidationError");
        }
    }
    #[tokio::test]
    async fn test_parameter_substitution_in_input_step() {
        let _lock = TEST_MUTEX.lock().unwrap_or_else(|e| e.into_inner());
        let (temp_dir, project_id) = setup_test_env();

        // Create a dummy file to read
        let input_file_path = temp_dir
            .path()
            .join("ai-researcher")
            .join("projects")
            .join(&project_id)
            .join("input.txt");
        fs::write(&input_file_path, "Hello World").unwrap();

        // Create workflow with Input step using {{input_file}}
        let workflow = Workflow {
            id: "workflow-param".to_string(),
            project_id: project_id.clone(),
            name: "Param Workflow".to_string(),
            description: "Test params".to_string(),
            steps: vec![WorkflowStep {
                id: "step1".to_string(),
                name: "Read File".to_string(),
                step_type: StepType::Input,
                config: StepConfig {
                    skill_id: Some("skill-1".to_string()),
                    parameters: serde_json::json!({"key": "value"}),
                    source_type: Some("ProjectFile".to_string()),
                    source_value: Some("{{input_file}}".to_string()),
                    output_file: Some("output.txt".to_string()),
                    ..Default::default()
                },
                depends_on: vec![],
            }],
            version: "1.0.0".to_string(),
            created: "".to_string(),
            updated: "".to_string(),
            status: None,
            last_run: None,
            active_execution_id: None,
            schedule: None,
        };
        WorkflowService::save_workflow(&workflow).unwrap();

        // correct hashmap construction
        let mut params = std::collections::HashMap::new();
        params.insert("input_file".to_string(), "input.txt".to_string());

        // Execute workflow
        let result =
            WorkflowService::execute_workflow(&project_id, "workflow-param", Some(params), |_| {})
                .await;

        assert!(
            result.is_ok(),
            "Workflow execution failed: {:?}",
            result.err()
        );
        let execution = result.unwrap();
        assert_eq!(execution.status, ExecutionStatus::Completed);

        // check output file content
        let output_path = temp_dir
            .path()
            .join("ai-researcher")
            .join("projects")
            .join(&project_id)
            .join("output.txt");
        let content = fs::read_to_string(output_path).unwrap();
        assert_eq!(content, "Hello World");
    }
}



