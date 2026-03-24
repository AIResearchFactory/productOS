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
            fs::create_dir_all(&dir)
                .map_err(|e| format!("Failed to create artifact dir: {}", e))?;
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

        // Set initial content based on type or templates
        artifact.content = Self::get_template_content(&artifact);

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
        Artifact::load(&dir, artifact_id).map_err(|e| format!("Failed to load artifact: {}", e))
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
                ArtifactType::Roadmap,
                ArtifactType::ProductVision,
                ArtifactType::OnePager,
                ArtifactType::PRD,
                ArtifactType::Initiative,
                ArtifactType::CompetitiveResearch,
                ArtifactType::UserStory,
                ArtifactType::Insight,
            ]
        };

        let mut artifacts = Vec::new();

        for at in types_to_scan {
            let dir = project_dir.join(at.directory_name());
            if !dir.exists() {
                continue;
            }

            // Recursively find all .json sidecar files
            for entry in walkdir::WalkDir::new(&dir).into_iter().filter_map(|e| e.ok()) {
                let path = entry.path();
                if path.extension().and_then(|e| e.to_str()) == Some("json") {
                    let id = path
                        .file_stem()
                        .and_then(|s| s.to_str())
                        .unwrap_or_default()
                        .to_string();

                    // Load using the directory where the file is located
                    let parent_dir = path.parent().unwrap_or(&dir);
                    match Artifact::load(parent_dir, &id) {
                        Ok(artifact) => artifacts.push(artifact),
                        Err(e) => {
                            log::warn!("Skipping artifact '{}' in {:?}: {}", id, parent_dir, e);
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

    /// Determine initial content (checking project template, global template, then default)
    fn get_template_content(artifact: &Artifact) -> String {
        let type_key = match artifact.artifact_type {
            ArtifactType::Roadmap => "roadmap",
            ArtifactType::ProductVision => "product_vision",
            ArtifactType::OnePager => "one_pager",
            ArtifactType::PRD => "prd",
            ArtifactType::Initiative => "initiative",
            ArtifactType::CompetitiveResearch => "competitive_research",
            ArtifactType::UserStory => "user_story",
            ArtifactType::Insight => "insight",
        };

        if let Ok(projects_path) = SettingsService::get_projects_path() {
            let project_dir = projects_path.join(&artifact.project_id);
            let local_template_path = project_dir
                .join(".templates")
                .join(format!("{}.md", type_key));

            if local_template_path.exists() {
                if let Ok(content) = fs::read_to_string(&local_template_path) {
                    let mut processed = content;
                    if processed.contains("{{title}}") {
                        processed = processed.replace("{{title}}", &artifact.title);
                    }
                    return processed;
                }
            }
        }

        if let Ok(global_settings) = SettingsService::load_global_settings() {
            if let Some(content) = global_settings.artifact_templates.get(type_key) {
                let mut processed = content.clone();
                if processed.contains("{{title}}") {
                    processed = processed.replace("{{title}}", &artifact.title);
                }
                return processed;
            }
        }

        Self::default_content(artifact)
    }

    /// Generate default markdown content based on artifact type
    fn default_content(artifact: &Artifact) -> String {
        match artifact.artifact_type {
            ArtifactType::Roadmap => format!(
                "# {}\n\n## Vision\n\n\n\n## High-Level Themes\n\n- Theme 1\n- Theme 2\n\n## Q1 Roadmap\n\n\n\n## Q2 Roadmap\n\n",
                artifact.title
            ),
            ArtifactType::ProductVision => format!(
                "# {}\n\n## The Core Problem\n\n\n\n## Our Solution\n\n\n\n## Differentiation\n\n\n\n## Long-term Strategy\n\n",
                artifact.title
            ),
            ArtifactType::OnePager => format!(
                "# {}\n\n## Executive Summary\n\n\n\n## Target Audience\n\n\n\n## Key Benefits\n\n\n\n## Success Metrics\n\n",
                artifact.title
            ),
            ArtifactType::PRD => format!(
                "# {}\n\n## Background\n\n\n\n## Assumptions\n\n\n\n## Product Requirements\n\n\n\n## Non-Functional Requirements\n\n",
                artifact.title
            ),
            ArtifactType::Initiative => format!(
                "# {}\n\n## Persona\n\n\n\n## Background\n\n\n\n## Market View\n\n\n\n## Competitive View\n\n\n\n## Reasoning\n\n",
                artifact.title
            ),
            ArtifactType::CompetitiveResearch => format!(
                "# {}\n\n## Competitors Overview\n\n| Competitor | Strengths | Weaknesses | Our Edge |\n|------------|-----------|------------|----------|\n|            |           |            |          |\n\n## Feature Comparison\n\n\n\n## Market Opportunity\n\n",
                artifact.title
            ),
            ArtifactType::UserStory => format!(
                "# {}\n\n## User Story\n\nAs a [user type], I want to [action], so that [value].\n\n## Acceptance Criteria\n\n- [ ] Scenario 1\n- [ ] Scenario 2\n\n## Edge Cases & Expected Results\n\n\n\n## Technical Implementation Notes\n\n",
                artifact.title
            ),
            ArtifactType::Insight => format!(
                "# {}\n\n## Observation\n\n\n\n## Implications\n\n",
                artifact.title
            ),
        }
    }
}
