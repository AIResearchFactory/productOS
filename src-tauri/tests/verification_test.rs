use app_lib::models::settings::ProjectSettings;
use app_lib::models::skill::*;
/// Comprehensive verification tests for all productOS domains.
/// These tests cover: Workflows, Skills, Settings, and Projects.
use app_lib::models::workflow::*;
use app_lib::services::project_service::ProjectService;
use app_lib::services::settings_service::SettingsService;
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use tempfile::TempDir;

/// Helper to create a StepConfig with all fields set to None/defaults
fn empty_step_config() -> StepConfig {
    StepConfig::default()
}

// =====================================================================
// Domain G — Workflow Tests
// =====================================================================

#[test]
fn test_workflow_validation_valid() {
    let mut config = empty_step_config();
    config.skill_id = Some("research-specialist".to_string());
    config.output_file = Some("output.md".to_string());

    let workflow = Workflow {
        id: "test-workflow".to_string(),
        project_id: "test-project".to_string(),
        name: "Test Workflow".to_string(),
        description: "A valid test workflow".to_string(),
        steps: vec![WorkflowStep {
            id: "step_1".to_string(),
            name: "First Step".to_string(),
            step_type: StepType::Agent,
            config,
            depends_on: vec![],
        }],
        version: "1.0.0".to_string(),
        created: "2026-01-01T00:00:00Z".to_string(),
        updated: "2026-01-01T00:00:00Z".to_string(),
        status: None,
        last_run: None,
        schedule: None,
    };

    assert!(
        workflow.validate().is_ok(),
        "Valid workflow should pass validation"
    );
}

#[test]
fn test_workflow_validation_empty_name() {
    let workflow = Workflow {
        id: "test-workflow".to_string(),
        project_id: "test-project".to_string(),
        name: "".to_string(),
        description: "".to_string(),
        steps: vec![WorkflowStep {
            id: "step_1".to_string(),
            name: "Step".to_string(),
            step_type: StepType::Agent,
            config: empty_step_config(),
            depends_on: vec![],
        }],
        version: "1.0.0".to_string(),
        created: "2026-01-01T00:00:00Z".to_string(),
        updated: "2026-01-01T00:00:00Z".to_string(),
        status: None,
        last_run: None,
        schedule: None,
    };

    let result = workflow.validate();
    assert!(
        result.is_err(),
        "Workflow with empty name should fail validation"
    );
}

#[test]
fn test_workflow_validation_empty_steps() {
    let workflow = Workflow {
        id: "test-workflow".to_string(),
        project_id: "test-project".to_string(),
        name: "Valid Name".to_string(),
        description: "A workflow".to_string(),
        steps: vec![],
        version: "1.0.0".to_string(),
        created: "2026-01-01T00:00:00Z".to_string(),
        updated: "2026-01-01T00:00:00Z".to_string(),
        status: None,
        last_run: None,
        schedule: None,
    };

    let result = workflow.validate();
    assert!(
        result.is_err(),
        "Workflow with empty steps should fail validation"
    );
    let errors = result.unwrap_err();
    assert!(errors.iter().any(|e| e.contains("at least one step")));
}

#[test]
fn test_workflow_json_roundtrip() {
    let mut input_config = empty_step_config();
    input_config.source_type = Some("file".to_string());
    input_config.source_value = Some("data.csv".to_string());

    let mut agent_config = empty_step_config();
    agent_config.skill_id = Some("research-specialist".to_string());
    agent_config.output_file = Some("analysis.md".to_string());

    let workflow = Workflow {
        id: "roundtrip-test".to_string(),
        project_id: "test-project".to_string(),
        name: "Roundtrip Test".to_string(),
        description: "Tests JSON serialization roundtrip".to_string(),
        steps: vec![
            WorkflowStep {
                id: "step_1".to_string(),
                name: "Gather Data".to_string(),
                step_type: StepType::Input,
                config: input_config,
                depends_on: vec![],
            },
            WorkflowStep {
                id: "step_2".to_string(),
                name: "Analyze".to_string(),
                step_type: StepType::Agent,
                config: agent_config,
                depends_on: vec!["step_1".to_string()],
            },
        ],
        version: "1.0.0".to_string(),
        created: "2026-01-01T00:00:00Z".to_string(),
        updated: "2026-01-01T00:00:00Z".to_string(),
        status: None,
        last_run: None,
        schedule: None,
    };

    // Serialize to JSON
    let json_str = serde_json::to_string_pretty(&workflow).unwrap();

    // Deserialize back
    let loaded: Workflow = serde_json::from_str(&json_str).unwrap();

    assert_eq!(loaded.id, "roundtrip-test");
    assert_eq!(loaded.name, "Roundtrip Test");
    assert_eq!(loaded.steps.len(), 2);
    assert_eq!(loaded.steps[0].name, "Gather Data");
    assert_eq!(loaded.steps[1].depends_on, vec!["step_1"]);
}

