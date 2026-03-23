use app_lib::models::artifact::ArtifactType;
use app_lib::services::artifact_service::ArtifactService;
use std::fs;
use std::sync::{Mutex, OnceLock};
use tempfile::TempDir;

fn env_lock() -> &'static Mutex<()> {
    static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
    LOCK.get_or_init(|| Mutex::new(()))
}

#[tokio::test]
async fn test_artifact_service_create_list_and_delete() {
    let _guard = env_lock().lock().unwrap_or_else(|e| e.into_inner());
    let temp_dir = TempDir::new().unwrap();
    let projects_dir = temp_dir.path().join("projects");
    fs::create_dir_all(&projects_dir).unwrap();
    std::env::set_var("PROJECTS_DIR", &projects_dir);

    let project_id = "artifact-project";

    let created = ArtifactService::create_artifact(project_id, ArtifactType::Insight, "North Star Insight")
        .expect("artifact should be created");

    assert_eq!(created.artifact_type, ArtifactType::Insight);
    assert_eq!(created.project_id, project_id);
    assert!(created.id.contains("north-star-insight"));

    let listed = ArtifactService::list_artifacts(project_id, None).expect("artifacts should list");
    assert_eq!(listed.len(), 1);
    assert_eq!(listed[0].id, created.id);

    let loaded = ArtifactService::load_artifact(project_id, ArtifactType::Insight, &created.id)
        .expect("artifact should load");
    assert_eq!(loaded.title, "North Star Insight");

    ArtifactService::delete_artifact(project_id, ArtifactType::Insight, &created.id)
        .expect("artifact should delete");

    let after_delete = ArtifactService::list_artifacts(project_id, None).unwrap();
    assert!(after_delete.is_empty());
}

#[tokio::test]
async fn test_artifact_service_filter_by_type() {
    let _guard = env_lock().lock().unwrap_or_else(|e| e.into_inner());
    let temp_dir = TempDir::new().unwrap();
    let projects_dir = temp_dir.path().join("projects");
    fs::create_dir_all(&projects_dir).unwrap();
    std::env::set_var("PROJECTS_DIR", &projects_dir);

    let project_id = "artifact-filter-project";

    ArtifactService::create_artifact(project_id, ArtifactType::Insight, "Insight A").unwrap();
    ArtifactService::create_artifact(project_id, ArtifactType::Decision, "Decision A").unwrap();

    let only_insights = ArtifactService::list_artifacts(project_id, Some(ArtifactType::Insight)).unwrap();
    assert_eq!(only_insights.len(), 1);
    assert_eq!(only_insights[0].artifact_type, ArtifactType::Insight);

    let only_decisions = ArtifactService::list_artifacts(project_id, Some(ArtifactType::Decision)).unwrap();
    assert_eq!(only_decisions.len(), 1);
    assert_eq!(only_decisions[0].artifact_type, ArtifactType::Decision);
}
