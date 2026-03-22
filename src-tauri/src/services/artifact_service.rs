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
                ArtifactType::Initiative,
                ArtifactType::CompetitiveResearch,
                ArtifactType::UserStory,
                ArtifactType::Presentation,
            ]
        };

        let mut artifacts = Vec::new();

        for at in types_to_scan {
            let dir = project_dir.join(at.directory_name());
            if !dir.exists() {
                continue;
            }

            // Recursively find all .md files
            for entry in walkdir::WalkDir::new(&dir).into_iter().filter_map(|e| e.ok()) {
                let path = entry.path();
                if path.extension().and_then(|e| e.to_str()) == Some("md") {
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
                            
                            // If sidecar load fails, it might be a manually added markdown file
                            let content = std::fs::read_to_string(&path).unwrap_or_default();
                            
                            // Try to extract title from first line or use id
                            let title = content.lines()
                                .find(|l| l.starts_with("# "))
                                .map(|l| l.trim_start_matches("# ").trim().to_string())
                                .unwrap_or_else(|| id.clone());
                            
                            let mut artifact = Artifact::new(
                                id.clone(),
                                at.clone(),
                                title,
                                project_id.to_string(),
                                parent_dir.to_path_buf(),
                            );
                            artifact.content = content;
                            
                            // Automatically save the sidecar so it's fully registered next time
                            let _ = artifact.save();
                            
                            artifacts.push(artifact);
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
            ArtifactType::Initiative => "initiative",
            ArtifactType::CompetitiveResearch => "competitive_research",
            ArtifactType::UserStory => "user_story",
            ArtifactType::Presentation => "presentation",
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
                "# {}\n\n## Strategic Goal\n\n[High-level objective this roadmap supports]\n\n## Timeline\n\n| Q1 | Q2 | Q3 | Q4 |\n|----|----|----|----|\n| [Initiative A] | [Initiative B] | [Initiative C] | [Initiative D] |\n\n## Key Milestones\n\n- [ ] Milestone 1\n- [ ] Milestone 2\n\n## Dependencies & Risks\n\n",
                artifact.title
            ),
            ArtifactType::ProductVision => format!(
                "# {}\n\n## Target Audience\n\n[Who is the product for?]\n\n## Problem Space\n\n[What problem are we solving?]\n\n## The Vision\n\n[What does the future look like when we succeed?]\n\n## Value Proposition\n\n[Why should users care?]\n\n## Key Pillars / Principles\n\n1. \n2. \n",
                artifact.title
            ),
            ArtifactType::OnePager => format!(
                "# {}\n\n## Executive Summary\n\n[Brief overview of the project and its goals]\n\n## Problem / Opportunity\n\n[Details on the problem we are solving or opportunity we are seizing]\n\n## Proposed Solution\n\n[High-level description of what we are building]\n\n## Target Audience\n\n[Who are the primary users?]\n\n## Goals & Metrics\n\n[How will we measure success?]\n\n## Rough Timeline\n\n[Estimated schedule for delivery]\n",
                artifact.title
            ),
            ArtifactType::Initiative => format!(
                "# {}\n\n## Background\n\n[Context and rationale for this initiative]\n\n## Scope\n\n[What is included and excluded?]\n\n## Value & Impact\n\n[Business and user value expected from this initiative]\n\n## Key Deliverables\n\n- [ ] Deliverable A\n- [ ] Deliverable B\n\n## Milestones & Timeline\n\n[Key dates and phases]\n\n## Team & Stakeholders\n\n[Who is involved?]\n",
                artifact.title
            ),
            ArtifactType::CompetitiveResearch => format!(
                "# {}\n\n## Competitor\n\n[Name of competitor]\n\n## Strengths\n\n- \n- \n\n## Weaknesses\n\n- \n- \n\n## Feature Comparison\n\n| Feature | Us | Competitor | Notes |\n|---------|----|------------|-------|\n| F1      | ✅ | ❌         |       |\n\n## Strategic Insights\n\n[What can we learn or do differently?]\n",
                artifact.title
            ),
            ArtifactType::UserStory => format!(
                "# {}\n\n## As a...\n\n[Role/Persona]\n\n## I want to...\n\n[Action/Goal]\n\n## So that...\n\n[Reason/Value]\n\n## Acceptance Criteria\n\n- [ ] Given [precondition]\n- [ ] When [action]\n- [ ] Then [result]\n\n## Technical Notes/Dependencies\n\n[Any relevant technical details]\n",
                artifact.title
            ),
            ArtifactType::Presentation => format!(
                "# {}\n\n## Presentation Title\n\n[Your subtitle here]\n\n## Slide 1: Introduction\n\n[Content for introduction]\n\n## Slide 2: Main Point\n\n[Content for main point]\n\n## Slide 3: Conclusion\n\n[Closing remarks]\n",
                artifact.title
            ),
        }
    }
}
