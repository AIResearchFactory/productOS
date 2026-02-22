use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

use crate::directory;
use crate::installer::InstallationConfig;

/// Update result information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateResult {
    pub success: bool,
    pub backup_created: bool,
    pub backup_path: Option<PathBuf>,
    pub files_updated: Vec<String>,
    pub structure_verified: bool,
    pub message: String,
}

/// Update Manager
/// Handles app updates while preserving user data
pub struct UpdateManager {
    config: InstallationConfig,
}

impl UpdateManager {
    /// Create a new update manager with the given configuration
    pub fn new(config: InstallationConfig) -> Self {
        Self { config }
    }

    /// Create update manager with default app data path
    pub fn with_default_path() -> Result<Self> {
        let app_data_path = crate::utils::paths::get_app_data_dir()?;
        let config = InstallationConfig {
            app_data_path,
            is_first_install: false,
            claude_code_detected: false,
            ollama_detected: false,
            gemini_detected: false,
        };
        Ok(Self::new(config))
    }

    /// Check and preserve existing directory structure
    /// Creates missing folders/files without overwriting user data
    pub async fn check_and_preserve_structure(&self) -> Result<UpdateResult> {
        log::info!("Checking and preserving directory structure...");

        let mut files_updated = Vec::new();
        let base_path = &self.config.app_data_path;

        // Ensure base directory exists
        if !base_path.exists() {
            return Err(anyhow::anyhow!(
                "App data directory does not exist: {:?}",
                base_path
            ));
        }

        // Create any missing subdirectories
        let subdirs = vec![
            "projects",
            "skills",
            "templates",
            "backups",
            "logs",
        ];

        for subdir in subdirs {
            let dir_path = base_path.join(subdir);
            if !dir_path.exists() {
                fs::create_dir_all(&dir_path)
                    .context(format!("Failed to create directory: {:?}", dir_path))?;
                log::info!("Created missing directory: {:?}", dir_path);
                files_updated.push(format!("Created directory: {}", subdir));
            }
        }

        // Create or update template files (without overwriting user data)
        self.update_templates(&mut files_updated).await?;

        // Create README if it doesn't exist
        self.create_readme_if_missing(&mut files_updated).await?;

        // Verify structure integrity
        let structure_verified = directory::verify_directory_structure(base_path).await?;

        log::info!("Directory structure check completed");

        Ok(UpdateResult {
            success: true,
            backup_created: false,
            backup_path: None,
            files_updated,
            structure_verified,
            message: "Directory structure updated successfully".to_string(),
        })
    }

    /// Create a backup of user data before performing updates
    pub async fn backup_user_data(&self) -> Result<PathBuf> {
        log::info!("Creating backup of user data...");

        use chrono::Local;
        let timestamp = Local::now().format("%Y%m%d_%H%M%S");
        let backup_dir = self.config.app_data_path
            .join("backups")
            .join(format!("update_backup_{}", timestamp));

        // Create backup directory
        fs::create_dir_all(&backup_dir)
            .context(format!("Failed to create backup directory: {:?}", backup_dir))?;

        // Backup critical user data (DO NOT backup templates or default files)
        let items_to_backup = vec![
            ("projects", true),       // User's research projects
            ("skills", true),          // User's custom skills
            ("settings.json", false),   // User's settings
            ("secrets.encrypted.json", false), // User's encrypted secrets
            (".installation_state.json", false), // Installation state
        ];

        for (item, is_dir) in items_to_backup {
            let source = self.config.app_data_path.join(item);
            if source.exists() {
                let dest = backup_dir.join(item);

                if is_dir {
                    Self::copy_dir_all(&source, &dest)?;
                } else {
                    if let Some(parent) = dest.parent() {
                        fs::create_dir_all(parent)?;
                    }
                    fs::copy(&source, &dest)
                        .context(format!("Failed to backup {:?}", source))?;
                }

                log::info!("Backed up: {:?} -> {:?}", source, dest);
            }
        }

        log::info!("User data backup created at {:?}", backup_dir);
        Ok(backup_dir)
    }

