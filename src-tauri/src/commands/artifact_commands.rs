use crate::models::artifact::{Artifact, ArtifactType};
use crate::services::artifact_service::ArtifactService;

#[tauri::command]
pub async fn create_artifact(
    project_id: String,
    artifact_type: ArtifactType,
    title: String,
) -> Result<Artifact, String> {
    log::info!(
        "Creating {:?} artifact '{}' in project '{}'",
        artifact_type,
        title,
        project_id
    );
    ArtifactService::create_artifact(&project_id, artifact_type, &title)
}

#[tauri::command]
pub async fn get_artifact(
    project_id: String,
    artifact_type: ArtifactType,
    artifact_id: String,
) -> Result<Artifact, String> {
    ArtifactService::load_artifact(&project_id, artifact_type, &artifact_id)
}

#[tauri::command]
pub async fn list_artifacts(
    project_id: String,
    artifact_type: Option<ArtifactType>,
) -> Result<Vec<Artifact>, String> {
    ArtifactService::list_artifacts(&project_id, artifact_type)
}

#[tauri::command]
pub async fn save_artifact(artifact: Artifact) -> Result<(), String> {
    ArtifactService::save_artifact(&artifact)
}

#[tauri::command]
pub async fn delete_artifact(
    project_id: String,
    artifact_type: ArtifactType,
    artifact_id: String,
) -> Result<(), String> {
    log::info!(
        "Deleting {:?} artifact '{}' from project '{}'",
        artifact_type,
        artifact_id,
        project_id
    );
    ArtifactService::delete_artifact(&project_id, artifact_type, &artifact_id)
}
