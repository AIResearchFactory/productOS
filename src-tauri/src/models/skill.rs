use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum SkillError {
    #[error("Failed to read skill file: {0}")]
    ReadError(#[from] std::io::Error),

    #[error("Failed to parse skill: {0}")]
    ParseError(String),

    #[error("Invalid skill structure: {0}")]
    InvalidStructure(String),

    #[error("Validation failed")]
    ValidationError(Vec<String>),

    #[error("Template rendering error: {0}")]
    RenderError(String),
}

/// Skill category enumeration
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum SkillCategory {
    Research,
    Development,
    Writing,
    Analysis,
    Other,
}

/// Represents a comprehensive skill/prompt template with full metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Skill {
    pub id: String,
    pub name: String,
    pub description: String,
    pub capabilities: Vec<String>,
    pub prompt_template: String,
    pub examples: Vec<SkillExample>,
    pub parameters: Vec<SkillParameter>,
    pub version: String,
    pub created: String,
    pub updated: String,
    pub file_path: PathBuf,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillExample {
    pub title: String,
    pub input: String,
    pub expected_output: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillParameter {
    pub name: String,
    #[serde(rename = "type")]
    pub param_type: String, // "string", "number", "boolean", "array"
    pub description: String,
    pub required: bool,
    pub default_value: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillMetadata {
    pub skill_id: String,
    pub name: String,
    pub description: String,
    pub capabilities: Vec<String>,
    pub version: String,
    pub created: String,
    pub updated: String,
}

impl Skill {
    /// Parse skill from markdown file
    pub fn from_markdown_file(path: &PathBuf) -> Result<Self, SkillError> {
        // 1. Determine sidecar path
        let file_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
        let skill_id = file_name.strip_suffix(".md").unwrap_or(file_name);
        let sidecar_dir = path.parent().unwrap_or(Path::new(".")).join(".metadata");
        let sidecar_path = sidecar_dir.join(format!("{}.json", skill_id));

        // 2. Load Metadata — auto-create sidecar if missing
        if !sidecar_path.exists() {
            // Read the markdown body to extract what we can
            let body = fs::read_to_string(path)?;
            let (prompt_template, examples, parameters) = Self::parse_body(&body)?;

            // Extract name from first heading or filename
            let name = body.lines()
                .find(|l| l.starts_with("# "))
                .map(|l| l.trim_start_matches("# ").trim().to_string())
                .unwrap_or_else(|| skill_id.replace('-', " ").replace('_', " "));

            // Extract description from Overview section or first paragraph
            let description = body.lines()
                .skip_while(|l| !l.starts_with("## Overview"))
                .skip(1)
                .take_while(|l| !l.starts_with("## "))
                .filter(|l| !l.trim().is_empty())
                .collect::<Vec<_>>()
                .join(" ");
            let description = if description.is_empty() {
                format!("Skill loaded from {}", file_name)
            } else {
                description
            };

            let now = chrono::Utc::now().to_rfc3339();
            let skill = Skill {
                id: skill_id.to_string(),
                name,
                description,
                capabilities: vec![],
                prompt_template,
                examples,
                parameters,
                version: "1.0.0".to_string(),
                created: now.clone(),
                updated: now,
                file_path: path.clone(),
            };

            // Auto-save the sidecar for future loads
            if let Err(e) = fs::create_dir_all(&sidecar_dir) {
                eprintln!("Warning: Failed to create .metadata dir for auto-sidecar: {}", e);
            } else {
                let metadata = skill.metadata();
                if let Ok(meta_json) = serde_json::to_string_pretty(&metadata) {
                    if let Err(e) = fs::write(&sidecar_path, &meta_json) {
                        eprintln!("Warning: Failed to write auto-sidecar for {}: {}", skill_id, e);
                    }
                }
            }

            return Ok(skill);
        }
        
        let meta_content = fs::read_to_string(&sidecar_path)?;
        let metadata: SkillMetadata = serde_json::from_str(&meta_content)
            .map_err(|e| SkillError::ParseError(format!("Failed to parse skill JSON: {}", e)))?;
        
        let body = fs::read_to_string(path)?;

        // 3. Parse markdown body for examples, parameters, and prompt template
        let (prompt_template, examples, parameters) = Self::parse_body(&body)?;

        // 4. Return populated Skill struct
        Ok(Skill {
            id: metadata.skill_id,
            name: metadata.name,
            description: metadata.description,
            capabilities: metadata.capabilities,
            prompt_template,
            examples,
            parameters,
            version: metadata.version,
            created: metadata.created,
            updated: metadata.updated,
            file_path: path.clone(),
        })
    }

    /// Convert skill to markdown format
    /// Convert skill to pure markdown format (No frontmatter)
    pub fn to_markdown(&self) -> String {
        let mut markdown = String::new();

        // 1. Generate markdown header
        markdown.push_str(&format!("# {} Skill\n\n", self.name));

        // Description section
        markdown.push_str("## Overview\n");
        markdown.push_str(&format!("{}\n\n", self.description));

        // Prompt Template section
        markdown.push_str("## Prompt Template\n");
        markdown.push_str(&format!("{}\n\n", self.prompt_template));

        // Parameters section
        if !self.parameters.is_empty() {
            markdown.push_str("## Parameters\n\n");
            for param in &self.parameters {
                let required_str = if param.required { "required" } else { "optional" };
                markdown.push_str(&format!("### {} ({}, {})\n", param.name, param.param_type, required_str));
                markdown.push_str(&format!("{}\n", param.description));
                if let Some(default) = &param.default_value {
                    markdown.push_str(&format!("\nDefault: \"{}\"\n", default));
                }
                markdown.push('\n');
            }
        }

        // Examples section
        if !self.examples.is_empty() {
            markdown.push_str("## Examples\n\n");
            for (i, example) in self.examples.iter().enumerate() {
                markdown.push_str(&format!("### Example {}: {}\n", i + 1, example.title));
                markdown.push_str("**Input:**\n");
                markdown.push_str("```json\n");
                markdown.push_str(&example.input);
                markdown.push_str("\n```\n\n");
                markdown.push_str("**Expected Output:**\n");
                markdown.push_str(&format!("{}\n\n", example.expected_output));
            }
        }

        // Usage guidelines
        markdown.push_str("## Usage Guidelines\n\n");
        markdown.push_str("- Best used for: Complex tasks requiring specialized capabilities\n");
        markdown.push_str("- Typical conversation length: Multiple exchanges for thorough completion\n");

        markdown
    }

    /// Validate skill structure
    pub fn validate(&self) -> Result<(), Vec<String>> {
        let mut errors = Vec::new();

        // Check required fields are present
        if self.id.is_empty() {
            errors.push("skill_id cannot be empty".to_string());
        }

        if self.name.is_empty() {
            errors.push("name cannot be empty".to_string());
        }

        if self.prompt_template.is_empty() {
            errors.push("prompt_template cannot be empty".to_string());
        }

        // Validate skill_id format (alphanumeric + hyphens + underscores)
        let valid_id = self
            .id
            .chars()
            .all(|c| c.is_alphanumeric() || c == '-' || c == '_');
        if !valid_id {
            errors.push(format!(
                "skill_id '{}' contains invalid characters (only alphanumeric, hyphens, and underscores allowed)",
                self.id
            ));
        }

        // Validate version format
        if !self.version.is_empty() {
            let parts: Vec<&str> = self.version.split('.').collect();
            if parts.len() != 3 || parts.iter().any(|p| p.parse::<u32>().is_err()) {
                errors.push(format!(
                    "version '{}' is not in valid semver format (expected x.y.z)",
                    self.version
                ));
            }
        }

        // Validate parameters
        for param in &self.parameters {
            if param.name.is_empty() {
                errors.push("parameter name cannot be empty".to_string());
            }
            if !matches!(
                param.param_type.as_str(),
                "string" | "number" | "boolean" | "array"
            ) {
                errors.push(format!(
                    "parameter '{}' has invalid type '{}' (must be string, number, boolean, or array)",
                    param.name, param.param_type
                ));
            }
        }

        if errors.is_empty() {
            Ok(())
        } else {
            Err(errors)
        }
    }

    /// Apply skill parameters to prompt template
    pub fn render_prompt(&self, params: HashMap<String, String>) -> Result<String, SkillError> {
        let mut rendered = self.prompt_template.clone();

        // Check that all required parameters are provided
        for param in &self.parameters {
            if param.required && !params.contains_key(&param.name) {
                return Err(SkillError::RenderError(format!(
                    "Required parameter '{}' not provided",
                    param.name
                )));
            }
        }

        // Replace placeholders in prompt_template with actual values
        // Format: {{parameter_name}}
        for param in &self.parameters {
            let placeholder = format!("{{{{{}}}}}", param.name);
            let value = params
                .get(&param.name)
                .or(param.default_value.as_ref())
                .ok_or_else(|| {
                    SkillError::RenderError(format!(
                        "No value or default for parameter '{}'",
                        param.name
                    ))
                })?;

            rendered = rendered.replace(&placeholder, value);
        }

        // Check for any remaining unreplaced placeholders
        if rendered.contains("{{") && rendered.contains("}}") {
            let start = rendered.find("{{").unwrap();
            let end = rendered[start..].find("}}").unwrap() + start + 2;
            let unreplaced = &rendered[start..end];
            return Err(SkillError::RenderError(format!(
                "Unreplaced placeholder found: {}",
                unreplaced
            )));
        }

        Ok(rendered)
    }


    /// Parse markdown body for prompt template, examples, and parameters
    fn parse_body(body: &str) -> Result<(String, Vec<SkillExample>, Vec<SkillParameter>), SkillError> {
        #[cfg(test)]
        eprintln!("Parsing body with {} lines", body.lines().count());

        let mut prompt_template = String::new();
        let mut examples = Vec::new();
        let mut parameters = Vec::new();

        let mut in_prompt_section = false;
        let mut in_parameters_section = false;
        let mut in_examples_section = false;

        let mut current_example: Option<SkillExample> = None;
        let mut current_param: Option<SkillParameter> = None;
        let mut in_example_input = false;
        let mut in_example_output = false;
        let mut example_input_buffer = String::new();

        for line in body.lines() {
            let trimmed = line.trim();

            // Detect sections
            if trimmed.starts_with("## Prompt Template") {
                #[cfg(test)]
                eprintln!("Found Prompt Template section");
                // Save any pending parameter before switching sections
                if let Some(param) = current_param.take() {
                    parameters.push(param);
                }
                in_prompt_section = true;
                in_parameters_section = false;
                in_examples_section = false;
                continue;
            } else if trimmed.starts_with("## Parameters") {
                #[cfg(test)]
                eprintln!("Found Parameters section");
                // Save any pending parameter before switching sections
                if let Some(param) = current_param.take() {
                    parameters.push(param);
                }
                in_prompt_section = false;
                in_parameters_section = true;
                in_examples_section = false;
                continue;
            } else if trimmed.starts_with("## Examples") {
                #[cfg(test)]
                eprintln!("Found Examples section");
                // Save any pending parameter before switching sections
                if let Some(param) = current_param.take() {
                    parameters.push(param);
                }
                // Save any pending example
                if let Some(example) = current_example.take() {
                    examples.push(example);
                }
                in_prompt_section = false;
                in_parameters_section = false;
                in_examples_section = true;
                continue;
            } else if trimmed.starts_with("### ") {
                // This is a sub-section item, let section-specific logic handle it
            } else if (trimmed.starts_with("## ") || (trimmed.starts_with("##") && !trimmed.starts_with("###"))) && 
                       !trimmed.starts_with("## Prompt Template") && 
                       !trimmed.starts_with("## Parameters") && 
                       !trimmed.starts_with("## Examples") &&
                       !trimmed.starts_with("## Overview") &&
                       !trimmed.starts_with("## Usage Guidelines") {
                
                // If we are in the prompt section, we should NOT stop for arbitrary headers like ## Role
                // We only stop if we are transitioning between main system sections
                if in_prompt_section {
                    // Stay in prompt section, let it be appended below
                } else {
                    // Other section - reset all and save pending items
                    if let Some(param) = current_param.take() {
                        parameters.push(param);
                    }
                    if let Some(example) = current_example.take() {
                        examples.push(example);
                    }
                    in_prompt_section = false;
                    in_parameters_section = false;
                    in_examples_section = false;
                    continue;
                }
            }

            // Parse prompt template section
            if in_prompt_section && !trimmed.is_empty() {
                if !prompt_template.is_empty() {
                    prompt_template.push('\n');
                }
                prompt_template.push_str(line);
            }

            // Parse parameters section
            if in_parameters_section {
                #[cfg(test)]
                if !trimmed.is_empty() {
                    eprintln!("In parameters section, line: '{}'", trimmed);
                }
                if let Some(header) = trimmed.strip_prefix("### ") {
                    #[cfg(test)]
                    eprintln!("Found parameter header: {}", trimmed);
                    // Save previous parameter
                    if let Some(param) = current_param.take() {
                        parameters.push(param);
                    }

                    // Parse parameter header: ### name (type, required/optional)
                    if let Some(paren_start) = header.find('(') {
                        let param_name = header[..paren_start].trim().to_string();
                        let rest = &header[paren_start + 1..];
                        if let Some(paren_end) = rest.find(')') {
                            let parts: Vec<&str> = rest[..paren_end].split(',').collect();
                            let param_type = parts.first().unwrap_or(&"string").trim().to_string();
                            let required = parts.get(1).map(|s| s.trim() == "required").unwrap_or(false);

                            current_param = Some(SkillParameter {
                                name: param_name,
                                param_type,
                                description: String::new(),
                                required,
                                default_value: None,
                            });
                        }
                    }
                } else if let Some(ref mut param) = current_param {
                    // Parse parameter description or default value
                    if let Some(stripped_default) = trimmed.strip_prefix("Default:") {
                        let default = stripped_default.trim().trim_matches('"').to_string();
                        param.default_value = Some(default);
                    } else if !trimmed.is_empty() {
                        if !param.description.is_empty() {
                            param.description.push(' ');
                        }
                        param.description.push_str(trimmed);
                    }
                }
            }

            // Parse examples section
            if in_examples_section {
                if let Some(stripped) = trimmed.strip_prefix("### Example") {
                    // Save previous example
                    if let Some(example) = current_example.take() {
                        examples.push(example);
                    }

                    // Extract example title
                    let title = if let Some(colon_pos) = stripped.find(':') {
                        stripped[colon_pos + 1..].trim().to_string()
                    } else {
                        stripped.trim().to_string()
                    };

                    current_example = Some(SkillExample {
                        title,
                        input: String::new(),
                        expected_output: String::new(),
                    });
                    in_example_input = false;
                    in_example_output = false;
                } else if trimmed == "**Input:**" {
                    in_example_input = true;
                    in_example_output = false;
                    example_input_buffer.clear();
                } else if trimmed == "**Expected Output:**" {
                    in_example_input = false;
                    in_example_output = true;
                } else if trimmed.starts_with("```") {
                    // Handle code blocks
                    if in_example_input && !example_input_buffer.is_empty() {
                        if let Some(ref mut example) = current_example {
                            example.input = example_input_buffer.clone();
                        }
                        example_input_buffer.clear();
                    }
                } else if in_example_input {
                    if !example_input_buffer.is_empty() {
                        example_input_buffer.push('\n');
                    }
                    example_input_buffer.push_str(line);
                } else if in_example_output {
                    if let Some(ref mut example) = current_example {
                        if !example.expected_output.is_empty() {
                            example.expected_output.push('\n');
                        }
                        example.expected_output.push_str(trimmed);
                    }
                }
            }
        }

        // Save last parameter and example
        if let Some(param) = current_param {
            parameters.push(param);
        }
        if let Some(example) = current_example {
            examples.push(example);
        }

        Ok((prompt_template, examples, parameters))
    }

    /// Get metadata summary of the skill
    pub fn metadata(&self) -> SkillMetadata {
        SkillMetadata {
            skill_id: self.id.clone(),
            name: self.name.clone(),
            description: self.description.clone(),
            capabilities: self.capabilities.clone(),
            version: self.version.clone(),
            created: self.created.clone(),
            updated: self.updated.clone(),
        }
    }

    /// Save skill to a markdown file
    /// Save skill to disk (Markdown + JSON sidecar)
    pub fn save<P: AsRef<Path>>(&self, path: P) -> Result<(), SkillError> {
        let path = path.as_ref();
        
        // 1. Save pure Markdown content
        let content = self.to_markdown();
        fs::write(path, content)?;

        // 2. Save JSON metadata sidecar
        let sidecar_dir = path.parent().unwrap_or(Path::new(".")).join(".metadata");
        if !sidecar_dir.exists() {
            fs::create_dir_all(&sidecar_dir)?;
        }
        
        let sidecar_path = sidecar_dir.join(format!("{}.json", self.id));
        let metadata = self.metadata();
        let meta_content = serde_json::to_string_pretty(&metadata)
            .map_err(|e| SkillError::ParseError(format!("Failed to serialize skill JSON: {}", e)))?;
        
        fs::write(sidecar_path, meta_content)?;
        
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_valid_skill() {
        let skill = Skill {
            id: "test-skill".to_string(),
            name: "Test Skill".to_string(),
            description: "A test skill".to_string(),
            capabilities: vec!["testing".to_string()],
            prompt_template: "Test prompt".to_string(),
            examples: vec![],
            parameters: vec![],
            version: "1.0.0".to_string(),
            created: "2024-11-13".to_string(),
            updated: "2024-11-13".to_string(),
            file_path: PathBuf::from("test.md"),
        };

        assert!(skill.validate().is_ok());
    }

    #[test]
    fn test_validate_invalid_id() {
        let skill = Skill {
            id: "test skill!".to_string(),
            name: "Test Skill".to_string(),
            description: "A test skill".to_string(),
            capabilities: vec![],
            prompt_template: "Test prompt".to_string(),
            examples: vec![],
            parameters: vec![],
            version: "1.0.0".to_string(),
            created: "".to_string(),
            updated: "".to_string(),
            file_path: PathBuf::from("test.md"),
        };

        assert!(skill.validate().is_err());
    }

    #[test]
    fn test_render_prompt() {
        let skill = Skill {
            id: "test".to_string(),
            name: "Test".to_string(),
            description: "Test".to_string(),
            capabilities: vec![],
            prompt_template: "Hello {{name}}, you are {{age}} years old.".to_string(),
            examples: vec![],
            parameters: vec![
                SkillParameter {
                    name: "name".to_string(),
                    param_type: "string".to_string(),
                    description: "Name".to_string(),
                    required: true,
                    default_value: None,
                },
                SkillParameter {
                    name: "age".to_string(),
                    param_type: "number".to_string(),
                    description: "Age".to_string(),
                    required: false,
                    default_value: Some("25".to_string()),
                },
            ],
            version: "1.0.0".to_string(),
            created: "".to_string(),
            updated: "".to_string(),
            file_path: PathBuf::from("test.md"),
        };

        let mut params = HashMap::new();
        params.insert("name".to_string(), "Alice".to_string());

        let result = skill.render_prompt(params).unwrap();
        assert_eq!(result, "Hello Alice, you are 25 years old.");
    }

    #[test]
    fn test_parse_and_serialize_roundtrip() {
        use std::fs;
        use std::env;

        let markdown_content = r#"# Test Research Assistant Skill

## Overview
This is a test skill for research.

## Prompt Template
You are a researcher focusing on {{topic}}.
Please research: {{query}}

## Parameters

### topic (string, required)
The research topic or domain

### query (string, required)
The specific research query

## Examples

### Example 1: Basic Research
**Input:**
```json
{
  "topic": "AI",
  "query": "Latest trends in machine learning"
}
```

**Expected Output:**
A comprehensive report on ML trends.

## Usage Guidelines

- Best used for: Research tasks
"#;

        // Create a temporary directory
        let temp_dir = env::temp_dir().join("skill_test_final");
        fs::create_dir_all(&temp_dir).unwrap();
        
        let test_file = temp_dir.join("test_skill.md");
        fs::write(&test_file, markdown_content).unwrap();

        // Create sidecar
        let sidecar_dir = temp_dir.join(".metadata");
        fs::create_dir_all(&sidecar_dir).unwrap();
        let sidecar_path = sidecar_dir.join("test_skill.json");
        let metadata = serde_json::json!({
            "skill_id": "test-researcher",
            "name": "Test Research Assistant",
            "description": "A test research skill",
            "capabilities": ["web_search", "analysis"],
            "version": "1.0.0",
            "created": "2024-11-13T10:00:00Z",
            "updated": "2024-11-13T10:00:00Z"
        });
        fs::write(&sidecar_path, serde_json::to_string(&metadata).unwrap()).unwrap();

        // Parse the skill
        let skill = Skill::from_markdown_file(&test_file).expect("Failed to load skill from MD + sidecar");

        // Verify parsed data
        assert_eq!(skill.id, "test-researcher");
        assert_eq!(skill.name, "Test Research Assistant");
        assert_eq!(skill.description, "A test research skill");
        assert_eq!(skill.capabilities, vec!["web_search", "analysis"]);
        assert_eq!(skill.version, "1.0.0");

        assert_eq!(skill.parameters.len(), 2);
        assert_eq!(skill.parameters[0].name, "topic");
        assert_eq!(skill.parameters[1].name, "query");
        assert_eq!(skill.examples.len(), 1);
        assert_eq!(skill.examples[0].title, "Basic Research");

        // Validate the skill
        assert!(skill.validate().is_ok());

        // Test render_prompt
        let mut params = HashMap::new();
        params.insert("topic".to_string(), "Machine Learning".to_string());
        params.insert("query".to_string(), "Compare PyTorch vs TensorFlow".to_string());

        let rendered = skill.render_prompt(params).unwrap();
        assert!(rendered.contains("Machine Learning"));
        assert!(rendered.contains("Compare PyTorch vs TensorFlow"));

        // Serialize back to markdown (Should be pure content)
        let serialized = skill.to_markdown();
        assert!(!serialized.contains("skill_id: test-researcher")); // No YAML in MD anymore
        assert!(serialized.contains("Test Research Assistant"));
        assert!(!serialized.contains("web_search")); // Capabilities are in JSON now

        // Cleanup
        fs::remove_dir_all(&temp_dir).ok();
    }
}
