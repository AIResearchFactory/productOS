use crate::services::file_service::FileService;
use crate::services::project_service::ProjectService;
use crate::services::artifact_service::ArtifactService;
use anyhow::{Context, Result};

pub struct ContextService;

impl ContextService {
    /// Gather project context as a formatted string
    pub fn get_project_context(project_id: &str) -> Result<String> {
        let mut context = String::from("# Project Context\n\n");

        // 1. Add Project Metadata
        let project = ProjectService::load_project_by_id(project_id)
            .context("Failed to load project for context injection")?;

        context.push_str(&format!("**Project Name**: {}\n", project.name));
        context.push_str(&format!("**Project Goal**: {}\n\n", project.goal));

        // 2. Add README content if it exists
        if let Ok(readme) = FileService::read_file(project_id, "README.md") {
            context.push_str("## README.md\n\n");
            context.push_str(&readme);
            context.push_str("\n\n");
        }

        // 3. Add Research Log (Recent entries)
        if let Ok(log) = FileService::read_file(project_id, "research_log.md") {
            context.push_str("## Recent Research History (from research_log.md)\n\n");
            let lines: Vec<&str> = log.lines().collect();
            let tail = if lines.len() > 50 {
                lines[lines.len() - 50..].join("\n")
            } else {
                log
            };
            context.push_str(&tail);
            context.push_str("\n\n");
        }

        // 4. Add FIRST-CLASS ARTIFACTS (The "Final Step" of discovery)
        if let Ok(artifacts) = ArtifactService::list_artifacts(project_id, None) {
            if !artifacts.is_empty() {
                context.push_str("## Project Artifacts (Final Discovery Steps)\n");
                context.push_str("These are high-quality, structured documents that represent the final output of research phases.\n\n");
                for artifact in artifacts {
                    context.push_str(&format!(
                        "### [{}] {}\n",
                        artifact.artifact_type.display_name(),
                        artifact.title
                    ));
                    
                    // Take first 15 lines of content
                    let preview: String = artifact.content.lines().take(15).collect::<Vec<_>>().join("\n");
                    context.push_str("```markdown\n");
                    context.push_str(&preview);
                    if artifact.content.lines().count() > 15 {
                        context.push_str("\n[... content continues ...]");
                    }
                    context.push_str("\n```\n\n");
                }
            }
        }

        // 5. Add Research Files & Resources (The "Building Blocks")
        if let Ok(files) = ProjectService::list_project_files(project_id) {
            context.push_str("## Research Files & Resources\n");
            context.push_str("These files contain raw data, validations, and technical resources used to strengthen the research.\n\n");
            for file in files {
                // Skip files already handled or metadata
                if file != "README.md" && file != "research_log.md" && !file.starts_with('.') {
                    context.push_str(&format!("### File: {}\n", file));
                    if let Ok(content) = FileService::read_file(project_id, &file) {
                        let ext = std::path::Path::new(&file)
                            .extension()
                            .and_then(|e| e.to_str())
                            .unwrap_or("text");

                        let preview: String = content.lines().take(10).collect::<Vec<_>>().join("\n");
                        context.push_str(&format!("```{}\n", ext));
                        context.push_str(&preview);
                        if content.lines().count() > 10 {
                            context.push_str("\n[...]");
                        }
                        context.push_str("\n```\n\n");
                    }
                }
            }
        }

        Ok(context)
    }
}
