use app_lib::models::artifact::{Artifact, ArtifactType};
use app_lib::services::artifact_service::ArtifactService;
use app_lib::services::settings_service::SettingsService;
use std::fs;
use tempfile::TempDir;

#[test]
fn test_artifact_persistence_on_disk() {
    let temp_dir = TempDir::new().unwrap();
    let projects_dir = temp_dir.path().join("projects");
    fs::create_dir_all(&projects_dir).unwrap();
    
    // Override settings path for testing
    // We would need a mock for SettingsService, but since we can't easily mock static traits here without deep refactors,
    // let's just test the model directly.
    
    let artifact_id = "test-roadmap".to_string();
    let project_id = "test-project".to_string();
    let dir = temp_dir.path().join("test-project").join("roadmaps");
    fs::create_dir_all(&dir).unwrap();
    
    let mut artifact = Artifact::new(
        artifact_id.clone(),
        ArtifactType::Roadmap,
        "Test Roadmap Title".to_string(),
        project_id.clone(),
        dir.clone(),
    );
    
    artifact.content = "# Roadmap\nThis is a test".to_string();
    artifact.confidence = Some(0.95);
    
    // Test save
    artifact.save().expect("Failed to save artifact");
    
    // Verify files on disk
    let md_path = dir.join(format!("{}.md", artifact_id));
    let json_path = dir.join(format!("{}.json", artifact_id));
    
    assert!(md_path.exists(), "Markdown content should exist");
    assert!(json_path.exists(), "JSON sidecar should exist");
    
    // Verify markdown content
    let saved_md = fs::read_to_string(&md_path).unwrap();
    assert_eq!(saved_md, "# Roadmap\nThis is a test");
    
    // Test load
    let loaded = Artifact::load(&dir, &artifact_id).expect("Failed to load artifact");
    assert_eq!(loaded.title, "Test Roadmap Title");
    assert_eq!(loaded.content, "# Roadmap\nThis is a test");
    assert_eq!(loaded.confidence, Some(0.95));
}
