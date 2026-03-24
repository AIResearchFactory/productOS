use app_lib::models::artifact::ArtifactType;
use app_lib::services::artifact_service::ArtifactService;
use app_lib::services::settings_service::SettingsService;
use tempfile::TempDir;
use std::env;

#[test]
fn test_artifact_service_create_list_and_delete() {
    let temp_dir = TempDir::new().unwrap();
    let projects_dir = temp_dir.path().to_path_buf();
    
    // Set override env var for tests
    env::set_var("PROJECTS_DIR", projects_dir.clone());
    
    let project_id = "test-project";
    let project_path = projects_dir.join(project_id);
    std::fs::create_dir_all(&project_path).unwrap();

    // 1. Create Roadmap
    let title = "Product Roadmap 2026";
    let created = ArtifactService::create_artifact(project_id, ArtifactType::Roadmap, title).unwrap();
    assert_eq!(created.title, title);
    assert_eq!(created.artifact_type, ArtifactType::Roadmap);
    assert!(created.content.contains("Vision"));

    // 2. List
    let artifacts = ArtifactService::list_artifacts(project_id, None).unwrap();
    assert_eq!(artifacts.len(), 1);
    assert_eq!(artifacts[0].id, created.id);

    // 3. Delete
    ArtifactService::delete_artifact(project_id, ArtifactType::Roadmap, &created.id).unwrap();
    let artifacts_after = ArtifactService::list_artifacts(project_id, None).unwrap();
    assert_eq!(artifacts_after.len(), 0);
}

#[test]
fn test_artifact_service_filter_by_type() {
    let temp_dir = TempDir::new().unwrap();
    let projects_dir = temp_dir.path().to_path_buf();
    env::set_var("PROJECTS_DIR", projects_dir.clone());
    
    let project_id = "filter-project";
    let project_path = projects_dir.join(project_id);
    std::fs::create_dir_all(&project_path).unwrap();

    // Create different types
    ArtifactService::create_artifact(project_id, ArtifactType::Roadmap, "Roadmap A").unwrap();
    ArtifactService::create_artifact(project_id, ArtifactType::Roadmap, "Roadmap B").unwrap();
    ArtifactService::create_artifact(project_id, ArtifactType::Decision, "Decision A").unwrap();
    ArtifactService::create_artifact(project_id, ArtifactType::ProductVision, "Vision A").unwrap();

    // Filter for Roadmap
    let roadmaps = ArtifactService::list_artifacts(project_id, Some(ArtifactType::Roadmap)).unwrap();
    assert_eq!(roadmaps.len(), 2);

    // Filter for Decision
    let decisions = ArtifactService::list_artifacts(project_id, Some(ArtifactType::Decision)).unwrap();
    assert_eq!(decisions.len(), 1);

    // All
    let all = ArtifactService::list_artifacts(project_id, None).unwrap();
    assert_eq!(all.len(), 4);
}
