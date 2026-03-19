use anyhow::{Context, Result};
use serde_json;
use std::fs;
use std::path::PathBuf;

/// Get the app data directory (OS-specific)
/// Returns (default for new installs):
/// - macOS: ~/Library/Application Support/productOS
/// - Linux: ~/.local/share/productOS
/// - Windows: C:\Users\{username}\AppData\Roaming\productOS
///
/// Backward compatibility:
/// If legacy ai-researcher directory exists and productOS does not, we continue using legacy path.
pub fn get_app_data_dir() -> Result<PathBuf> {
    let app_name = "productOS";
    let legacy_name = "ai-researcher";

    #[cfg(target_os = "macos")]
    {
        let home = std::env::var("HOME").context("HOME environment variable not set")?;
        let base = PathBuf::from(home).join("Library").join("Application Support");
        let preferred = base.join(app_name);
        let legacy = base.join(legacy_name);

        if !preferred.exists() && legacy.exists() {
            return Ok(legacy);
        }
        Ok(preferred)
    }

    #[cfg(target_os = "linux")]
    {
        let home = std::env::var("HOME").context("HOME environment variable not set")?;
        let base = PathBuf::from(home).join(".local").join("share");
        let preferred = base.join(app_name);
        let legacy = base.join(legacy_name);

        if !preferred.exists() && legacy.exists() {
            return Ok(legacy);
        }
        Ok(preferred)
    }

    #[cfg(target_os = "windows")]
    {
        let app_data = std::env::var("APPDATA").context("APPDATA environment variable not set")?;
        let base = PathBuf::from(app_data);
        let preferred = base.join(app_name);
        let legacy = base.join(legacy_name);

        if !preferred.exists() && legacy.exists() {
            return Ok(legacy);
        }
        Ok(preferred)
    }

    #[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
    {
        anyhow::bail!("Unsupported operating system")
    }
}

/// Get the projects directory
/// Returns: {APP_DATA}/projects
pub fn get_projects_dir() -> Result<PathBuf> {
    if let Ok(dir) = std::env::var("PROJECTS_DIR") {
        return Ok(PathBuf::from(dir));
    }

    // Try to read from settings.json first
    if let Ok(settings_path) = get_global_settings_path() {
        if settings_path.exists() {
            if let Ok(content) = fs::read_to_string(&settings_path) {
                if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                    if let Some(path_str) = json.get("projectsPath").and_then(|v| v.as_str()) {
                        let path = PathBuf::from(path_str);
                        if !path_str.is_empty() {
                            // First check if a 'projects' folder exists inside the custom path
                            let internal_projects = path.join("projects");
                            if internal_projects.exists() && internal_projects.is_dir() {
                                return Ok(internal_projects);
                            }
                            return Ok(path);
                        }
                    }
                }
            }
        }
    }

    let app_data = get_app_data_dir()?;
    Ok(app_data.join("projects"))
}

/// Get the skills directory
/// Returns:
/// 1. Adjacent to projectsPath if configured ( {projectsPath}/../skills )
/// 2. Inside projectsPath if configured ( {projectsPath}/skills )
/// 3. Default: {APP_DATA}/skills
pub fn get_skills_dir() -> Result<PathBuf> {
    // Allow override via environment variable (useful for testing)
    if let Ok(dir) = std::env::var("SKILLS_DIR") {
        return Ok(PathBuf::from(dir));
    }

    // Try to read from settings.json first
    if let Ok(settings_path) = get_global_settings_path() {
        if settings_path.exists() {
            if let Ok(content) = fs::read_to_string(&settings_path) {
                if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                    if let Some(path_str) = json.get("projectsPath").and_then(|v| v.as_str()) {
                        if !path_str.is_empty() {
                            let projects_path = PathBuf::from(path_str);
                            
                            // 1. Check for 'workspace' pattern: path contains a 'projects' folder
                            // In this case, skills should also be in this path
                            let internal_projects = projects_path.join("projects");
                            let internal_skills = projects_path.join("skills");
                            if internal_projects.exists() && internal_projects.is_dir() {
                                if internal_skills.exists() {
                                    return Ok(internal_skills);
                                }
                            }

                            // 2. Try adjacent (preferred by user for flat project structures)
                            if let Some(parent) = projects_path.parent() {
                                let adjacent_skills = parent.join("skills");
                                if adjacent_skills.exists() {
                                    return Ok(adjacent_skills);
                                }
                                
                                // Return adjacent if projects folder exists but skills doesn't yet
                                // (it will be created by initialize_directory_structure)
                                // Only do this if projects_path is NOT the default one to avoid polluting parent of default app data
                                let app_data = get_app_data_dir()?;
                                let default_projects = app_data.join("projects");
                                if projects_path != default_projects && projects_path.exists() {
                                     return Ok(adjacent_skills);
                                }
                            }

                            // 3. Try internal (fallback for other cases)
                            if internal_skills.exists() {
                                return Ok(internal_skills);
                            }
                            
                            // If projects_path is configured and custom, but nothing found yet
                            let app_data = get_app_data_dir()?;
                            let default_projects = app_data.join("projects");
                            if projects_path != default_projects {
                                return Ok(internal_skills);
                            }
                        }
                    }
                }
            }
        }
    }

    let app_data = get_app_data_dir()?;
    Ok(app_data.join("skills"))
}

/// Get the global settings file path
/// Returns: {APP_DATA}/settings.json
pub fn get_global_settings_path() -> Result<PathBuf> {
    let app_data = get_app_data_dir()?;
    Ok(app_data.join("settings.json"))
}

/// Get the secrets file path
/// Returns: {APP_DATA}/secrets.encrypted.json
pub fn get_secrets_path() -> Result<PathBuf> {
    let app_data = get_app_data_dir()?;
    Ok(app_data.join("secrets.encrypted.json"))
}

