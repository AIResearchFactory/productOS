use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ProjectError {
    #[error("Failed to read project file: {0}")]
    ReadError(#[from] std::io::Error),

    #[error("Failed to parse project metadata: {0}")]
    ParseError(String),

    #[error("Invalid project structure: {0}")]
    InvalidStructure(String),

    #[error("Settings error: {0}")]
    SettingsError(String),
}

impl From<crate::models::settings::SettingsError> for ProjectError {
    fn from(err: crate::models::settings::SettingsError) -> Self {
        ProjectError::SettingsError(format!("{}", err))
    }
}

/// Represents a project with metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub id: String,
    pub name: String,
    pub goal: String,
    pub skills: Vec<String>,
    #[serde(rename = "created_at")]
    pub created: DateTime<Utc>,
    pub path: PathBuf,
}

/// Frontmatter from .project.md matching the YAML frontmatter structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectMetadata {
    pub id: String,
    pub name: String,
    pub goal: String,
    pub skills: Vec<String>,
    pub created: String,
}

impl Project {
    /// Load a project from its metadata file or legacy .project.md
    pub fn load<P: AsRef<Path>>(project_path: P) -> Result<Self, ProjectError> {
        let project_path = project_path.as_ref().to_path_buf();
        let metadata_path = project_path.join(".metadata").join("project.json");

        // Strategy 1: Load from .metadata/project.json (New Format)
        if metadata_path.exists() {
            let content = fs::read_to_string(&metadata_path)?;
            let metadata: ProjectMetadata = serde_json::from_str(&content).map_err(|e| {
                ProjectError::ParseError(format!("Failed to parse project JSON: {}", e))
            })?;

            // Parse created date
            let created = DateTime::parse_from_rfc3339(&metadata.created)
                .map_err(|e| ProjectError::ParseError(format!("Invalid date format: {}", e)))?
                .with_timezone(&Utc);

            return Ok(Project {
                id: metadata.id,
                name: metadata.name,
                goal: metadata.goal,
                skills: metadata.skills,
                created,
                path: project_path,
            });
        }

        // Strategy 2: Load from .project.md (Legacy Format) and Migrate
        let legacy_path = project_path.join(".project.md");
        if legacy_path.exists() {
            log::info!(
                "Found legacy project at {:?}, attempting migration...",
                project_path
            );

            let content = fs::read_to_string(&legacy_path)?;

            // Extract frontmatter using regex
            let re = regex::Regex::new(r"(?s)^---\s*\n(.*?)\n---\s*\n").unwrap();

            if let Some(captures) = re.captures(&content) {
                let frontmatter = &captures[1];

                // Parse YAML
                let metadata: ProjectMetadata = serde_yaml::from_str(frontmatter).map_err(|e| {
                    ProjectError::ParseError(format!("Failed to parse legacy YAML: {}", e))
                })?;

                // Parse date
                let created = DateTime::parse_from_rfc3339(&metadata.created)
                    .map_err(|e| ProjectError::ParseError(format!("Invalid legacy date: {}", e)))?
                    .with_timezone(&Utc);

                let project = Project {
                    id: metadata.id,
                    name: metadata.name,
                    goal: metadata.goal,
                    skills: metadata.skills,
                    created,
                    path: project_path.clone(),
                };

                // Perform Migration: Save to new format
                if let Err(e) = project.save() {
                    log::error!("Failed to save migrated project metadata: {}", e);
                    // We continue even if save fails, but log it
                } else {
                    log::info!(
                        "Successfully migrated project {:?} to new structure",
                        project.name
                    );
                }

                return Ok(project);
            } else {
                return Err(ProjectError::ParseError(
                    "Invalid legacy .project.md format (no frontmatter found)".to_string(),
                ));
            }
        }

        Err(ProjectError::ReadError(std::io::Error::new(
            std::io::ErrorKind::NotFound,
            format!("Project metadata not found at {:?}", metadata_path),
        )))
    }

    /// Save project metadata to its JSON file
    pub fn save(&self) -> Result<(), ProjectError> {
        let metadata_dir = self.path.join(".metadata");
        let metadata_path = metadata_dir.join("project.json");

        // Ensure .metadata directory exists
        if !metadata_dir.exists() {
            fs::create_dir_all(&metadata_dir)?;
        }

        let metadata = ProjectMetadata {
            id: self.id.clone(),
            name: self.name.clone(),
            goal: self.goal.clone(),
            skills: self.skills.clone(),
            created: self.created.to_rfc3339(),
        };

        let content = serde_json::to_string_pretty(&metadata)
            .map_err(|e| ProjectError::ParseError(format!("Failed to serialize project: {}", e)))?;

        log::info!("Writing project metadata to {:?}", metadata_path);
        fs::write(metadata_path, content)?;

        Ok(())
    }

    /// Validate that the project structure is correct
    pub fn validate_structure(&self) -> Result<(), ProjectError> {
        let metadata_file = self.path.join(".metadata").join("project.json");

        if !metadata_file.exists() {
            return Err(ProjectError::InvalidStructure(format!(
                "Project metadata not found at {:?}",
                metadata_file
            )));
        }

        if !self.path.exists() {
            return Err(ProjectError::InvalidStructure(format!(
                "Project directory not found at {:?}",
                self.path
            )));
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {

    // No legacy migration tests needed as YAML/MD frontmatter support is removed.
}