#[test]
fn test_workflow_persistence_on_disk() {
    let temp_dir = TempDir::new().unwrap();
    let workflows_dir = temp_dir.path().join(".workflows");
    fs::create_dir_all(&workflows_dir).unwrap();

    let mut config = empty_step_config();
    config.skill_id = Some("test-runner".to_string());

    let workflow = Workflow {
        id: "persistence-test".to_string(),
        project_id: "test-project".to_string(),
        name: "Persistence Test".to_string(),
        description: "Verifies disk persistence".to_string(),
        steps: vec![WorkflowStep {
            id: "step_1".to_string(),
            name: "Step One".to_string(),
            step_type: StepType::Agent,
            config,
            depends_on: vec![],
        }],
        version: "1.0.0".to_string(),
        created: "2026-02-19T00:00:00Z".to_string(),
        updated: "2026-02-19T00:00:00Z".to_string(),
        status: None,
        last_run: None,
        schedule: None,
    };

    // Save to disk
    let file_path = workflows_dir.join("persistence-test.json");
    let json_str = serde_json::to_string_pretty(&workflow).unwrap();
    fs::write(&file_path, &json_str).unwrap();

    assert!(file_path.exists(), "Workflow file should exist on disk");

    // Read back and verify
    let loaded_str = fs::read_to_string(&file_path).unwrap();
    let loaded: Workflow = serde_json::from_str(&loaded_str).unwrap();

    assert_eq!(loaded.id, "persistence-test");
    assert_eq!(loaded.name, "Persistence Test");
    assert_eq!(loaded.steps.len(), 1);
    assert_eq!(
        loaded.steps[0].config.skill_id,
        Some("test-runner".to_string())
    );
}

#[test]
fn test_workflow_modification_add_step() {
    // E1: Add step to existing workflow → save
    let temp_dir = TempDir::new().unwrap();
    let wf_path = temp_dir.path().join("mod-test.json");

    let mut workflow = Workflow {
        id: "mod-test".to_string(),
        project_id: "test-project".to_string(),
        name: "Mod Test".to_string(),
        description: "Test modifications".to_string(),
        steps: vec![WorkflowStep {
            id: "step_1".to_string(),
            name: "Original Step".to_string(),
            step_type: StepType::Agent,
            config: empty_step_config(),
            depends_on: vec![],
        }],
        version: "1.0.0".to_string(),
        created: "2026-02-19T00:00:00Z".to_string(),
        updated: "2026-02-19T00:00:00Z".to_string(),
        status: None,
        last_run: None,
        schedule: None,
    };

    assert_eq!(workflow.steps.len(), 1);

    // Add a new step
    workflow.steps.push(WorkflowStep {
        id: "step_2".to_string(),
        name: "Added Step".to_string(),
        step_type: StepType::Synthesis,
        config: empty_step_config(),
        depends_on: vec!["step_1".to_string()],
    });

    assert_eq!(workflow.steps.len(), 2);
    assert!(workflow.validate().is_ok());

    // Save and reload
    let json = serde_json::to_string_pretty(&workflow).unwrap();
    fs::write(&wf_path, &json).unwrap();
    let reloaded: Workflow = serde_json::from_str(&fs::read_to_string(&wf_path).unwrap()).unwrap();
    assert_eq!(reloaded.steps.len(), 2);
    assert_eq!(reloaded.steps[1].name, "Added Step");
}

#[test]
fn test_workflow_modification_remove_step() {
    // E2: Remove step → save
    let mut workflow = Workflow {
        id: "remove-test".to_string(),
        project_id: "test-project".to_string(),
        name: "Remove Test".to_string(),
        description: "".to_string(),
        steps: vec![
            WorkflowStep {
                id: "step_1".to_string(),
                name: "Keep".to_string(),
                step_type: StepType::Agent,
                config: empty_step_config(),
                depends_on: vec![],
            },
            WorkflowStep {
                id: "step_2".to_string(),
                name: "Remove".to_string(),
                step_type: StepType::Agent,
                config: empty_step_config(),
                depends_on: vec!["step_1".to_string()],
            },
        ],
        version: "1.0.0".to_string(),
        created: "".to_string(),
        updated: "".to_string(),
        status: None,
        last_run: None,
        schedule: None,
    };

    workflow.steps.retain(|s| s.id != "step_2");
    assert_eq!(workflow.steps.len(), 1);
    assert!(workflow.validate().is_ok());
}

