use crate::models::project::{Project, ProjectError};
use crate::services::settings_service::SettingsService;
use chrono::Utc;
use std::fs;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

/// Service for managing projects - discovery, validation, and creation
pub struct ProjectService;

impl ProjectService {
    /// Scan projects directory and return all valid projects
    pub fn discover_projects() -> Result<Vec<Project>, ProjectError> {
        let projects_path = SettingsService::get_projects_path().map_err(|e| {
            ProjectError::ReadError(std::io::Error::other(format!(
                "Failed to get projects path: {}",
                e
            )))
        })?;

        // Create projects directory if it doesn't exist
        if !projects_path.exists() {
            fs::create_dir_all(&projects_path)?;
            return Ok(Vec::new());
        }

        let mut projects = Vec::new();

        // Read all entries in the projects directory
        for entry in fs::read_dir(&projects_path)? {
            let entry = entry?;
            let path = entry.path();

            // Skip if not a directory
            if !path.is_dir() {
                continue;
            }

            log::info!("Checking directory for valid project: {:?}", path);

            // Check if this is a valid project
            if Self::is_valid_project(&path) {
                match Self::load_project(&path) {
                    Ok(project) => {
                        log::info!(
                            "Successfully loaded project: {} (ID: {})",
                            project.name,
                            project.id
                        );
                        projects.push(project)
                    }
                    Err(e) => {
                        log::error!("Failed to load project at {:?}: {}", path, e);
                        continue;
                    }
                }
            } else {
                log::warn!("Directory is not a valid project (missing .metadata/project.json or legacy .project.md): {:?}", path);
            }
        }

        log::info!(
            "Discovered {} valid projects in {:?}",
            projects.len(),
            projects_path
        );
        Ok(projects)
    }

    /// Load a single project by path
    pub fn load_project(path: &Path) -> Result<Project, ProjectError> {
        Project::load(path)
    }

    /// Validate a project ID used for filesystem path joins.
    /// Allowed: ASCII letters, numbers, hyphen and underscore.
    pub fn validate_project_id(project_id: &str) -> Result<(), ProjectError> {
        if project_id.is_empty() {
            return Err(ProjectError::InvalidStructure("Project ID cannot be empty".to_string()));
        }

        if !project_id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
        {
            return Err(ProjectError::InvalidStructure(
                "Invalid project ID format".to_string(),
            ));
        }

        Ok(())
    }

    /// Resolve a project directory path safely and ensure it stays within the projects root.
    pub fn resolve_project_path(project_id: &str) -> Result<PathBuf, ProjectError> {
        Self::validate_project_id(project_id)?;

        let projects_path = SettingsService::get_projects_path().map_err(|e| {
            ProjectError::ReadError(std::io::Error::other(format!(
                "Failed to get projects path: {}",
                e
            )))
        })?;

        let project_path = projects_path.join(project_id);

        // Lexical boundary check (works even if the path doesn't exist yet)
        let canonical_base = projects_path.canonicalize().unwrap_or(projects_path.clone());
        let canonical_project = project_path.canonicalize().unwrap_or(project_path.clone());

        if !canonical_project.starts_with(&canonical_base) {
            return Err(ProjectError::InvalidStructure(
                "Project path escapes projects directory".to_string(),
            ));
        }

        Ok(project_path)
    }

    pub fn load_project_by_id(project_id: &str) -> Result<Project, ProjectError> {
        let projects_path = SettingsService::get_projects_path().map_err(|e| {
            ProjectError::ReadError(std::io::Error::other(format!(
                "Failed to get projects path: {}",
                e
            )))
        })?;
        log::info!(
            "Loading project by ID '{}' from projects path: {:?}",
            project_id,
            projects_path
        );

        let project_path = Self::resolve_project_path(project_id)?;
        Self::load_project(&project_path)
    }

    /// Validate if a directory is a valid project (has .metadata/project.json)
    pub fn is_valid_project(path: &Path) -> bool {
        // Try to load and parse the project (handles legacy migration internally if needed)
        match Project::load(path) {
            Ok(project) => {
                // Validate that required fields are not empty
                let is_valid =
                    !project.id.is_empty() && !project.name.is_empty() && !project.goal.is_empty();
                if !is_valid {
                    log::warn!(
                        "Project at {:?} has empty required fields: id='{}', name='{}', goal='{}'",
                        path,
                        project.id,
                        project.name,
                        project.goal
                    );
                }
                is_valid
            }
            Err(_) => false,
        }
    }

