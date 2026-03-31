#[cfg(test)]
mod tests {
    use crate::models::workflow::*;
    use crate::services::workflow_service::WorkflowService;
    use std::collections::HashMap;
    use tempfile::TempDir;
    use std::fs;

    #[test]
    fn test_required_parameters_extraction() {
        let step = WorkflowStep {
            id: "step1".to_string(),
            name: "Test Step".to_string(),
            step_type: StepType::Input,
            config: StepConfig {
                source_value: Some("{{topic}}/{{query}}.md".to_string()),
                output_file: Some("output_{{user_id}}.md".to_string()),
                ..Default::default()
            },
            depends_on: vec![],
        };

        let params = step.required_parameters();
        assert_eq!(params.len(), 3);
        assert!(params.contains(&"topic".to_string()));
        assert!(params.contains(&"query".to_string()));
        assert!(params.contains(&"user_id".to_string()));
    }

    #[test]
    fn test_replace_parameters() {
        let mut params = HashMap::new();
        params.insert("topic".to_string(), "AI".to_string());
        params.insert("query".to_string(), "research".to_string());
        let parameters = Some(params);

        let input = "Research on {{topic}} for {{query}}".to_string();
        let result = WorkflowService::replace_parameters(&input, &parameters);
        assert_eq!(result, "Research on AI for research");

        let input_single = "Research on {topic} for {query}".to_string();
        let result_single = WorkflowService::replace_parameters(&input_single, &parameters);
        assert_eq!(result_single, "Research on AI for research");
    }

    #[tokio::test]
    async fn test_execute_workflow_missing_params() {
        // Setup temporary project directory
        let temp_dir = TempDir::new().unwrap();
        let mut projects_dir = temp_dir.path().join("projects");
        fs::create_dir_all(&projects_dir).unwrap();
        projects_dir = projects_dir.canonicalize().unwrap();
        
        // Mock the environment
        std::env::set_var("PROJECTS_DIR", projects_dir.to_str().unwrap());
        
        let project_id = "test-proj";
        let workflow_id = "test-wf";
        let project_path = projects_dir.join(project_id);
        let workflows_dir = project_path.join(".workflows");
        fs::create_dir_all(&workflows_dir).unwrap();

        let workflow = Workflow {
            id: workflow_id.to_string(),
            project_id: project_id.to_string(),
            name: "Test Workflow".to_string(),
            description: "Test".to_string(),
            steps: vec![WorkflowStep {
                id: "step1".to_string(),
                name: "Step 1".to_string(),
                step_type: StepType::Input,
                config: StepConfig {
                    source_value: Some("{{mandatory_param}}.txt".to_string()),
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

        // Save the workflow to the temp directory
        let workflow_json = serde_json::to_string(&workflow).unwrap();
        fs::write(workflows_dir.join(format!("{}.json", workflow_id)), workflow_json).unwrap();
        
        // Ensure the project itself is recognized (needs a .metadata/project.json usually, but resolve_project_path might be simpler)
        fs::create_dir_all(project_path.join(".metadata")).unwrap();
        let project_meta = serde_json::json!({
            "id": project_id,
            "name": "Test Project",
            "goal": "Testing"
        });
        fs::write(project_path.join(".metadata/project.json"), project_meta.to_string()).unwrap();

        // Now run the test
        let result = WorkflowService::execute_workflow(
            project_id,
            workflow_id,
            None, // Missing parameters
            |_| {}
        ).await;

        match result {
            Err(WorkflowError::ValidationError(errors)) => {
                assert!(errors[0].contains("mandatory_param"));
            },
            Err(e) => panic!("Expected ValidationError, but got: {:?}", e),
            Ok(_) => panic!("Expected ValidationError for missing parameters"),
        }
    }
}
