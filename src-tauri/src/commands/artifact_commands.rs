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

#[tauri::command]
pub async fn import_artifact(
    project_id: String,
    artifact_type: ArtifactType,
    source_path: String,
) -> Result<Artifact, String> {
    // 1. Call import_document to convert to .md in the project root
    let tmp_file_name = crate::commands::file_commands::import_document(project_id.clone(), source_path).await?;
    
    // 2. Read the resulting content
    let content = crate::services::file_service::FileService::read_file(&project_id, &tmp_file_name)
        .map_err(|e| format!("Failed to read imported file: {}", e))?;
        
    // 3. Extract title (maybe first line # Title, else default)
    let title = content.lines().find(|l| l.starts_with("# ")).map(|l| l.trim_start_matches("# ").to_string()).unwrap_or_else(|| "Imported Artifact".to_string());
    
    // 4. Create artifact
    let mut artifact = ArtifactService::create_artifact(&project_id, artifact_type, &title)?;
    
    // 5. Replace default template content with the imported content
    artifact.content = content;
    ArtifactService::save_artifact(&artifact)?;
    
    // 6. Delete tmp file
    let _ = crate::services::file_service::FileService::delete_file(&project_id, &tmp_file_name);
    
    Ok(artifact)
}

#[tauri::command]
pub async fn export_artifact(
    project_id: String,
    artifact_id: String,
    artifact_type: ArtifactType,
    target_path: String,
    export_format: String,
) -> Result<(), String> {
    // We can use export_document by passing the artifact file path relative to project root
    let file_name = format!("{}/{}.md", artifact_type.directory_name(), artifact_id);
    crate::commands::file_commands::export_document(project_id, file_name, target_path, export_format).await
}