/// Ensure the complete directory structure exists
/// Creates:
/// - {APP_DATA}/
/// - {APP_DATA}/projects/
/// - {APP_DATA}/projects/
/// - {APP_DATA}/skills/
/// - {APP_DATA}/settings.json (if not exists)
pub fn initialize_directory_structure() -> Result<()> {
    // Get the app data directory
    let app_data = get_app_data_dir()?;

    // Create the main app data directory
    if !app_data.exists() {
        fs::create_dir_all(&app_data).context(format!(
            "Failed to create app data directory: {:?}",
            app_data
        ))?;
        log::info!("Created app data directory: {:?}", app_data);
    }

    // Create projects directory
    let projects_dir = get_projects_dir()?;
    if !projects_dir.exists() {
        fs::create_dir_all(&projects_dir).context(format!(
            "Failed to create projects directory: {:?}",
            projects_dir
        ))?;
        log::info!("Created projects directory: {:?}", projects_dir);
    }

    // Create skills directory
    let skills_dir = get_skills_dir()?;
    if !skills_dir.exists() {
        fs::create_dir_all(&skills_dir).context(format!(
            "Failed to create skills directory: {:?}",
            skills_dir
        ))?;
        log::info!("Created skills directory: {:?}", skills_dir);
    }

    // Create default skill template if it doesn't exist
    let template_path = skills_dir.join("template.md");
    let sidecar_dir = skills_dir.join(".metadata");
    let sidecar_path = sidecar_dir.join("template.json");

    if !template_path.exists() {
        let default_template = r#"# {{name}}

## Overview
{{overview}}

## Prompt Template
{{template}}

## Parameters

## Examples

## Usage Guidelines
"#;
        fs::write(&template_path, default_template).context(format!(
            "Failed to create skill template: {:?}",
            template_path
        ))?;
        log::info!("Created default skill template: {:?}", template_path);

        // Create metadata sidecar for template if needed
        if !sidecar_path.exists() {
            fs::create_dir_all(&sidecar_dir).ok();
            let default_meta = serde_json::json!({
                "skill_id": "template",
                "name": "Skill Template",
                "description": "Default template for new skills",
                "capabilities": ["web_search", "data_analysis"],
                "version": "1.0.0",
                "created": chrono::Utc::now().to_rfc3339(),
                "updated": chrono::Utc::now().to_rfc3339()
            });
            fs::write(&sidecar_path, serde_json::to_string_pretty(&default_meta)?)
                .context("Failed to create skill template sidecar")?;
        }
    }

    log::info!("Directory structure initialized successfully");
    Ok(())
}

/// Get a specific project's directory path
#[allow(dead_code)]
pub fn get_project_dir(project_id: &str) -> Result<PathBuf> {
    let projects_dir = get_projects_dir()?;
    Ok(projects_dir.join(project_id))
}

/// Get a specific project's .project.md file path
#[allow(dead_code)]
pub fn get_project_file_path(project_id: &str) -> Result<PathBuf> {
    let project_dir = get_project_dir(project_id)?;
    Ok(project_dir.join(".metadata").join("project.json"))
}

/// Get a specific project's settings file path
#[allow(dead_code)]
pub fn get_project_settings_path(project_id: &str) -> Result<PathBuf> {
    let project_dir = get_project_dir(project_id)?;
    Ok(project_dir.join(".metadata").join("settings.json"))
}

/// Check if a project exists
#[allow(dead_code)]
pub fn project_exists(project_id: &str) -> Result<bool> {
    let project_file = get_project_file_path(project_id)?;
    Ok(project_file.exists())
}

/// List all project directories
#[allow(dead_code)]
pub fn list_project_dirs() -> Result<Vec<PathBuf>> {
    let projects_dir = get_projects_dir()?;

    if !projects_dir.exists() {
        return Ok(Vec::new());
    }

    let mut project_dirs = Vec::new();

    for entry in fs::read_dir(&projects_dir).context(format!(
        "Failed to read projects directory: {:?}",
        projects_dir
    ))? {
        let entry = entry?;
        let path = entry.path();

        if path.is_dir() {
            // Check if it has a .metadata/project.json file
            let project_file = path.join(".metadata").join("project.json");
            if project_file.exists() {
                project_dirs.push(path);
            }
        }
    }

    Ok(project_dirs)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_app_data_dir() {
        let result = get_app_data_dir();
        assert!(result.is_ok());

        let path = result.unwrap();
        let p = path.to_string_lossy();
        assert!(p.contains("productOS") || p.contains("ai-researcher"));
    }

    #[test]
    fn test_get_projects_dir() {
        // Set env var to ensure consistent test results regardless of CI environment
        std::env::set_var("PROJECTS_DIR", "/tmp/ai-test-projects");
        let result = get_projects_dir();
        assert!(result.is_ok());

        let path = result.unwrap();
        assert!(path.to_string_lossy().contains("ai-test-projects"));
        std::env::remove_var("PROJECTS_DIR");
    }

    #[test]
    fn test_get_skills_dir() {
        // Set env var to ensure consistent test results
        std::env::set_var("SKILLS_DIR", "/tmp/ai-test-skills");
        let result = get_skills_dir();
        assert!(result.is_ok());

        let path = result.unwrap();
        assert!(path.to_string_lossy().contains("ai-test-skills"));
        std::env::remove_var("SKILLS_DIR");
    }

    #[test]
    fn test_get_global_settings_path() {
        let result = get_global_settings_path();
        assert!(result.is_ok());

        let path = result.unwrap();
        assert!(path.to_string_lossy().contains("settings.json"));
    }
}