#[test]
fn test_workflow_modification_rename() {
    // E3: Rename workflow → save
    let temp_dir = TempDir::new().unwrap();
    let wf_path = temp_dir.path().join("rename.json");

    let mut workflow = Workflow {
        id: "rename-test".to_string(),
        project_id: "test-project".to_string(),
        name: "Old Name".to_string(),
        description: "".to_string(),
        steps: vec![WorkflowStep {
            id: "s1".to_string(),
            name: "S1".to_string(),
            step_type: StepType::Agent,
            config: empty_step_config(),
            depends_on: vec![],
        }],
        version: "1.0.0".to_string(),
        created: "".to_string(),
        updated: "".to_string(),
        status: None,
        last_run: None,
        schedule: None,
    };

    workflow.name = "New Name".to_string();
    let json = serde_json::to_string_pretty(&workflow).unwrap();
    fs::write(&wf_path, &json).unwrap();

    let reloaded: Workflow = serde_json::from_str(&fs::read_to_string(&wf_path).unwrap()).unwrap();
    assert_eq!(reloaded.name, "New Name");
}

#[test]
fn test_workflow_circular_dependency_detection() {
    let workflow = Workflow {
        id: "circular-test".to_string(),
        project_id: "test-project".to_string(),
        name: "Circular Dependency Test".to_string(),
        description: "Has circular deps".to_string(),
        steps: vec![
            WorkflowStep {
                id: "step_a".to_string(),
                name: "Step A".to_string(),
                step_type: StepType::Agent,
                config: empty_step_config(),
                depends_on: vec!["step_b".to_string()],
            },
            WorkflowStep {
                id: "step_b".to_string(),
                name: "Step B".to_string(),
                step_type: StepType::Agent,
                config: empty_step_config(),
                depends_on: vec!["step_a".to_string()],
            },
        ],
        version: "1.0.0".to_string(),
        created: "2026-01-01T00:00:00Z".to_string(),
        updated: "2026-01-01T00:00:00Z".to_string(),
        status: None,
        last_run: None,
        schedule: None,
    };

    let result = workflow.validate();
    assert!(
        result.is_err(),
        "Circular dependencies should fail validation"
    );
}

// =====================================================================
// Domain F — Skill Tests
// =====================================================================

#[test]
fn test_skill_validation_valid() {
    let skill = Skill {
        id: "test-runner".to_string(),
        name: "Test Runner".to_string(),
        description: "Runs tests".to_string(),
        capabilities: vec!["test_execution".to_string()],
        prompt_template: "You are a test runner agent.".to_string(),
        examples: vec![],
        parameters: vec![SkillParameter {
            name: "test_domain".to_string(),
            param_type: "string".to_string(),
            description: "Domain to test".to_string(),
            required: true,
            default_value: None,
        }],
        version: "1.0.0".to_string(),
        created: "2026-02-19T00:00:00Z".to_string(),
        updated: "2026-02-19T00:00:00Z".to_string(),
        file_path: PathBuf::from("test-runner.md"),
    };

    assert!(skill.validate().is_ok());
}

#[test]
fn test_skill_render_prompt_with_required_param() {
    let skill = Skill {
        id: "test-skill".to_string(),
        name: "Test Skill".to_string(),
        description: "Test".to_string(),
        capabilities: vec![],
        prompt_template: "Run tests for domain: {{test_domain}}".to_string(),
        examples: vec![],
        parameters: vec![SkillParameter {
            name: "test_domain".to_string(),
            param_type: "string".to_string(),
            description: "Domain".to_string(),
            required: true,
            default_value: None,
        }],
        version: "1.0.0".to_string(),
        created: "".to_string(),
        updated: "".to_string(),
        file_path: PathBuf::from("test.md"),
    };

    let mut params = HashMap::new();
    params.insert("test_domain".to_string(), "rust".to_string());
    let result = skill.render_prompt(params).unwrap();
    assert_eq!(result, "Run tests for domain: rust");
}

