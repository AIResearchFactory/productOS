use crate::models::artifact::{Artifact, ArtifactType};
use crate::services::settings_service::SettingsService;
use std::fs;
use std::path::PathBuf;

pub struct ArtifactService;

impl ArtifactService {
    /// Get the artifact directory for a specific type within a project
    fn artifact_dir(project_id: &str, artifact_type: &ArtifactType) -> Result<PathBuf, String> {
        let projects_path = SettingsService::get_projects_path()
            .map_err(|e| format!("Failed to get projects path: {}", e))?;
        let dir = projects_path
            .join(project_id)
            .join(artifact_type.directory_name());
        Ok(dir)
    }

    /// Create a new artifact
    pub fn create_artifact(
        project_id: &str,
        artifact_type: ArtifactType,
        title: &str,
    ) -> Result<Artifact, String> {
        let dir = Self::artifact_dir(project_id, &artifact_type)?;

        // Ensure the directory exists
        if !dir.exists() {
            fs::create_dir_all(&dir).map_err(|e| format!("Failed to create artifact dir: {}", e))?;
        }

        // Generate a slug-based ID from title
        let id = Self::slugify(title);

        let mut artifact = Artifact::new(
            id,
            artifact_type,
            title.to_string(),
            project_id.to_string(),
            dir,
        );

        // Set initial content based on type
        artifact.content = Self::default_content(&artifact);

        artifact
            .save()
            .map_err(|e| format!("Failed to save artifact: {}", e))?;

        log::info!(
            "Created artifact '{}' of type {:?} in project '{}'",
            artifact.title,
            artifact.artifact_type,
            project_id
        );

        Ok(artifact)
    }

    /// Load a specific artifact
    pub fn load_artifact(
        project_id: &str,
        artifact_type: ArtifactType,
        artifact_id: &str,
    ) -> Result<Artifact, String> {
        let dir = Self::artifact_dir(project_id, &artifact_type)?;
        Artifact::load(&dir, artifact_id)
            .map_err(|e| format!("Failed to load artifact: {}", e))
    }

    /// List all artifacts of a given type in a project
    pub fn list_artifacts(
        project_id: &str,
        artifact_type: Option<ArtifactType>,
    ) -> Result<Vec<Artifact>, String> {
        let projects_path = SettingsService::get_projects_path()
            .map_err(|e| format!("Failed to get projects path: {}", e))?;
        let project_dir = projects_path.join(project_id);

        let types_to_scan: Vec<ArtifactType> = if let Some(at) = artifact_type {
            vec![at]
        } else {
            vec![
                ArtifactType::Insight,
                ArtifactType::Evidence,
                ArtifactType::Decision,
                ArtifactType::Requirement,
                ArtifactType::MetricDefinition,
                ArtifactType::Experiment,
                ArtifactType::PocBrief,
            ]
        };

        let mut artifacts = Vec::new();

        for at in types_to_scan {
            let dir = project_dir.join(at.directory_name());
            if !dir.exists() {
                continue;
            }

            // Find all .json sidecar files (each represents an artifact)
            let entries = fs::read_dir(&dir)
                .map_err(|e| format!("Failed to read artifact dir: {}", e))?;

            for entry in entries {
                let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
                let path = entry.path();

                if path.extension().and_then(|e| e.to_str()) == Some("json") {
                    let id = path
                        .file_stem()
                        .and_then(|s| s.to_str())
                        .unwrap_or_default()
                        .to_string();

                    match Artifact::load(&dir, &id) {
                        Ok(artifact) => artifacts.push(artifact),
                        Err(e) => {
                            log::warn!("Skipping artifact '{}': {}", id, e);
                        }
                    }
                }
            }
        }

        // Sort by updated timestamp, most recent first
        artifacts.sort_by(|a, b| b.updated.cmp(&a.updated));

        Ok(artifacts)
    }

    /// Save an updated artifact
    pub fn save_artifact(artifact: &Artifact) -> Result<(), String> {
        artifact
            .save()
            .map_err(|e| format!("Failed to save artifact: {}", e))
    }

    /// Delete an artifact (both markdown and sidecar)
    pub fn delete_artifact(
        project_id: &str,
        artifact_type: ArtifactType,
        artifact_id: &str,
    ) -> Result<(), String> {
        let dir = Self::artifact_dir(project_id, &artifact_type)?;
        let md_path = dir.join(format!("{}.md", artifact_id));
        let json_path = dir.join(format!("{}.json", artifact_id));

        if md_path.exists() {
            fs::remove_file(&md_path)
                .map_err(|e| format!("Failed to delete markdown file: {}", e))?;
        }
        if json_path.exists() {
            fs::remove_file(&json_path)
                .map_err(|e| format!("Failed to delete sidecar file: {}", e))?;
        }

        log::info!(
            "Deleted artifact '{}' from project '{}'",
            artifact_id,
            project_id
        );
        Ok(())
    }

    /// Generate a URL-safe slug from a title
    fn slugify(title: &str) -> String {
        title
            .to_lowercase()
            .chars()
            .map(|c| if c.is_alphanumeric() { c } else { '-' })
            .collect::<String>()
            .split('-')
            .filter(|s| !s.is_empty())
            .collect::<Vec<_>>()
            .join("-")
    }

    /// Generate default markdown content based on artifact type
    fn default_content(artifact: &Artifact) -> String {
        match artifact.artifact_type {
            ArtifactType::Insight => format!(
                "# {}\n\n## Observation\n\n\n\n## Evidence\n\n\n\n## Signal Strength\n\n\n\n## Implications\n\n",
                artifact.title
            ),
            ArtifactType::Evidence => format!(
                "# {}\n\n## Source\n\n\n\n## Key Findings\n\n\n\n## Reliability Assessment\n\n",
                artifact.title
            ),
            ArtifactType::Decision => format!(
                "# {}\n\n## Context\n\n\n\n## Decision\n\n\n\n## Rationale\n\n\n\n## Consequences\n\n\n\n## Status\n\nProposed\n",
                artifact.title
            ),
            ArtifactType::Requirement => format!(
                "# {}\n\n## Description\n\n\n\n## Priority\n\nP2\n\n## Acceptance Criteria\n\n- [ ] \n\n## Dependencies\n\n",
                artifact.title
            ),
            ArtifactType::MetricDefinition => format!(
                "# {}\n\n## Type\n\nLeading\n\n## Definition\n\n\n\n## Target\n\n\n\n## Current Value\n\n\n\n## Measurement Approach\n\n",
                artifact.title
            ),
            ArtifactType::Experiment => format!(
                "# {}\n\n## Hypothesis\n\n\n\n## Approach\n\n\n\n## Success Criteria\n\n\n\n## Results\n\n\n\n## Status\n\nPlanned\n",
                artifact.title
            ),
            ArtifactType::PocBrief => format!(
                "# {}\n\n## Problem Statement\n\n\n\n## Proposed Approach\n\n\n\n## Risk Register\n\n| Risk | Likelihood | Impact | Mitigation |\n|------|-----------|--------|------------|\n|      |           |        |            |\n\n## Success Criteria\n\n\n\n## Timeline & Effort\n\n\n\n## Feasibility Score\n\n/10\n",
                artifact.title
            ),
        }
    }
}