    /// Restore data from a backup if needed (e.g., if update fails)
    pub async fn restore_if_needed(&self, backup_path: PathBuf) -> Result<()> {
        log::info!("Restoring data from backup: {:?}", backup_path);

        if !backup_path.exists() {
            return Err(anyhow::anyhow!("Backup path does not exist: {:?}", backup_path));
        }

        // Restore backed up items
        for entry in fs::read_dir(&backup_path)? {
            let entry = entry?;
            let item_name = entry.file_name();
            let source = entry.path();
            let dest = self.config.app_data_path.join(&item_name);

            if source.is_dir() {
                // Remove existing directory if it exists
                if dest.exists() {
                    fs::remove_dir_all(&dest)?;
                }
                Self::copy_dir_all(&source, &dest)?;
            } else {
                fs::copy(&source, &dest)
                    .context(format!("Failed to restore {:?}", source))?;
            }

            log::info!("Restored: {:?} -> {:?}", source, dest);
        }

        log::info!("Data restoration completed");
        Ok(())
    }

    /// Verify the integrity of the installation after an update
    pub async fn verify_integrity(&self) -> Result<bool> {
        log::info!("Verifying installation integrity...");

        let base_path = &self.config.app_data_path;

        // Check that base directory exists
        if !base_path.exists() {
            log::error!("Base directory does not exist");
            return Ok(false);
        }

        // Check required directories
        let required_dirs = vec!["projects", "skills", "templates", "backups", "logs"];
        for dir in required_dirs {
            let dir_path = base_path.join(dir);
            if !dir_path.exists() {
                log::error!("Required directory missing: {:?}", dir_path);
                return Ok(false);
            }
        }

        // Check critical files exist (but don't require content)
        let critical_files = vec![".installation_state.json"];
        for file in critical_files {
            let file_path = base_path.join(file);
            if !file_path.exists() {
                log::warn!("Critical file missing: {:?}", file_path);
                // Not a failure, just a warning
            }
        }

        // Verify directory structure using existing function
        let structure_ok = directory::verify_directory_structure(base_path).await?;
        if !structure_ok {
            log::error!("Directory structure verification failed");
            return Ok(false);
        }

        log::info!("Installation integrity verification passed");
        Ok(true)
    }

    /// Perform a complete update flow
    /// 1. Backup user data
    /// 2. Update structure and templates
    /// 3. Verify integrity
    /// 4. Clean up old backups
    pub async fn perform_update(&mut self) -> Result<UpdateResult> {
        log::info!("Starting update process...");

        // Step 1: Create backup of user data
        let backup_path = match self.backup_user_data().await {
            Ok(path) => {
                log::info!("Backup created successfully");
                Some(path)
            }
            Err(e) => {
                log::warn!("Failed to create backup: {}", e);
                None
            }
        };

        // Step 2: Update structure (this won't overwrite user data)
        let mut result = match self.check_and_preserve_structure().await {
            Ok(r) => r,
            Err(e) => {
                log::error!("Failed to update structure: {}", e);
                // If we have a backup and update failed, consider restoring
                if let Some(backup) = &backup_path {
                    log::info!("Update failed, backup available at: {:?}", backup);
                }
                return Err(e);
            }
        };

        // Step 3: Verify integrity
        let integrity_ok = self.verify_integrity().await?;
        result.structure_verified = integrity_ok;

        if !integrity_ok {
            log::error!("Integrity verification failed after update");
            result.success = false;
            result.message = "Update completed but integrity check failed".to_string();
            return Ok(result);
        }

        // Step 4: Clean up old backups (keep last 5)
        if let Err(e) = directory::cleanup_old_backups(&self.config.app_data_path, 5).await {
            log::warn!("Failed to cleanup old backups: {}", e);
        }

        // Update result with backup information
        result.backup_created = backup_path.is_some();
        result.backup_path = backup_path;
        result.message = "Update completed successfully".to_string();

        log::info!("Update process completed successfully");
        Ok(result)
    }