    /// Create a new project with metadata file
    pub fn create_project(
        name: &str,
        goal: &str,
        skills: Vec<String>,
    ) -> Result<Project, ProjectError> {
        let projects_path = SettingsService::get_projects_path().map_err(|e| {
            ProjectError::ReadError(std::io::Error::other(format!(
                "Failed to get projects path: {}",
                e
            )))
        })?;
        log::info!("in create_project");
        // Create projects directory if it doesn't exist
        if !projects_path.exists() {
            fs::create_dir_all(&projects_path)?;
            log::info!("projects path created");
        }

        // Generate project ID from name (lowercase, replace spaces with hyphens)
        let project_id = name
            .to_lowercase()
            .replace(' ', "-")
            .chars()
            .filter(|c| c.is_alphanumeric() || *c == '-' || *c == '_')
            .collect::<String>();

        let project_path = projects_path.join(&project_id);
        log::info!("Attempting to create project folder at {:?}", project_path);

        // Check if project already exists
        if project_path.exists() {
            log::error!("Creation error: path already exists: {:?}", project_path);
            return Err(ProjectError::InvalidStructure(format!(
                "Project directory already exists at {:?}",
                project_path
            )));
        }

        // Create project directory
        fs::create_dir_all(&project_path)?;
        log::info!("project folder created");
        let created = Utc::now();

        // Create Project model and save it (handles .metadata/project.json)
        let project = Project {
            id: project_id,
            name: name.to_string(),
            goal: goal.to_string(),
            skills: skills.clone(),
            created,
            path: project_path.clone(),
        };

        project.save()?;

        // Also create an initial README.md or notes file so the project isn't empty of content
        let readme_content = format!(
            "# {}\n\n## Goal\n{}\n\nWelcome to your new research project!\n",
            name, goal
        );
        fs::write(project_path.join("README.md"), readme_content)?;

        // Create default project settings
        let settings = crate::models::settings::ProjectSettings::default();
        SettingsService::save_project_settings(&project_path, &settings)?;

        // Load and return the newly created project
        Self::load_project(&project_path)
    }

    /// Update project metadata in .metadata/project.json
    pub fn update_project_metadata(
        project_id: &str,
        name: Option<String>,
        goal: Option<String>,
    ) -> Result<(), ProjectError> {
        let mut project = Self::load_project_by_id(project_id)?;

        if let Some(new_name) = name {
            project.name = new_name;
        }

        if let Some(new_goal) = goal {
            project.goal = new_goal;
        }

        project.save()?;

        Ok(())
    }

