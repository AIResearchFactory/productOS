use anyhow::{Context, Result};
use std::fs;
use std::path::Path;

/// Create the complete directory structure for the application
pub async fn create_directory_structure(base_path: &Path) -> Result<()> {
    log::info!("Creating directory structure at {:?}", base_path);

    // Create main app data directory
    if !base_path.exists() {
        fs::create_dir_all(base_path)
            .context(format!("Failed to create base directory: {:?}", base_path))?;
        log::info!("Created base directory: {:?}", base_path);
    }

    // Create subdirectories
    let subdirs = vec!["projects", "skills", "templates", "backups", "logs"];

    for subdir in subdirs {
        let dir_path = base_path.join(subdir);
        if !dir_path.exists() {
            fs::create_dir_all(&dir_path)
                .context(format!("Failed to create directory: {:?}", dir_path))?;
            log::info!("Created directory: {:?}", dir_path);
        }
    }

    log::info!("Directory structure created successfully");
    Ok(())
}

/// Verify that the directory structure is intact and complete
pub async fn verify_directory_structure(base_path: &Path) -> Result<bool> {
    log::info!("Verifying directory structure at {:?}", base_path);

    // Check if base path exists
    if !base_path.exists() {
        log::warn!("Base directory does not exist: {:?}", base_path);
        return Ok(false);
    }

    // Check required subdirectories
    let required_subdirs = vec!["projects", "skills"];

    for subdir in required_subdirs {
        let dir_path = base_path.join(subdir);
        if !dir_path.exists() {
            log::warn!("Required directory missing: {:?}", dir_path);
            return Ok(false);
        }
    }

    log::info!("Directory structure verification passed");
    Ok(true)
}

