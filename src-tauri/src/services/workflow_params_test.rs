#[cfg(test)]
mod tests {
    use crate::models::workflow::*;
    use crate::services::workflow_service::WorkflowService;
    use std::collections::HashMap;

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

    #[test]
    fn test_validate_workflow_missing_params() {
        // Build a workflow that references {{mandatory_param}} but provide no parameters
        let workflow = Workflow {
            id: "wf-1".to_string(),
            project_id: "proj-1".to_string(),
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

        // Collect all required parameters across all steps
        let required: Vec<String> = workflow
            .steps
            .iter()
            .flat_map(|s| s.required_parameters())
            .collect();

        assert_eq!(required.len(), 1);
        assert_eq!(required[0], "mandatory_param");

        // Simulate the pre-execution validation: check that missing params are detected
        let provided: Option<HashMap<String, String>> = None;
        let mut missing = Vec::new();
        for param in &required {
            let is_provided = provided
                .as_ref()
                .map(|p| p.contains_key(param))
                .unwrap_or(false);
            if !is_provided {
                missing.push(param.clone());
            }
        }

        assert_eq!(missing.len(), 1);
        assert!(missing.contains(&"mandatory_param".to_string()));
    }

    #[test]
    fn test_validate_workflow_all_params_provided() {
        let workflow = Workflow {
            id: "wf-2".to_string(),
            project_id: "proj-2".to_string(),
            name: "Parameterized Workflow".to_string(),
            description: "All params provided".to_string(),
            steps: vec![WorkflowStep {
                id: "step1".to_string(),
                name: "Step 1".to_string(),
                step_type: StepType::Input,
                config: StepConfig {
                    source_value: Some("{{topic}}/{{format}}.md".to_string()),
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

        let required: Vec<String> = workflow
            .steps
            .iter()
            .flat_map(|s| s.required_parameters())
            .collect();
        assert_eq!(required.len(), 2);

        let mut provided = HashMap::new();
        provided.insert("topic".to_string(), "AI".to_string());
        provided.insert("format".to_string(), "summary".to_string());
        let parameters = Some(provided);

        let missing: Vec<String> = required
            .iter()
            .filter(|p| {
                parameters
                    .as_ref()
                    .map(|params| !params.contains_key(p.as_str()))
                    .unwrap_or(true)
            })
            .cloned()
            .collect();

        assert!(missing.is_empty(), "All parameters should be provided");
    }

    #[test]
    fn test_no_params_required_for_simple_steps() {
        let step = WorkflowStep {
            id: "step1".to_string(),
            name: "Simple Step".to_string(),
            step_type: StepType::Input,
            config: StepConfig {
                source_value: Some("static-file.txt".to_string()),
                ..Default::default()
            },
            depends_on: vec![],
        };

        let params = step.required_parameters();
        assert!(params.is_empty(), "Static config should require no parameters");
    }
}
