//! Skill Service - Manages skill files in the application
//!
//! This service provides functionality for:
//! - Discovering and loading skills from the skills directory
//! - Creating new skills with templates
//! - Saving and validating skills
//! - Filtering skills by category
//! - Managing skill lifecycle (create, read, update, delete)
//!
//! Task 3.6 Implementation: Skills Service
//! All skills are stored as markdown files in {APP_DATA}/skills/

use crate::models::skill::{Skill, SkillError};
use crate::services::settings_service::SettingsService;
use crate::services::pm_skills;
use anyhow::Result;
use std::fs;
use walkdir::WalkDir;

pub struct SkillService;

impl SkillService {
    /// Scan skills directory and load all .md files (max depth 1)
    /// Skip files starting with .
    /// Parse each using Skill::from_markdown_file()
    /// Return list of all valid skills
    pub fn discover_skills() -> Result<Vec<Skill>, SkillError> {
        let skills_dir = SettingsService::get_skills_path().map_err(|e| {
            SkillError::ReadError(std::io::Error::other(format!(
                "Failed to get skills directory: {}",
                e
            )))
        })?;

        // Ensure skills directory exists
        if !skills_dir.exists() {
            fs::create_dir_all(&skills_dir)?;
        }

        // Seed PM skills if they don't exist
        if let Err(e) = Self::seed_pm_skills() {
            log::error!("Failed to seed PM skills: {}", e);
        }

        let mut skills = Vec::new();

        // Use WalkDir with max_depth(1) to scan only the immediate directory
        for entry in WalkDir::new(&skills_dir)
            .max_depth(1)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            let path = entry.path();

            // Skip if it's a directory
            if !path.is_file() {
                continue;
            }

            // Skip files starting with .
            if let Some(file_name) = path.file_name().and_then(|n| n.to_str()) {
                if file_name.starts_with('.') || file_name == "template.md" {
                    continue;
                }
            }

            // Only process .md files
            if path.extension().and_then(|s| s.to_str()) != Some("md") {
                continue;
            }

            // Try to parse the skill
            match Skill::from_markdown_file(&path.to_path_buf()) {
                Ok(skill) => skills.push(skill),
                Err(e) => {
                    eprintln!("Warning: Failed to load skill at {:?}: {}", path, e);
                    continue;
                }
            }
        }

        // SEED DEFAULT SKILL IF EMPTY
        if skills.is_empty() {
            let default_skill = Self::create_skill_template(
                "research-specialist".to_string(),
                "Research Specialist".to_string(),
                "A versatile AI assistant capable of conducting research, analyzing topics, and synthesizing information.".to_string(),
                vec!["research".to_string(), "analysis".to_string(), "synthesis".to_string()],
            );

            // Save it so it persists
            if let Err(e) = Self::save_skill(&default_skill) {
                eprintln!("Failed to seed default skill: {}", e);
            } else {
                skills.push(default_skill);
            }
        }

        // Sort by name for consistent ordering
        skills.sort_by(|a, b| a.name.cmp(&b.name));

