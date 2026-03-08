use app_lib::models::settings::ProjectSettings;
use app_lib::services::project_service::ProjectService;
use app_lib::services::settings_service::SettingsService;
use std::fs;
use tempfile::TempDir;

#[test]
fn test_settings_service_workflow() {
    let temp_dir = TempDir::new().unwrap();
    let project_path = temp_dir.path().join("test-project");
    fs::create_dir(&project_path).unwrap();

    // Create and save project settings
    let settings = ProjectSettings {
        name: None,
        goal: None,
        custom_prompt: Some("Test prompt for AI".to_string()),
        preferred_skills: vec!["rust".to_string(), "testing".to_string()],
        auto_save: Some(true),
        encryption_enabled: Some(true),
        personalization_rules: None,
        brand_settings: None,
    };

    let save_result = SettingsService::save_project_settings(&project_path, &settings);
    assert!(save_result.is_ok(), "Failed to save project settings");

    // Load project settings
    let loaded = SettingsService::load_project_settings(&project_path).unwrap();
    assert!(loaded.is_some(), "Settings should exist");

    let loaded_settings = loaded.unwrap();
    assert_eq!(
        loaded_settings.custom_prompt,
        Some("Test prompt for AI".to_string())
    );
    assert_eq!(loaded_settings.preferred_skills.len(), 2);
    assert_eq!(loaded_settings.preferred_skills[0], "rust");
}

#[test]
fn test_project_service_workflow() {
    let temp_dir = TempDir::new().unwrap();
    let project_path = temp_dir.path().join("test-project");
    fs::create_dir(&project_path).unwrap();

    // Create a valid .metadata/project.json
    let metadata_dir = project_path.join(".metadata");
    fs::create_dir_all(&metadata_dir).unwrap();

    let project_meta = serde_json::json!({
        "id": "test-project",
        "name": "Test Project",
        "goal": "Test the project validation",
        "skills": ["rust", "testing"],
        "created": "2025-01-01T00:00:00Z"
    });

    fs::write(
        metadata_dir.join("project.json"),
        serde_json::to_string(&project_meta).unwrap(),
    )
    .unwrap();

    // Validate the project
    assert!(
        ProjectService::is_valid_project(&project_path),
        "Project should be valid"
    );

    // Load the project
    let project = ProjectService::load_project(&project_path);
    assert!(project.is_ok(), "Failed to load project");

    let project = project.unwrap();
    assert_eq!(project.id, "test-project");
    assert_eq!(project.name, "Test Project");
    assert_eq!(project.goal, "Test the project validation");
    assert_eq!(project.skills.len(), 2);
}

#[test]
fn test_project_files_listing() {
    let temp_dir = TempDir::new().unwrap();
    let projects_path = temp_dir.path().join("projects");
    fs::create_dir_all(&projects_path).unwrap();

    // Isolate HOME to avoid using real settings.json
    std::env::set_var("HOME", temp_dir.path());

    // Set PROJECTS_DIR env var to override global path
    std::env::set_var("PROJECTS_DIR", projects_path.to_str().unwrap());

    let project_path = projects_path.join("test-project");
    fs::create_dir(&project_path).unwrap();

    // Create project metadata
    let metadata_dir = project_path.join(".metadata");
    fs::create_dir_all(&metadata_dir).unwrap();

    let project_meta = serde_json::json!({
        "id": "test-project",
        "name": "Test Project",
        "goal": "Test file listing",
        "skills": ["rust"],
        "created": "2025-01-01T00:00:00Z"
    });

    fs::write(
        metadata_dir.join("project.json"),
        serde_json::to_string(&project_meta).unwrap(),
    )
    .unwrap();

    // Create various files
    fs::write(project_path.join("research.md"), "# Research").unwrap();
    fs::write(project_path.join("notes.md"), "# Notes").unwrap();
    fs::write(project_path.join("data.txt"), "Some data").unwrap();

    // List project files
    let files = ProjectService::list_project_files("test-project");
    if let Err(e) = &files {
        println!("Error listing project files: {:?}", e);
    }
    assert!(
        files.is_ok(),
        "Failed to list project files: {:?}",
        files.err()
    );

    let files = files.unwrap();
    assert_eq!(files.len(), 3, "Should have 3 relevant files (md and txt)");
    assert!(files.contains(&"notes.md".to_string()));
    assert!(files.contains(&"research.md".to_string()));
    assert!(files.contains(&"data.txt".to_string()));

    // Clean up env var
    std::env::remove_var("PROJECTS_DIR");
}

#[test]
fn test_invalid_project_detection() {
    let temp_dir = TempDir::new().unwrap();
    let project_path = temp_dir.path().join("invalid-project");
    fs::create_dir(&project_path).unwrap();

    // No project.json file
    assert!(
        !ProjectService::is_valid_project(&project_path),
        "Should be invalid without .metadata/project.json"
    );

    // Create invalid project.json (missing fields)
    let metadata_dir = project_path.join(".metadata");
    fs::create_dir_all(&metadata_dir).unwrap();
    fs::write(metadata_dir.join("project.json"), "{}").unwrap();

    assert!(
        !ProjectService::is_valid_project(&project_path),
        "Should be invalid with empty JSON"
    );
}