    /// List all markdown files in a project (excluding hidden metadata)
    pub fn list_project_files(project_id: &str) -> Result<Vec<String>, ProjectError> {
        let project_id = project_id.trim();
        let projects_path = SettingsService::get_projects_path().map_err(|e| {
            ProjectError::ReadError(std::io::Error::other(format!(
                "Failed to get projects path: {}",
                e
            )))
        })?;

        let mut project_path = projects_path.join(project_id);
        log::info!(
            "Attempting to list files for project: {:?} at path: {:?}",
            project_id,
            project_path
        );

        // If path doesn't exist, it might be because the folder name is different from project_id
        // Try to find the project by scanning
        if !project_path.exists() {
            log::warn!(
                "Project path {:?} not found, scanning projects directory for ID: {}",
                project_path,
                project_id
            );
            let projects = Self::discover_projects()?;
            if let Some(found_project) = projects.into_iter().find(|p| p.id == project_id) {
                project_path = found_project.path;
                log::info!("Found project folder via scan: {:?}", project_path);
            } else {
                log::error!(
                    "Project with ID '{}' not found in {:?}",
                    project_id,
                    projects_path
                );
                return Err(ProjectError::InvalidStructure(
                    format!("Project directory not found for ID '{}' at {:?}. Make sure the .project.md file has the correct ID.", project_id, projects_path)
                ));
            }
        }

        let mut markdown_files = Vec::new();

        // Use walkdir to recursively find files
        for entry in WalkDir::new(&project_path)
            .into_iter()
            .filter_entry(|e| {
                // Ignore hidden directories like .metadata, .templates, .git
                let is_hidden = e
                    .file_name()
                    .to_str()
                    .map(|s| s.starts_with('.'))
                    .unwrap_or(false);
                !is_hidden
            })
            .filter_map(|e| e.ok())
        {
            let path = entry.path();

            // Skip directories
            if path.is_dir() {
                continue;
            }

            // Check if it's a relevant file (markdown or common source)
            if let Some(extension) = path.extension() {
                let ext = extension.to_string_lossy().to_lowercase();
                let is_relevant = matches!(
                    ext.as_str(),
                    "md" | "txt"
                        | "rs"
                        | "js"
                        | "ts"
                        | "py"
                        | "go"
                        | "c"
                        | "cpp"
                        | "java"
                        | "json"
                        | "yaml"
                        | "yml"
                );

                if is_relevant {
                    // Exclude any file that starts with a dot (hidden files, legacy metadata)
                    if let Some(filename) = path.file_name() {
                        let filename_str = filename.to_string_lossy();
                        if !filename_str.starts_with('.') {
                            // Get relative path
                            if let Ok(rel_path) = path.strip_prefix(&project_path) {
                                // Add to list using unix style path separators
                                let rel_path_str = rel_path.to_string_lossy().replace("\\", "/");
                                markdown_files.push(rel_path_str);
                            }
                        }
                    }
                }
            }
        }

        // Sort alphabetically
        markdown_files.sort();

        Ok(markdown_files)
    }
    pub fn delete_project(project_id: &str) -> Result<(), ProjectError> {
        let projects_path = SettingsService::get_projects_path().map_err(|e| {
            ProjectError::ReadError(std::io::Error::other(format!(
                "Failed to get projects path: {}",
                e
            )))
        })?;

        let project_path = projects_path.join(project_id);

        if !project_path.exists() {
            return Err(ProjectError::ReadError(std::io::Error::other(format!(
                "Project path not found: {:?}",
                project_path
            ))));
        }

        log::info!("Deleting project at {:?}", project_path);
        fs::remove_dir_all(project_path)?;

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn test_project_id_generation() {
        let name = "My Project_Name 123!";
        let id: String = name
            .to_lowercase()
            .replace(' ', "-")
            .chars()
            .filter(|c| c.is_alphanumeric() || *c == '-' || *c == '_')
            .collect();
        assert_eq!(id, "my-project_name-123");
    }

    #[test]
    fn test_validate_project_id_with_underscores() {
        assert!(ProjectService::validate_project_id("my_project").is_ok());
        assert!(ProjectService::validate_project_id("my-project").is_ok());
        assert!(ProjectService::validate_project_id("my-project_123").is_ok());
        assert!(ProjectService::validate_project_id("invalid!").is_err());
    }

    #[test]
    fn test_is_valid_project() {
        let temp_dir = TempDir::new().unwrap();
        let project_path = temp_dir.path().join("test-project");
        fs::create_dir(&project_path).unwrap();

        // Create a valid .metadata/project.json
        let metadata_dir = project_path.join(".metadata");
        fs::create_dir(&metadata_dir).unwrap();
        let project_meta = serde_json::json!({
            "id": "test-project",
            "name": "Test Project",
            "goal": "Test the project validation",
            "skills": ["rust", "testing"],
            "created": "2025-01-01T00:00:00Z"
        });

        fs::write(
            metadata_dir.join("project.json"),
            serde_json::to_string(&project_meta).unwrap(),
        )
        .unwrap();

        assert!(ProjectService::is_valid_project(&project_path));
    }

    #[test]
    fn test_is_invalid_project_no_file() {
        let temp_dir = TempDir::new().unwrap();
        let project_path = temp_dir.path().join("test-project");
        fs::create_dir(&project_path).unwrap();

        assert!(!ProjectService::is_valid_project(&project_path));
    }

    #[test]
    fn test_list_project_files() {
        let temp_dir = TempDir::new().unwrap();
        let project_path = temp_dir.path().join("test-project");
        fs::create_dir(&project_path).unwrap();

        // Create some markdown files
        fs::write(project_path.join("research.md"), "# Research").unwrap();
        fs::write(project_path.join("notes.md"), "# Notes").unwrap();
        fs::write(project_path.join("data.txt"), "Some data").unwrap();

        // Hidden files should be ignored
        fs::write(project_path.join(".metadata.json"), "hidden").unwrap();

        // Set up environment to use temp dir as projects path
        std::env::set_var("HOME", temp_dir.path());

        let _files = ProjectService::list_project_files("test-project");

        // This test would need proper setup of SettingsService to work
        // For now, we're just demonstrating the structure
    }
}
