use app_lib::models::artifact::ArtifactType;
use chrono::Utc;
use app_lib::services::artifact_service::ArtifactService;
use tempfile::TempDir;
use std::sync::{Mutex, OnceLock};
use std::fs;

fn env_lock() -> &'static Mutex<()> {
    static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
    LOCK.get_or_init(|| Mutex::new(()))
}

fn create_project_meta(base: &std::path::Path, id: &str) {
    let project_path = base.join(id);
    fs::create_dir_all(project_path.join(".metadata")).unwrap();
    let project_meta = serde_json::json!({
        "id": id,
        "name": id,
        "goal": "Test goal",
        "skills": ["testing"],
        "created": Utc::now().to_rfc3339()
    });
    fs::write(
        project_path.join(".metadata").join("project.json"),
        serde_json::to_string(&project_meta).unwrap(),
    ).unwrap();
}

#[tokio::test]
async fn test_artifact_service_create_list_and_delete() {
    let _guard = env_lock().lock().unwrap();
    let temp_dir = TempDir::new().unwrap();
    let projects_dir = temp_dir.path().to_path_buf();
    
    // Set override env var for tests
    std::env::set_var("PROJECTS_DIR", projects_dir.clone());
    
    let project_id = "test-project";
    create_project_meta(&projects_dir, project_id);

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

#[tokio::test]
async fn test_artifact_service_filter_by_type() {
    let _guard = env_lock().lock().unwrap();
    let temp_dir = TempDir::new().unwrap();
    let projects_dir = temp_dir.path().to_path_buf();
    std::env::set_var("PROJECTS_DIR", projects_dir.clone());
    
    let project_id = "filter-project";
    create_project_meta(&projects_dir, project_id);

    // Create different types
    ArtifactService::create_artifact(project_id, ArtifactType::Roadmap, "Roadmap A").unwrap();
    ArtifactService::create_artifact(project_id, ArtifactType::Roadmap, "Roadmap B").unwrap();
    ArtifactService::create_artifact(project_id, ArtifactType::Initiative, "Initiative A").unwrap();
    ArtifactService::create_artifact(project_id, ArtifactType::ProductVision, "Vision A").unwrap();

    // Filter for Roadmap
    let roadmaps = ArtifactService::list_artifacts(project_id, Some(ArtifactType::Roadmap)).unwrap();
    assert_eq!(roadmaps.len(), 2);

    // Filter for Decision
    let initiatives = ArtifactService::list_artifacts(project_id, Some(ArtifactType::Initiative)).unwrap();
    assert_eq!(initiatives.len(), 1);

    // All
    let all = ArtifactService::list_artifacts(project_id, None).unwrap();
    assert_eq!(all.len(), 4);
}