#[test]
fn test_skill_render_prompt_missing_required() {
    let skill = Skill {
        id: "test-skill".to_string(),
        name: "Test Skill".to_string(),
        description: "Test".to_string(),
        capabilities: vec![],
        prompt_template: "Run tests for domain: {{test_domain}}".to_string(),
        examples: vec![],
        parameters: vec![SkillParameter {
            name: "test_domain".to_string(),
            param_type: "string".to_string(),
            description: "Domain".to_string(),
            required: true,
            default_value: None,
        }],
        version: "1.0.0".to_string(),
        created: "".to_string(),
        updated: "".to_string(),
        file_path: PathBuf::from("test.md"),
    };

    let params = HashMap::new(); // No params provided
    let result = skill.render_prompt(params);
    assert!(result.is_err(), "Missing required param should error");
}

#[test]
fn test_skill_markdown_roundtrip() {
    let temp_dir = TempDir::new().unwrap();
    let skill_path = temp_dir.path().join("test-skill.md");

    let skill = Skill {
        id: "test-skill".to_string(),
        name: "Test Skill".to_string(),
        description: "A test skill for roundtrip".to_string(),
        capabilities: vec!["testing".to_string()],
        prompt_template: "You are a test agent for {{domain}}.".to_string(),
        examples: vec![SkillExample {
            title: "Basic Test".to_string(),
            input: "{\"domain\": \"rust\"}".to_string(),
            expected_output: "Rust tests passed.".to_string(),
        }],
        parameters: vec![SkillParameter {
            name: "domain".to_string(),
            param_type: "string".to_string(),
            description: "Test domain".to_string(),
            required: true,
            default_value: None,
        }],
        version: "1.0.0".to_string(),
        created: "2026-02-19T00:00:00Z".to_string(),
        updated: "2026-02-19T00:00:00Z".to_string(),
        file_path: skill_path.clone(),
    };

    // Save
    skill.save(&skill_path).unwrap();
    assert!(skill_path.exists(), "Skill markdown file should exist");
    assert!(
        temp_dir.path().join(".metadata/test-skill.json").exists(),
        "Sidecar JSON should exist"
    );

    // Reload
    let loaded = Skill::from_markdown_file(&skill_path).unwrap();
    assert_eq!(loaded.id, "test-skill");
    assert_eq!(loaded.name, "Test Skill");
    assert_eq!(loaded.parameters.len(), 1);
    assert_eq!(loaded.examples.len(), 1);
}

// =====================================================================
// Domain B — Settings Tests
// =====================================================================

#[test]
fn test_settings_round_trip_all_fields() {
    let temp_dir = TempDir::new().unwrap();
    let project_path = temp_dir.path().join("test-project");
    fs::create_dir(&project_path).unwrap();

    let settings = ProjectSettings {
        name: Some("My Research Project".to_string()),
        goal: Some("Discover new insights".to_string()),
        custom_prompt: Some("Be thorough and precise".to_string()),
        preferred_skills: vec!["research-specialist".to_string(), "test-runner".to_string()],
        auto_save: Some(true),
        encryption_enabled: Some(false),
        personalization_rules: None,
    };

    // Save
    SettingsService::save_project_settings(&project_path, &settings).unwrap();

    // Load and verify ALL fields
    let loaded = SettingsService::load_project_settings(&project_path)
        .unwrap()
        .unwrap();
    assert_eq!(loaded.name, Some("My Research Project".to_string()));
    assert_eq!(loaded.goal, Some("Discover new insights".to_string()));
    assert_eq!(
        loaded.custom_prompt,
        Some("Be thorough and precise".to_string())
    );
    assert_eq!(
        loaded.preferred_skills,
        vec!["research-specialist", "test-runner"]
    );
    assert_eq!(loaded.auto_save, Some(true));
    assert_eq!(loaded.encryption_enabled, Some(false));
}

#[test]
fn test_settings_overwrite() {
    let temp_dir = TempDir::new().unwrap();
    let project_path = temp_dir.path().join("test-project");
    fs::create_dir(&project_path).unwrap();

    // Save initial settings
    let v1 = ProjectSettings {
        name: Some("Version 1".to_string()),
        goal: None,
        custom_prompt: None,
        preferred_skills: vec![],
        auto_save: Some(true),
        encryption_enabled: Some(true),
        personalization_rules: None,
    };
    SettingsService::save_project_settings(&project_path, &v1).unwrap();

    // Overwrite with new settings
    let v2 = ProjectSettings {
        name: Some("Version 2".to_string()),
        goal: Some("Updated goal".to_string()),
        custom_prompt: None,
        preferred_skills: vec!["rust".to_string()],
        auto_save: Some(true),
        encryption_enabled: Some(true),
        personalization_rules: None,
    };
    SettingsService::save_project_settings(&project_path, &v2).unwrap();

    // Verify v2 is loaded (not v1)
    let loaded = SettingsService::load_project_settings(&project_path)
        .unwrap()
        .unwrap();
    assert_eq!(loaded.name, Some("Version 2".to_string()));
    assert_eq!(loaded.goal, Some("Updated goal".to_string()));
    assert_eq!(loaded.preferred_skills, vec!["rust"]);
}