    /// Update template files (only add new templates, don't overwrite)
    async fn update_templates(&self, files_updated: &mut Vec<String>) -> Result<()> {
        let templates_dir = self.config.app_data_path.join("templates");
        fs::create_dir_all(&templates_dir)?;

        // Define all default templates
        let templates = vec![
            (
                "basic_project_template.md",
                r#"---
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

## Notes

Add your research notes here.
"#,
            ),
            (
                "basic_skill_template.md",
                r#"---
name: New Skill
category: general
description: A new custom skill
version: 1.0.0
author: ""
tags: []
---

# {skill_name}

## Description

Describe what this skill does.

## Prompt

Write the AI prompt for this skill here.

## Examples

### Example 1

Input: Example input
Expected Output: Example output

## Parameters

List any parameters this skill accepts.
"#,
            ),
            (
                "research_assistant_skill.md",
                r#"---
name: Research Assistant
category: research
description: Helps with academic research, literature reviews, and citation management
version: 1.0.0
author: productOS Team
tags: [research, academic, citations]
---

# Research Assistant Skill

## Description

This skill provides assistance with academic research tasks including:
- Literature reviews
- Citation management
- Research paper analysis
- Methodology suggestions

## Prompt

You are an experienced academic research assistant specializing in helping researchers with:

1. **Literature Reviews**: Finding relevant papers, summarizing key findings, identifying research gaps
2. **Citation Management**: Formatting citations in various styles (APA, MLA, Chicago, etc.)
3. **Paper Analysis**: Analyzing research papers for methodology, results, and conclusions
4. **Research Design**: Suggesting appropriate research methodologies and study designs

Always provide evidence-based suggestions and cite relevant sources when applicable.

## Examples

### Example 1 - Literature Review

Input: "I need to review recent papers on machine learning in healthcare"
Expected Output: A structured summary of recent papers with key findings, methodologies, and research gaps

### Example 2 - Citation Formatting

Input: "Format this citation in APA style: Smith, J. (2023). AI in Medicine. Medical Journal."
Expected Output: Properly formatted APA citation with corrections if needed
"#,
            ),
            (
                "code_reviewer_skill.md",
                r#"---
name: Code Reviewer
category: development
description: Reviews code for best practices, security issues, and optimization opportunities
version: 1.0.0
author: productOS Team
tags: [code, review, security, optimization]
---

# Code Reviewer Skill

## Description

This skill provides comprehensive code review focusing on:
- Code quality and best practices
- Security vulnerabilities
- Performance optimization
- Design patterns and architecture

## Prompt

You are an expert software engineer conducting code reviews. Your reviews should focus on:

1. **Code Quality**: Clean code principles, naming conventions, code organization
2. **Security**: Common vulnerabilities (OWASP Top 10), input validation, authentication
3. **Performance**: Algorithm efficiency, database queries, resource usage
4. **Best Practices**: Design patterns, SOLID principles, error handling
5. **Testing**: Test coverage, edge cases, test quality

Provide constructive feedback with specific examples and suggestions for improvement.

## Examples

### Example 1

Input: Code snippet with potential SQL injection
Expected Output: Identification of security issue, explanation of risk, and suggested fix

### Example 2

Input: Function with nested loops
Expected Output: Analysis of time complexity and suggestions for optimization
"#,
            ),
            (
                "data_analyst_skill.md",
                r#"---
name: Data Analyst
category: analysis
description: Analyzes datasets, creates visualizations, and provides insights
version: 1.0.0
author: productOS Team
tags: [data, analysis, visualization, statistics]
---

# Data Analyst Skill

## Description

This skill specializes in data analysis tasks including:
- Exploratory data analysis
- Statistical analysis
- Data visualization recommendations
- Insight generation

## Prompt

You are a professional data analyst with expertise in:

1. **Exploratory Data Analysis**: Understanding data distributions, identifying patterns and outliers
2. **Statistical Analysis**: Hypothesis testing, correlation analysis, regression
3. **Data Visualization**: Recommending appropriate charts and visualizations
4. **Insight Generation**: Extracting meaningful insights from data
5. **Data Quality**: Identifying data quality issues and suggesting cleaning strategies

Provide clear, actionable insights supported by statistical evidence.

## Examples

### Example 1

Input: Dataset with customer purchase data
Expected Output: Analysis of purchase patterns, customer segmentation recommendations, visualization suggestions

### Example 2

Input: Time series sales data
Expected Output: Trend analysis, seasonality detection, forecasting recommendations
"#,
            ),
        ];

        for (filename, content) in templates {
            let file_path = templates_dir.join(filename);
            if !file_path.exists() {
                fs::write(&file_path, content)
                    .context(format!("Failed to create template: {:?}", file_path))?;
                log::info!("Created new template: {:?}", file_path);
                files_updated.push(format!("Created template: {}", filename));
            } else {
                log::debug!("Template already exists, skipping: {:?}", file_path);
            }
        }

        Ok(())
    }