/// Create default template files for new installations
pub async fn create_default_files(base_path: &Path) -> Result<()> {
    log::info!("Creating default files at {:?}", base_path);

    // Create default global settings file
    let settings_path = base_path.join("settings.json");
    if !settings_path.exists() {
        let default_settings = r#"{
  "theme": "light",
  "defaultModel": "gemini-2.0-flash",
  "notificationsEnabled": true,
  "activeProvider": "geminiCli"
}"#;
        fs::write(&settings_path, default_settings).context(format!(
            "Failed to create settings file: {:?}",
            settings_path
        ))?;
        log::info!("Created default settings file: {:?}", settings_path);
    }

    // Create default skill templates
    create_skill_templates(base_path).await?;

    // Create README file
    let readme_path = base_path.join("README.md");
    if !readme_path.exists() {
        let readme_content = r#"# productOS Application Data

This directory contains all the data for your productOS application.

## Directory Structure

- **projects/**: Contains all your research projects
- **skills/**: Contains custom skills for the AI agent
- **templates/**: Contains project and skill templates
- **backups/**: Automatic backups of your data
- **logs/**: Application log files

## Files

- **settings.json**: Global application settings
- **secrets.encrypted.json**: Encrypted secrets and API keys
- **.installation_state.json**: Installation configuration

## Backup Your Data

It's recommended to regularly backup the entire contents of this directory,
especially the projects/ and skills/ folders.

## Need Help?

Visit the productOS documentation or open an issue on GitHub.
"#;
        fs::write(&readme_path, readme_content)
            .context(format!("Failed to create README file: {:?}", readme_path))?;
        log::info!("Created README file: {:?}", readme_path);
    }

    log::info!("Default files created successfully");
    Ok(())
}

/// Create default skill templates
async fn create_skill_templates(base_path: &Path) -> Result<()> {
    let templates_dir = base_path.join("templates");
    fs::create_dir_all(&templates_dir).context(format!(
        "Failed to create templates directory: {:?}",
        templates_dir
    ))?;

    // Create a basic project template
    let project_template_path = templates_dir.join("basic_project_template.md");
    if !project_template_path.exists() {
        let project_template = r#"---
name: New Project
description: A new research project
created_at: ""
updated_at: ""
tags: []
---

# {project_name}

## Overview

Describe your research project here.

## Goals

- Goal 1
- Goal 2
- Goal 3

## Scope

Define the scope of the project.

## Constraints

List any project constraints.

## Notes

Add your research notes here.
"#;
        fs::write(&project_template_path, project_template).context(format!(
            "Failed to create project template: {:?}",
            project_template_path
        ))?;
        log::info!("Created project template: {:?}", project_template_path);
    }

    // Create a basic skill template
    let skill_template_path = templates_dir.join("basic_skill_template.md");
    if !skill_template_path.exists() {
        let skill_template = r#"---
name: New Skill
category: general
description: A new custom skill
version: 1.0.0
author: ""
tags: []
---

# {skill_name}

## Role

Define the role this skill plays (e.g., "You are a Python expert...").

## Tasks

List the specific tasks this skill can perform:
- Task 1
- Task 2

## Output

Describe the expected output format and structure.

## Examples

### Example 1

Input: Example input
Expected Output: Example output

## Parameters

List any parameters this skill accepts.
"#;
        fs::write(&skill_template_path, skill_template).context(format!(
            "Failed to create skill template: {:?}",
            skill_template_path
        ))?;
        log::info!("Created skill template: {:?}", skill_template_path);
    }

    Ok(())
}

/// Check if this is a first-time installation
pub fn is_first_install(base_path: &Path) -> bool {
    // 1. Check for either settings.json or config.json since both indicate a completed installation
    // We check in the provided base_path (which is the default app data dir)
    if base_path.join("settings.json").exists() || base_path.join("config.json").exists() {
        log::info!("is_first_install: settings.json or config.json found in base_path");
        return false;
    }

    // 2. Check if we have a custom projects path in settings.json (even if in different location than base_path)
    // Actually, crate::utils::paths::get_projects_dir() reads from settings.json and handles environment overrides
    if let Ok(projects_dir) = crate::utils::paths::get_projects_dir() {
        if projects_dir.exists() && projects_dir.is_dir() {
             if let Ok(entries) = fs::read_dir(&projects_dir) {
                // Check if any subdirectory contains a .metadata/project.json file
                if entries.filter_map(|e| e.ok()).any(|e| {
                    let p = e.path();
                    p.is_dir() && p.join(".metadata").join("project.json").exists()
                }) {
                    log::info!("is_first_install: existing projects with metadata found in {:?}", projects_dir);
                    return false;
                }
            }
        }
    }

    // 3. Fallback: if base_path doesn't exist AND we didn't find projects elsewhere, it's definitely first install
    if !base_path.exists() {
        log::info!("is_first_install: base_path does not exist and no projects found");
        return true;
    }

    // 4. If we reach here, and settings.json is missing, but base_path exists, 
    // it's likely a fresh install or a corrupted one.
    log::info!("is_first_install: Returning true (no settings found)");
    true
}

/// Backup the current directory structure (useful before updates)
pub async fn backup_directory(base_path: &Path) -> Result<()> {
    use chrono::Local;

    let timestamp = Local::now().format("%Y%m%d_%H%M%S");
    let backup_dir = base_path
        .join("backups")
        .join(format!("backup_{}", timestamp));

    log::info!("Creating backup at {:?}", backup_dir);

    // Create backup directory
    fs::create_dir_all(&backup_dir).context(format!(
        "Failed to create backup directory: {:?}",
        backup_dir
    ))?;

    // Backup critical directories and files
    let items_to_backup = vec![
        "projects",
        "skills",
        "settings.json",
        "secrets.encrypted.json",
        ".installation_state.json",
    ];

    for item in items_to_backup {
        let source = base_path.join(item);
        if source.exists() {
            let dest = backup_dir.join(item);

            if source.is_dir() {
                copy_dir_all(&source, &dest)?;
            } else {
                if let Some(parent) = dest.parent() {
                    fs::create_dir_all(parent)?;
                }
                fs::copy(&source, &dest).context(format!("Failed to backup {:?}", source))?;
            }

            log::info!("Backed up: {:?} -> {:?}", source, dest);
        }
    }

    log::info!("Backup created successfully at {:?}", backup_dir);
    Ok(())
}

/// Helper function to recursively copy directories
fn copy_dir_all(src: &Path, dst: &Path) -> Result<()> {
    fs::create_dir_all(dst)?;

    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let ty = entry.file_type()?;
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());

        if ty.is_dir() {
            copy_dir_all(&src_path, &dst_path)?;
        } else {
            fs::copy(&src_path, &dst_path)?;
        }
    }

    Ok(())
}

/// Clean up old backups (keep only the last N backups)
pub async fn cleanup_old_backups(base_path: &Path, keep_count: usize) -> Result<()> {
    let backups_dir = base_path.join("backups");

    if !backups_dir.exists() {
        return Ok(());
    }

    let mut backups: Vec<_> = fs::read_dir(&backups_dir)?
        .filter_map(|entry| entry.ok())
        .filter(|entry| {
            entry.file_type().map(|ft| ft.is_dir()).unwrap_or(false)
                && entry.file_name().to_string_lossy().starts_with("backup_")
        })
        .collect();

    // Sort by modification time (oldest first)
    backups.sort_by_key(|entry| {
        entry
            .metadata()
            .and_then(|m| m.modified())
            .unwrap_or(std::time::SystemTime::UNIX_EPOCH)
    });

    // Remove old backups
    if backups.len() > keep_count {
        let to_remove = backups.len() - keep_count;
        for backup in backups.iter().take(to_remove) {
            let path = backup.path();
            fs::remove_dir_all(&path)
                .context(format!("Failed to remove old backup: {:?}", path))?;
            log::info!("Removed old backup: {:?}", path);
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[tokio::test]
    async fn test_create_directory_structure() {
        let temp_dir = TempDir::new().unwrap();
        let base_path = temp_dir.path();

        create_directory_structure(base_path).await.unwrap();

        assert!(base_path.join("projects").exists());
        assert!(base_path.join("skills").exists());
        assert!(base_path.join("templates").exists());
        assert!(base_path.join("backups").exists());
    }

    #[tokio::test]
    async fn test_verify_directory_structure() {
        let temp_dir = TempDir::new().unwrap();
        let base_path = temp_dir.path();

        // Should fail before creation
        let result = verify_directory_structure(base_path).await.unwrap();
        assert!(!result);

        // Create structure
        create_directory_structure(base_path).await.unwrap();

        // Should pass after creation
        let result = verify_directory_structure(base_path).await.unwrap();
        assert!(result);
    }

    #[tokio::test]
    async fn test_create_default_files() {
        let temp_dir = TempDir::new().unwrap();
        let base_path = temp_dir.path();

        create_directory_structure(base_path).await.unwrap();
        create_default_files(base_path).await.unwrap();

        assert!(base_path.join("settings.json").exists());
        assert!(base_path.join("README.md").exists());
        assert!(base_path
            .join("templates")
            .join("basic_project_template.md")
            .exists());
        assert!(base_path
            .join("templates")
            .join("basic_skill_template.md")
            .exists());
    }

    #[test]
    fn test_is_first_install() {
        let temp_dir = TempDir::new().unwrap();
        let base_path = temp_dir.path();

        assert!(is_first_install(base_path));

        // Create the directory and settings file
        fs::create_dir_all(base_path).unwrap();
        fs::write(base_path.join("settings.json"), "test").unwrap();

        assert!(!is_first_install(base_path));
    }

    #[tokio::test]
    async fn test_backup_directory() {
        let temp_dir = TempDir::new().unwrap();
        let base_path = temp_dir.path();

        create_directory_structure(base_path).await.unwrap();
        create_default_files(base_path).await.unwrap();

        // Create a test file
        fs::write(base_path.join("projects").join("test.txt"), "test content").unwrap();

        backup_directory(base_path).await.unwrap();

        // Check that backup was created
        let backups_dir = base_path.join("backups");
        assert!(backups_dir.exists());

        let backup_count = fs::read_dir(&backups_dir).unwrap().count();
        assert_eq!(backup_count, 1);
    }
}