        Ok(skills)
    }

    /// Load a specific skill by ID
    /// Construct path: {skills_dir}/{skill_id}.md
    /// Check if file exists
    /// Parse and return skill
    /// Return error if not found
    pub fn load_skill(skill_id: &str) -> Result<Skill, SkillError> {
        let skills_dir = SettingsService::get_skills_path().map_err(|e| {
            SkillError::ReadError(std::io::Error::other(format!(
                "Failed to get skills directory: {}",
                e
            )))
        })?;

        let skill_path = skills_dir.join(format!("{}.md", skill_id));

        if !skill_path.exists() {
            return Err(SkillError::InvalidStructure(format!(
                "Skill not found: {}",
                skill_id
            )));
        }

        Skill::from_markdown_file(&skill_path)
    }

    /// Save a skill to disk
    /// Validate skill using skill.validate()
    /// Convert to markdown using skill.to_markdown()
    /// Write to {skills_dir}/{skill.id}.md
    pub fn save_skill(skill: &Skill) -> Result<(), SkillError> {
        // Validate skill first
        skill
            .validate()
            .map_err(|errors| SkillError::ValidationError(errors))?;

        let skills_dir = SettingsService::get_skills_path().map_err(|e| {
            SkillError::ReadError(std::io::Error::other(format!(
                "Failed to get skills directory: {}",
                e
            )))
        })?;

        // Ensure skills directory exists
        if !skills_dir.exists() {
            fs::create_dir_all(&skills_dir)?;
        }

        let skill_path = skills_dir.join(format!("{}.md", skill.id));
        skill.save(&skill_path)?;

        Ok(())
    }

    /// Delete a skill by ID
    /// Check if file exists
    /// Delete the file
    /// Return error if not found
    pub fn delete_skill(skill_id: &str) -> Result<(), SkillError> {
        let skills_dir = SettingsService::get_skills_path().map_err(|e| {
            SkillError::ReadError(std::io::Error::other(format!(
                "Failed to get skills directory: {}",
                e
            )))
        })?;

        let skill_path = skills_dir.join(format!("{}.md", skill_id));

        if !skill_path.exists() {
            return Err(SkillError::InvalidStructure(format!(
                "Skill not found: {}",
                skill_id
            )));
        }

        fs::remove_file(&skill_path)?;

        // Also remove sidecar if it exists
        let sidecar_path = skills_dir
            .join(".metadata")
            .join(format!("{}.json", skill_id));
        if sidecar_path.exists() {
            fs::remove_file(sidecar_path).ok();
        }

        Ok(())
    }

    /// Get skills filtered by category
    /// Note: SkillCategory is not currently defined in the Skill model.
    /// This method is provided for future compatibility when categories are added.
    /// Currently, this filters by checking if the category string appears in capabilities.
    pub fn get_skills_by_category(category: &str) -> Result<Vec<Skill>, SkillError> {
        let all_skills = Self::discover_skills()?;

        let filtered_skills: Vec<Skill> = all_skills
            .into_iter()
            .filter(|skill| {
                // Check if the category appears in capabilities
                skill
                    .capabilities
                    .iter()
                    .any(|cap| cap.to_lowercase().contains(&category.to_lowercase()))
            })
            .collect();

        Ok(filtered_skills)
    }

    /// Create a skill template with default values
    /// Generate a new Skill with default values
    /// Use provided id, name, description, category
    /// Set default prompt template
    /// Return the Skill (don't save yet)
    pub fn create_skill_template(
        id: String,
        name: String,
        description: String,
        capabilities: Vec<String>,
    ) -> Skill {
        let now = chrono::Utc::now().to_rfc3339();

        Skill {
            id: id.clone(),
            name,
            description,
            capabilities,
            prompt_template: format!(
                "You are an AI assistant with the following skill: {}\n\nPlease help the user with their request.",
                id
            ),
            examples: vec![],
            parameters: vec![],
            version: "1.0.0".to_string(),
            created: now.clone(),
            updated: now,
            file_path: std::path::PathBuf::from(format!("{}.md", id)),
        }
    }

    // ===== Backward Compatibility Methods =====
    // These methods maintain backward compatibility with existing commands

    /// Alias for discover_skills() - for backward compatibility
    pub fn get_all_skills() -> Result<Vec<Skill>, SkillError> {
        Self::discover_skills()
    }

    /// Alias for load_skill() - for backward compatibility
    pub fn get_skill(skill_id: &str) -> Result<Skill, SkillError> {
        Self::load_skill(skill_id)
    }

    /// Create a new skill and save it immediately
    /// This is a convenience method that combines create_skill_template and save_skill
    pub fn create_skill(
        name: &str,
        description: &str,
        prompt_template: &str,
        capabilities: Vec<String>,
    ) -> Result<Skill, SkillError> {
        // Generate skill ID from name
        let skill_id = name
            .to_lowercase()
            .replace(' ', "-")
            .chars()
            .filter(|c| c.is_alphanumeric() || *c == '-' || *c == '_')
            .collect::<String>();

        // Check if skill already exists
        // Check if skill already exists
        let skills_dir = SettingsService::get_skills_path().map_err(|e| {
            SkillError::ReadError(std::io::Error::other(format!(
                "Failed to get skills directory: {}",
                e
            )))
        })?;

        let skill_path = skills_dir.join(format!("{}.md", skill_id));
        if skill_path.exists() {
            return Err(SkillError::InvalidStructure(format!(
                "Skill already exists: {}",
                skill_id
            )));
        }

        // Try to load template from template.md or use default
        let template_path = skills_dir.join("template.md");
        let mut skill = if template_path.exists() {
            match Skill::from_markdown_file(&template_path) {
                Ok(mut template_skill) => {
                    template_skill.id = skill_id.clone();
                    template_skill.name = name.to_string();
                    template_skill.description = description.to_string();
                    template_skill.capabilities = capabilities;
                    template_skill.created = chrono::Utc::now().to_rfc3339();
                    template_skill.updated = template_skill.created.clone();
                    template_skill.file_path = std::path::PathBuf::from(format!("{}.md", skill_id));
                    template_skill.version = "1.0.0".to_string();
                    // Keep the prompt template from the file unless overridden below
                    template_skill
                }
                Err(e) => {
                    log::warn!("Failed to load template.md: {}", e);
                    Self::create_skill_template(
                        skill_id,
                        name.to_string(),
                        description.to_string(),
                        capabilities,
                    )
                }
            }
        } else {
            Self::create_skill_template(
                skill_id,
                name.to_string(),
                description.to_string(),
                capabilities,
            )
        };

        // Override the prompt template if provided
        if !prompt_template.is_empty() {
            skill.prompt_template = prompt_template.to_string();
        }

        // Save the skill
        Self::save_skill(&skill)?;

        Ok(skill)
    }

    /// Update an existing skill - for backward compatibility
    pub fn update_skill(skill: &Skill) -> Result<(), SkillError> {
        // Update the updated timestamp
        let mut updated_skill = skill.clone();
        updated_skill.updated = chrono::Utc::now().to_rfc3339();

        // Save the skill (save_skill handles directory creation and writing)
        Self::save_skill(&updated_skill)
    }

    /// Seed PM skills from hardcoded definitions
    pub fn seed_pm_skills() -> Result<(), SkillError> {
        let skills_dir = SettingsService::get_skills_path().map_err(|e| {
            SkillError::ReadError(std::io::Error::other(format!(
                "Failed to get skills directory: {}",
                e
            )))
        })?;

        for (id, markdown) in pm_skills::get_pm_skills_definitions() {
            let skill_path = skills_dir.join(format!("{}.md", id));
            if !skill_path.exists() {
                log::info!("Seeding PM skill: {}", id);
                fs::write(&skill_path, markdown).map_err(|e| {
                    SkillError::WriteError(format!("Failed to write PM skill {}: {}", id, e))
                })?;
                
                // Trigger an initial load which will auto-create the sidecar
                if let Err(e) = Skill::from_markdown_file(&skill_path) {
                    log::warn!("Failed to auto-create sidecar for seeded skill {}: {}", id, e);
                }
            }
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;

    #[test]
    fn test_create_skill_template() {
        let skill = SkillService::create_skill_template(
            "test-skill".to_string(),
            "Test Skill".to_string(),
            "A test skill for testing".to_string(),
            vec!["testing".to_string(), "automation".to_string()],
        );

        assert_eq!(skill.id, "test-skill");
        assert_eq!(skill.name, "Test Skill");
        assert_eq!(skill.description, "A test skill for testing");
        assert_eq!(skill.capabilities.len(), 2);
        assert!(!skill.prompt_template.is_empty());
        assert_eq!(skill.version, "1.0.0");
    }

    #[test]
    fn test_save_and_load_skill() {
        // Create a temporary skills directory
        let temp_dir = env::temp_dir().join("ai-researcher-test-skills");
        if temp_dir.exists() {
            fs::remove_dir_all(&temp_dir).ok();
        }
        fs::create_dir_all(&temp_dir).unwrap();

        // Create a test skill
        let mut skill = SkillService::create_skill_template(
            "test-save-load".to_string(),
            "Test Save Load".to_string(),
            "Testing save and load".to_string(),
            vec!["testing".to_string()],
        );

        // Update file_path to use temp directory
        skill.file_path = temp_dir.join("test-save-load.md");

        // Write the skill (handles both MD and JSON sidecar)
        skill.save(&skill.file_path).unwrap();

        // Load and verify
        let loaded_skill = Skill::from_markdown_file(&skill.file_path).unwrap();
        assert_eq!(loaded_skill.id, skill.id);
        assert_eq!(loaded_skill.name, skill.name);
        assert_eq!(loaded_skill.description, skill.description);

        // Cleanup
        fs::remove_dir_all(&temp_dir).ok();
    }

    #[test]
    fn test_validate_skill() {
        let mut skill = SkillService::create_skill_template(
            "test-validate".to_string(),
            "Test Validate".to_string(),
            "Testing validation".to_string(),
            vec!["testing".to_string()],
        );

        // Should be valid
        assert!(skill.validate().is_ok());

        // Make it invalid
        skill.id = "invalid id with spaces!".to_string();
        assert!(skill.validate().is_err());
    }

    #[test]
    fn test_get_skills_by_category() {
        // This test would require setting up test skills
        // For now, we just verify the method exists and returns a result
        let result = SkillService::get_skills_by_category("research");
        assert!(result.is_ok());
    }

    #[test]
    fn test_skills_directory_auto_discovery() {
        // Create a temporary skills directory with multiple skill files
        let temp_dir = env::temp_dir().join("ai-researcher-test-discovery");
        if temp_dir.exists() {
            fs::remove_dir_all(&temp_dir).ok();
        }
        fs::create_dir_all(&temp_dir).unwrap();

        // Create multiple test skills
        let skill1 = SkillService::create_skill_template(
            "skill-alpha".to_string(),
            "Skill Alpha".to_string(),
            "First skill".to_string(),
            vec!["research".to_string()],
        );
        let skill2 = SkillService::create_skill_template(
            "skill-beta".to_string(),
            "Skill Beta".to_string(),
            "Second skill".to_string(),
            vec!["analysis".to_string()],
        );

        // Save skills to temp directory
        skill1.save(temp_dir.join("skill-alpha.md")).unwrap();
        skill2.save(temp_dir.join("skill-beta.md")).unwrap();

        // Create a file that should be skipped (starts with .)
        fs::write(temp_dir.join(".hidden-skill.md"), "should be skipped").unwrap();

        // Create a non-markdown file that should be skipped
        fs::write(temp_dir.join("readme.txt"), "not a skill").unwrap();

        // Use walkdir to discover skills manually (simulating discover_skills behavior)
        let mut discovered = Vec::new();
        for entry in WalkDir::new(&temp_dir)
            .max_depth(1)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            let path = entry.path();
            if !path.is_file() {
                continue;
            }
            if let Some(file_name) = path.file_name().and_then(|n| n.to_str()) {
                if file_name.starts_with('.') {
                    continue;
                }
            }
            if path.extension().and_then(|s| s.to_str()) != Some("md") {
                continue;
            }
            if let Ok(skill) = Skill::from_markdown_file(&path.to_path_buf()) {
                discovered.push(skill);
            }
        }

        // Should discover exactly 2 skills (not the hidden or txt file)
        assert_eq!(discovered.len(), 2);

        // Verify discovered skills
        let skill_ids: Vec<String> = discovered.iter().map(|s| s.id.clone()).collect();
        assert!(skill_ids.contains(&"skill-alpha".to_string()));
        assert!(skill_ids.contains(&"skill-beta".to_string()));

        // Cleanup
        fs::remove_dir_all(&temp_dir).ok();
    }

    #[test]
    fn test_skill_prompt_rendering_with_parameters() {
        use crate::models::skill::SkillParameter;
        use std::collections::HashMap;

        let mut skill = SkillService::create_skill_template(
            "test-params".to_string(),
            "Test Parameters".to_string(),
            "Testing parameter substitution".to_string(),
            vec!["testing".to_string()],
        );

        // Set up a prompt with parameters
        skill.prompt_template =
            "Hello {{name}}, your task is to {{task}}. Use language: {{language}}".to_string();
        skill.parameters = vec![
            SkillParameter {
                name: "name".to_string(),
                param_type: "string".to_string(),
                description: "User's name".to_string(),
                required: true,
                default_value: None,
            },
            SkillParameter {
                name: "task".to_string(),
                param_type: "string".to_string(),
                description: "Task to perform".to_string(),
                required: true,
                default_value: None,
            },
            SkillParameter {
                name: "language".to_string(),
                param_type: "string".to_string(),
                description: "Programming language".to_string(),
                required: false,
                default_value: Some("Python".to_string()),
            },
        ];

        // Test with all parameters provided
        let mut params1 = HashMap::new();
        params1.insert("name".to_string(), "Alice".to_string());
        params1.insert("task".to_string(), "write a function".to_string());
        params1.insert("language".to_string(), "Rust".to_string());

        let rendered = skill.render_prompt(params1).unwrap();
        assert_eq!(
            rendered,
            "Hello Alice, your task is to write a function. Use language: Rust"
        );

        // Test with default value
        let mut params2 = HashMap::new();
        params2.insert("name".to_string(), "Bob".to_string());
        params2.insert("task".to_string(), "debug code".to_string());
        // language not provided, should use default

        let rendered = skill.render_prompt(params2).unwrap();
        assert_eq!(
            rendered,
            "Hello Bob, your task is to debug code. Use language: Python"
        );
    }

    #[test]
    fn test_skill_validation_with_invalid_characters() {
        let mut skill = SkillService::create_skill_template(
            "valid-id".to_string(),
            "Valid Skill".to_string(),
            "Valid skill".to_string(),
            vec!["testing".to_string()],
        );

        // Valid ID should pass
        assert!(skill.validate().is_ok());

        // Test various invalid characters
        skill.id = "invalid spaces".to_string();
        assert!(skill.validate().is_err());

        skill.id = "invalid@symbol".to_string();
        assert!(skill.validate().is_err());

        skill.id = "invalid!exclaim".to_string();
        assert!(skill.validate().is_err());

        skill.id = "invalid/slash".to_string();
        assert!(skill.validate().is_err());

        // Valid characters should pass
        skill.id = "valid-id-123".to_string();
        assert!(skill.validate().is_ok());

        skill.id = "valid_id_456".to_string();
        assert!(skill.validate().is_ok());
    }
}