    /// Create README file if it doesn't exist
    async fn create_readme_if_missing(&self, files_updated: &mut Vec<String>) -> Result<()> {
        let readme_path = self.config.app_data_path.join("README.md");

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

## Updates

This application automatically preserves your user data during updates:
- Projects are never overwritten
- Custom skills are preserved
- Settings and secrets remain intact
- New templates are added without removing existing ones

## Need Help?

Visit the productOS documentation or open an issue on GitHub.
"#;
            fs::write(&readme_path, readme_content)
                .context(format!("Failed to create README file: {:?}", readme_path))?;
            log::info!("Created README file: {:?}", readme_path);
            files_updated.push("Created README.md".to_string());
        }

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
                Self::copy_dir_all(&src_path, &dst_path)?;
            } else {
                fs::copy(&src_path, &dst_path)?;
            }
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[tokio::test]
    async fn test_check_and_preserve_structure() {
        let temp_dir = TempDir::new().unwrap();
        let base_path = temp_dir.path().to_path_buf();

        // Create base structure
        fs::create_dir_all(&base_path).unwrap();
        fs::create_dir_all(base_path.join("projects")).unwrap();
        fs::create_dir_all(base_path.join("skills")).unwrap();

        let config = InstallationConfig {
            app_data_path: base_path.clone(),
            is_first_install: false,
            claude_code_detected: false,
            ollama_detected: false,
            gemini_detected: false,
        };

        let manager = UpdateManager::new(config);
        let result = manager.check_and_preserve_structure().await.unwrap();

        assert!(result.success);
        assert!(base_path.join("templates").exists());
        assert!(base_path.join("backups").exists());
        assert!(base_path.join("logs").exists());
    }

    #[tokio::test]
    async fn test_backup_user_data() {
        let temp_dir = TempDir::new().unwrap();
        let base_path = temp_dir.path().to_path_buf();

        // Create structure with user data
        fs::create_dir_all(base_path.join("projects")).unwrap();
        fs::create_dir_all(base_path.join("skills")).unwrap();
        fs::write(base_path.join("projects/test.md"), "test content").unwrap();
        fs::write(base_path.join("settings.json"), "settings").unwrap();

        let config = InstallationConfig {
            app_data_path: base_path.clone(),
            is_first_install: false,
            claude_code_detected: false,
            ollama_detected: false,
            gemini_detected: false,
        };

        let manager = UpdateManager::new(config);
        let backup_path = manager.backup_user_data().await.unwrap();

        assert!(backup_path.exists());
        assert!(backup_path.join("projects/test.md").exists());
        assert!(backup_path.join("settings.json").exists());
    }

    #[tokio::test]
    async fn test_verify_integrity() {
        let temp_dir = TempDir::new().unwrap();
        let base_path = temp_dir.path().to_path_buf();

        // Create complete structure
        directory::create_directory_structure(&base_path).await.unwrap();

        let config = InstallationConfig {
            app_data_path: base_path.clone(),
            is_first_install: false,
            claude_code_detected: false,
            ollama_detected: false,
            gemini_detected: false,
        };

        let manager = UpdateManager::new(config);
        let integrity_ok = manager.verify_integrity().await.unwrap();

        assert!(integrity_ok);
    }

    #[tokio::test]
    async fn test_update_templates_preserves_existing() {
        let temp_dir = TempDir::new().unwrap();
        let base_path = temp_dir.path().to_path_buf();

        fs::create_dir_all(base_path.join("templates")).unwrap();

        // Create a custom template
        let custom_template = base_path.join("templates/my_custom_template.md");
        fs::write(&custom_template, "my custom content").unwrap();

        let config = InstallationConfig {
            app_data_path: base_path.clone(),
            is_first_install: false,
            claude_code_detected: false,
            ollama_detected: false,
            gemini_detected: false,
        };

        let manager = UpdateManager::new(config);
        let mut files_updated = Vec::new();
        manager.update_templates(&mut files_updated).await.unwrap();

        // Custom template should still exist with original content
        let content = fs::read_to_string(&custom_template).unwrap();
        assert_eq!(content, "my custom content");

        // Default templates should be created
        assert!(base_path.join("templates/basic_project_template.md").exists());
        assert!(base_path.join("templates/basic_skill_template.md").exists());
    }
}
