use crate::models::artifact::{Artifact, ArtifactType};
use crate::services::settings_service::SettingsService;
use chrono::Utc;
use std::fs;
use std::path::PathBuf;

pub struct ArtifactService;

impl ArtifactService {
    /// Get the artifact directory for a specific type within a project
    fn artifact_dir(project_id: &str, artifact_type: &ArtifactType) -> Result<PathBuf, String> {
        let projects_path = SettingsService::get_projects_path()
            .map_err(|e| format!("Failed to get projects path: {}", e))?;
        let project_dir = projects_path.join(project_id);
        
        let target_name = artifact_type.directory_name();
        let direct_path = project_dir.join(target_name);
        
        if direct_path.exists() {
            return Ok(direct_path);
        }

        // Case-insensitive fallback
        if let Ok(entries) = fs::read_dir(&project_dir) {
            for entry in entries.flatten() {
                if entry.path().is_dir() {
                    if let Some(name) = entry.file_name().to_str() {
                        if name.to_lowercase() == target_name.to_lowercase() {
                            return Ok(entry.path());
                        }
                    }
                }
            }
        }

        Ok(direct_path)
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
                ArtifactType::Presentation,
                ArtifactType::PrFaq,
            ]
        };

        let mut artifacts = Vec::new();

        for at in types_to_scan {
            let dir = Self::artifact_dir(project_id, &at)?;
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
                        Ok(mut artifact) => {
                            // Smarter title extraction for presentations if title is generic
                            if at == ArtifactType::Presentation && (artifact.title.is_empty() || artifact.title.to_lowercase().contains("presentation")) {
                                if let Some(new_title) = Self::extract_smart_title(&artifact.content, &at) {
                                    if new_title != artifact.title {
                                        artifact.title = new_title;
                                        let _ = artifact.save();
                                    }
                                }
                            }
                            artifacts.push(artifact);
                        },
                        Err(e) => {
                            log::warn!("Skipping artifact '{}' in {:?}: {}", id, parent_dir, e);
                            
                            // If sidecar load fails, it might be a manually added markdown file
                            let content = std::fs::read_to_string(&path).unwrap_or_default();
                            
                            // Try to extract title from first line or use id (with smart extraction for presentations)
                            let title = Self::extract_smart_title(&content, &at)
                                .unwrap_or_else(|| {
                                    content.lines()
                                        .find(|l| l.starts_with("# "))
                                        .map(|l| l.trim_start_matches("# ").trim().to_string())
                                        .unwrap_or_else(|| id.clone())
                                });
                            
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
            ArtifactType::PRD => "prd",
            ArtifactType::Initiative => "initiative",
            ArtifactType::CompetitiveResearch => "competitive_research",
            ArtifactType::UserStory => "user_story",
            ArtifactType::Insight => "insight",
            ArtifactType::Presentation => "presentation",
            ArtifactType::PrFaq => "pr_faq",
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

    /// Update metadata (title/confidence) for an artifact
    pub fn update_metadata(
        project_id: &str,
        artifact_type: ArtifactType,
        artifact_id: &str,
        title: Option<String>,
        confidence: Option<f64>,
    ) -> Result<(), String> {
        let mut artifact = Self::load_artifact(project_id, artifact_type, artifact_id)?;
        
        let mut changed = false;
        if let Some(t) = title {
            if !t.is_empty() && t != artifact.title {
                artifact.title = t;
                changed = true;
            }
        }
        
        if confidence.is_some() {
            if confidence != artifact.confidence {
                artifact.confidence = confidence;
                changed = true;
            }
        }

        if changed {
            artifact.updated = Utc::now();
            artifact.save().map_err(|e| format!("Failed to save artifact metadata: {}", e))?;
        }
        
        Ok(())
    }

    /// Extract a smarter title from markdown content
    /// For presentations: # H1 - ## H2 (subtitle)
    fn extract_smart_title(content: &str, artifact_type: &ArtifactType) -> Option<String> {
        let h1 = content.lines()
            .find(|l| l.starts_with("# "))
            .map(|l| l.trim_start_matches("# ").trim().to_string());

        match artifact_type {
            ArtifactType::Presentation => {
                if let Some(main_title) = h1 {
                    // Try to find a subtitle (H2)
                    let subtitle = content.lines()
                        .find(|l| l.starts_with("## ") && !l.to_lowercase().contains("goal") && !l.to_lowercase().contains("outline"))
                        .map(|l| l.trim_start_matches("## ").trim().to_string());
                    
                    if let Some(sub) = subtitle {
                        return Some(format!("{} — {}", main_title, sub));
                    }
                    return Some(main_title);
                }
                None
            },
            _ => h1
        }
    }

    /// Trigger migration for all artifacts in a project to ensure smarter titles and metadata
    pub fn migrate_project_artifacts(project_id: &str) -> Result<usize, String> {
        let artifacts = Self::list_artifacts(project_id, None)?;
        let mut count = 0;
        for mut art in artifacts {
            let old_title = art.title.clone();
            if let Some(new_title) = Self::extract_smart_title(&art.content, &art.artifact_type) {
                if new_title != old_title {
                    art.title = new_title;
                    let _ = art.save();
                    count += 1;
                }
            }
        }
        Ok(count)
    }

    /// Generate default markdown content based on artifact type
    fn default_content(artifact: &Artifact) -> String {
        match artifact.artifact_type {
            ArtifactType::Roadmap => format!(
                "# {}\n\n## Vision\nDetailed vision for the product's mid-to-long term future.\n\n## Strategic Goals (SMART)\n- **Goal 1**: Describe objective and target date.\n- **Goal 2**: Describe objective and target date.\n\n## Key Themes & Initiatives\n### [Theme A]\n- **Initiative 1**: Brief description and expected outcome.\n- **Initiative 2**: Brief description and expected outcome.\n\n### [Theme B]\n- **Initiative 3**: Brief description and expected outcome.\n\n## Timeline / Phases\n- **Now**: High-certainty items currently in development.\n- **Next**: Planned items with high priority.\n- **Later**: Future explorations and backlog items.\n\n## Success Metrics\nHow will we measure the success of this roadmap?",
                artifact.title
            ),
            ArtifactType::ProductVision => format!(
                "# {}\n\n## The Problem\nWhat is the core problem we are solving?\n\n## Target Audience\nWho are we building this for?\n\n## Vision Statement\nA concise, inspiring statement of the product's ultimate goal.\n\n## Key Differentiators\nWhat sets this apart from existing solutions?\n\n## Expected Outcomes\nWhat does the world look like when this vision is realized?",
                artifact.title
            ),
            ArtifactType::OnePager => format!(
                "# {}\n\n## Overview\nA brief summary of the proposal.\n\n## Problem Statement\nThe specific customer pain point we are addressing.\n\n## Proposed Solution\nHigh-level description of how we solve it.\n\n## Key Benefits\n- **Benefit 1**: Description.\n- **Benefit 2**: Description.\n\n## Success Criteria\nWhat does success look like?\n\n## Timeline & Milestones\nKey dates for implementation.",
                artifact.title
            ),
            ArtifactType::PRD => format!(
                "# {}\n\n## Overview\nContext and background for this product/feature.\n\n## Goals & Objectives\nWhat are we trying to achieve?\n\n## Target Audience\nWho is this for?\n\n## User Stories\n- **User Story 1**: As a [user], I want [action] so that [value].\n- **User Story 2**: ...\n\n## Functional Requirements\nDetailed list of must-have functionalities.\n\n## Non-Functional Requirements\nPerformance, security, scalability, etc.\n\n## Designs & Mockups\n[Link or description of visual designs]\n\n## Success Metrics (KPIs)\nHow will we track performance?\n\n## Out of Scope\nWhat we are NOT doing in this version.",
                artifact.title
            ),
            ArtifactType::Initiative => format!(
                "# {}\n\n## Objective\nPrimary goal of this initiative.\n\n## Strategic Context\nHow does this align with the overall product roadmap?\n\n## Desired Outcomes\nMeasurable results expected from this effort.\n\n## High-Level Requirements\nKey features or changes needed.\n\n## Priority & WSJF\nWeighting of this initiative relative to others.",
                artifact.title
            ),
            ArtifactType::CompetitiveResearch => format!(
                "# {}\n\n## Objectives\nWhy are we conducting this analysis?\n\n## Competitors\n### [Competitor A]\n- **Strengths**: ...\n- **Weaknesses**: ...\n- **Pricing**: ...\n\n### [Competitor B]\n- **Strengths**: ...\n- **Weaknesses**: ...\n\n## SWOT Analysis\n- **Strengths**: [Our strengths]\n- **Weaknesses**: [Our weaknesses]\n- **Opportunities**: [Market gaps]\n- **Threats**: [External risks]\n\n## Actionable Insights\nRecommendations based on this research.",
                artifact.title
            ),
            ArtifactType::UserStory => format!(
                "# {}\n\n## Story\nAs a **[user type]**, I want **[to perform an action]** so that **[I achieve a value/benefit]**.\n\n## Acceptance Criteria\n- [ ] Criterion 1\n- [ ] Criterion 2\n- [ ] Criterion 3\n\n## Notes & Constraints\nAny technical or design limitations.",
                artifact.title
            ),
            ArtifactType::Insight => format!(
                "# {}\n\n## Observation\nWhat data or feedback was observed?\n\n## Source\nWhere did this information come from? (e.g., User Interview, Analytics, CS Ticket)\n\n## Meaning & Impact\nWhat does this mean for the product? How significant is it?\n\n## Recommendation\nProposed action items based on this insight.",
                artifact.title
            ),
            ArtifactType::Presentation => format!(
                "# {}\n\n## Presentation Goal\nWhat is the main message for this audience?\n\n## Target Audience\nWho are you presenting to? (Executives, Engineers, Customers)\n\n## Outline\n1. **Introduction**: Problem and Vision.\n2. **Current Progress**: Key milestones achieved.\n3. **Future Strategy**: Roadmap and upcoming initiatives.\n4. **Call to Action**: What do you need from the audience?\n\n## Key Assets\nLinks to required charts, graphs, or demos.",
                artifact.title
            ),
            ArtifactType::PrFaq => format!(
                "# {}\n\n## Press Release\n**FOR IMMEDIATE RELEASE**\n\n### Introduction\nA one-sentence summary of the product and its primary benefit.\n\n### Problem\nWhat is the specific customer problem or opportunity this product addresses? (Amazon Q2)\n\n### Solution\nHow does the product solve the problem or seize the opportunity? (Amazon Q3)\n\n### Executive Quote\n\"A quote from a company spokesperson summarizing the vision and value of the product.\"\n\n### Customer Experience\nWhat does the customer experience look like? Tell a story of how a customer uses it. (Amazon Q5)\n\n### Customer Quote\n\"A quote from a hypothetical customer expressing how the product solved their problem.\" (Amazon Q1)\n\n### Call to Action\nHow can customers get started or learn more today?\n\n## External FAQ\n*Include 5-10 questions a customer would actually ask.*\n\n### 1. [Customer Question]?\n[Answer should be clear, concise, and benefit-oriented.]\n\n### 2. [Customer Question]?\n[Answer]\n\n## Internal FAQ\n*Include 5-10 tough questions from stakeholders, engineering, or leadership.*\n\n### 1. [Stakeholder Question]?\n[Answer should address feasibility, risk, or business logic with intellectual honesty.]\n\n### 2. [Stakeholder Question]?\n[Answer]",
                artifact.title
            ),
        }
    }
}