// =====================================================================
// Domain C — Project Tests
// =====================================================================

#[test]
fn test_project_load_workflow() {
    let temp_dir = TempDir::new().unwrap();
    let project_path = temp_dir.path().join("test-project");
    fs::create_dir(&project_path).unwrap();

    let metadata_dir = project_path.join(".metadata");
    fs::create_dir_all(&metadata_dir).unwrap();

    let project_meta = serde_json::json!({
        "id": "test-project",
        "name": "Test Project",
        "goal": "Verify project CRUD",
        "skills": ["test-runner", "config-verifier"],
        "created": "2026-02-19T00:00:00Z"
    });

    fs::write(
        metadata_dir.join("project.json"),
        serde_json::to_string_pretty(&project_meta).unwrap(),
    )
    .unwrap();

    // Validate
    assert!(ProjectService::is_valid_project(&project_path));

    // Load
    let project = ProjectService::load_project(&project_path).unwrap();
    assert_eq!(project.id, "test-project");
    assert_eq!(project.name, "Test Project");
    assert_eq!(project.skills.len(), 2);
    assert!(project.skills.contains(&"test-runner".to_string()));
}

#[test]
fn test_project_invalid_json() {
    let temp_dir = TempDir::new().unwrap();
    let project_path = temp_dir.path().join("bad-project");
    fs::create_dir(&project_path).unwrap();

    let metadata_dir = project_path.join(".metadata");
    fs::create_dir_all(&metadata_dir).unwrap();
    fs::write(metadata_dir.join("project.json"), "not valid json").unwrap();

    assert!(!ProjectService::is_valid_project(&project_path));
}

// =====================================================================
// Domain G — Workflow Execution Structs
// =====================================================================

#[test]
fn test_workflow_execution_serialization() {
    let mut step_results = HashMap::new();
    step_results.insert(
        "step_1".to_string(),
        StepResult {
            step_id: "step_1".to_string(),
            status: StepStatus::Completed,
            started: "2026-02-20T00:00:00Z".to_string(),
            completed: Some("2026-02-20T00:01:00Z".to_string()),
            output_files: vec!["output.md".to_string()],
            error: None,
            logs: vec![
                "Loading skill".to_string(),
                "AI response received".to_string(),
            ],
            next_step_id: None,
        },
    );

    let execution = WorkflowExecution {
        workflow_id: "test-wf".to_string(),
        started: "2026-02-20T00:00:00Z".to_string(),
        completed: Some("2026-02-20T00:02:00Z".to_string()),
        status: ExecutionStatus::Completed,
        step_results,
    };

    // Serialize → deserialize roundtrip
    let json = serde_json::to_string_pretty(&execution).unwrap();
    let loaded: WorkflowExecution = serde_json::from_str(&json).unwrap();

    assert_eq!(loaded.workflow_id, "test-wf");
    assert_eq!(loaded.status, ExecutionStatus::Completed);
    assert_eq!(loaded.step_results.len(), 1);

    let step = loaded.step_results.get("step_1").unwrap();
    assert_eq!(step.status, StepStatus::Completed);
    assert_eq!(step.output_files, vec!["output.md"]);
    assert_eq!(step.logs.len(), 2);
}

#[test]
fn test_step_result_with_error() {
    let result = StepResult {
        step_id: "failed-step".to_string(),
        status: StepStatus::Failed,
        started: "2026-02-20T00:00:00Z".to_string(),
        completed: Some("2026-02-20T00:00:05Z".to_string()),
        output_files: vec![],
        error: Some("AI Service error: connection timeout".to_string()),
        logs: vec![
            "Loading skill".to_string(),
            "Calling AI Service".to_string(),
        ],
        next_step_id: None,
    };

    assert_eq!(result.status, StepStatus::Failed);
    assert!(result
        .error
        .as_ref()
        .unwrap()
        .contains("connection timeout"));
    assert!(result.output_files.is_empty());
}


