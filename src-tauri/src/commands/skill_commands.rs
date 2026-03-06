use crate::models::skill::{Skill, SkillCategory};
use crate::services::skill_service::SkillService;
use std::collections::HashMap;

#[tauri::command]
pub async fn get_all_skills() -> Result<Vec<Skill>, String> {
    SkillService::get_all_skills().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_skill(skill_id: String) -> Result<Skill, String> {
    SkillService::get_skill(&skill_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn save_skill(skill: Skill) -> Result<(), String> {
    SkillService::save_skill(&skill).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_skill(skill_id: String) -> Result<(), String> {
    SkillService::delete_skill(&skill_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_skill_template(
    skill_id: String,
    name: String,
    description: String,
    category: SkillCategory,
) -> Result<Skill, String> {
    // Convert SkillCategory to capabilities vector
    let capabilities = match category {
        SkillCategory::Research => vec!["research".to_string(), "analysis".to_string()],
        SkillCategory::Development => vec!["coding".to_string(), "development".to_string()],
        SkillCategory::Writing => vec!["writing".to_string(), "content".to_string()],
        SkillCategory::Analysis => vec!["analysis".to_string(), "data".to_string()],
        SkillCategory::Other => vec!["general".to_string()],
    };

    let skill = SkillService::create_skill_template(skill_id, name, description, capabilities);

    Ok(skill)
}

#[tauri::command]
pub async fn get_skills_by_category(category: SkillCategory) -> Result<Vec<Skill>, String> {
    // Convert SkillCategory to string for filtering
    let category_str = match category {
        SkillCategory::Research => "research",
        SkillCategory::Development => "development",
        SkillCategory::Writing => "writing",
        SkillCategory::Analysis => "analysis",
        SkillCategory::Other => "general",
    };

    SkillService::get_skills_by_category(category_str).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn render_skill_prompt(
    skill_id: String,
    params: HashMap<String, String>,
) -> Result<String, String> {
    let skill = SkillService::get_skill(&skill_id).map_err(|e| e.to_string())?;

    skill.render_prompt(params).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn validate_skill(skill: Skill) -> Result<Vec<String>, String> {
    match skill.validate() {
        Ok(_) => Ok(Vec::new()),
        Err(errors) => Ok(errors),
    }
}

// ===== Backward Compatibility Commands =====
// These commands maintain backward compatibility with existing frontend code

#[tauri::command]
pub async fn create_skill(
    name: String,
    description: String,
    prompt_template: String,
    capabilities: Vec<String>,
) -> Result<Skill, String> {
    SkillService::create_skill(&name, &description, &prompt_template, capabilities)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_skill(skill: Skill) -> Result<(), String> {
    SkillService::update_skill(&skill).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn import_skill(skill_command: String) -> Result<Skill, String> {
    // Create a temporary directory using tempfile crate
    let temp_dir = tempfile::tempdir().map_err(|e| format!("Failed to create temp dir: {}", e))?;

    log::info!("Using temp dir: {:?}", temp_dir.path());
    log::info!("Importing skill with args: {}", skill_command);

    // Split the input into individual arguments
    // We handle cases where the user might paste the whole command or just the URL/skill name
    let skill_command = skill_command.trim();
    let clean_input = if skill_command.starts_with("npx skills add ") {
        skill_command["npx skills add ".len()..].trim().to_string()
    } else if skill_command.starts_with("skills add ") {
        skill_command["skills add ".len()..].trim().to_string()
    } else {
        skill_command.to_string()
    };

    // Prepare the command
    let mut cmd = std::process::Command::new("npx");
    // npx --yes ensures that it doesn't prompt to install the 'skills' package if it's not present
    cmd.arg("--yes");
    cmd.arg("skills").arg("add");

    // Get the relevant arguments and add to the command
    let args: Vec<&str> = clean_input.split_whitespace().collect();
    for arg in &args {
        cmd.arg(arg);
    }
    // Also pass --yes to the 'skills' tool itself
    cmd.arg("--yes");

    // Set current directory to temp dir so files are downloaded there
    log::info!(
        "Executing npx --yes skills add ... --yes in {:?}",
        temp_dir.path()
    );
    cmd.current_dir(temp_dir.path());

    // Execute the command
    let output = cmd.output().map_err(|e| {
        format!(
            "Failed to execute npx: {}. Make sure Node.js and npx are installed.",
            e
        )
    })?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);

    if !output.status.success() {
        log::error!(
            "npx failed with status {}: \nSTDOUT: {}\nSTDERR: {}",
            output.status,
            stdout,
            stderr
        );
        return Err(format!("Failed to import skill: {}", stderr));
    }

    log::info!("npx succeeded. \nSTDOUT: {}", stdout);

    // Identify the skill name for our local metadata
    // Try to find it after --skill or use the last arg if it doesn't look like a URL
    let mut extracted_name = "Imported Skill".to_string();
    for i in 0..args.len() {
        if args[i] == "--skill" && i + 1 < args.len() {
            extracted_name = args[i + 1].to_string();
            break;
        }
    }

    if extracted_name == "Imported Skill" && !args.is_empty() {
        // If no --skill, check the first arg (often the name or URL)
        let first = args[0];
        if !first.starts_with("http") && !first.contains('/') {
            extracted_name = first.to_string();
        } else {
            // It's a URL, maybe the skill name is in the tail?
            if let Some(pos) = first.rfind('/') {
                extracted_name = first[pos + 1..].to_string();
            }
        }
    }

    // Find the downloaded markdown file recursively
    log::info!("Searching for skill markdown file in {:?}", temp_dir.path());
    let mut skill_file = None;

    // We use WalkDir to search recursively because npx skills add
    // creates a .agents/skills/<skill-name>/ structure
    for entry in walkdir::WalkDir::new(temp_dir.path())
        .follow_links(false)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path();
        if path.is_file() {
            if let Some(ext) = path.extension() {
                if ext == "md" {
                    let file_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");

                    // Prefer SKILL.md as it's the standard for these skills
                    if file_name == "SKILL.md" {
                        log::info!("Found SKILL.md at {:?}", path);
                        skill_file = Some(path.to_path_buf());
                        break;
                    }

                    // Otherwise take the first .md file we find if we haven't found any yet
                    if skill_file.is_none() {
                        log::info!("Found potential skill file: {:?}", path);
                        skill_file = Some(path.to_path_buf());
                    }
                }
            }
        }
    }

    if skill_file.is_none() {
        // Log the directory structure to help debugging if it fails
        log::error!("Failed to find any .md file in the temp directory.");
        log::info!("Directory contents of {:?}:", temp_dir.path());
        for entry in walkdir::WalkDir::new(temp_dir.path())
            .into_iter()
            .filter_map(|e| e.ok())
        {
            log::info!("  {:?}", entry.path());
        }
    }

    let skill_path = skill_file.ok_or_else(|| "No skill file found in downloaded content. The command may have succeeded but the skill file was not found in the expected location.".to_string())?;
    log::info!("Using skill file: {:?}", skill_path);

    // Read the markdown content
    let content = std::fs::read_to_string(&skill_path).map_err(|e| e.to_string())?;

    // Parse metadata and content from markdown
    let (name, description, mut capabilities, cleaned_content) =
        parse_imported_skill_metadata(&content, &extracted_name);

    // Ensure we have at least the "imported" capability
    if !capabilities.contains(&"imported".to_string()) {
        capabilities.push("imported".to_string());
    }

    // Create the skill using SkillService
    let skill = SkillService::create_skill(&name, &description, &cleaned_content, capabilities)
        .map_err(|e| e.to_string())?;

    log::info!("Successfully imported skill: {} (ID: {})", name, skill.id);

    Ok(skill)
}

// Helper function to parse metadata from imported skill markdown
fn parse_imported_skill_metadata(
    content: &str,
    default_name: &str,
) -> (String, String, Vec<String>, String) {
    let mut name = default_name.to_string();
    let mut description = "Imported skill from registry".to_string();
    let mut capabilities = Vec::new();
    let mut body = content.to_string();

    // 1. Check for YAML frontmatter
    let content_trimmed = content.trim();
    if content_trimmed.starts_with("---") {
        let parts: Vec<&str> = content_trimmed.splitn(3, "---").collect();
        if parts.len() >= 3 {
            let yaml_str = parts[1];
            body = parts[2].trim().to_string();

            if let Ok(yaml) = serde_yaml::from_str::<serde_json::Value>(yaml_str) {
                if let Some(n) = yaml.get("name").and_then(|v| v.as_str()) {
                    name = n.to_string();
                }
                if let Some(d) = yaml.get("description").and_then(|v| v.as_str()) {
                    description = d.to_string();
                }

                // Try to get capabilities from 'capabilities' or 'allowed-tools'
                if let Some(caps) = yaml.get("capabilities").and_then(|v| v.as_array()) {
                    for cap in caps {
                        if let Some(c) = cap.as_str() {
                            capabilities.push(c.to_string());
                        }
                    }
                } else if let Some(tools) = yaml.get("allowed-tools").and_then(|v| v.as_array()) {
                    // Try array first
                    for cap in tools {
                        if let Some(c) = cap.as_str() {
                            capabilities.push(c.to_string());
                        }
                    }
                } else if let Some(tools) = yaml.get("allowed-tools").and_then(|v| v.as_str()) {
                    // Then try comma string
                    for tool in tools.split(',') {
                        capabilities.push(tool.trim().to_string());
                    }
                }
            }
        }
    }

    // 2. If name is still default or from YAML, try to find a better one in the MD header
    // but only if it's not the first thing we already used
    let mut h1_to_remove = None;
    let lines: Vec<&str> = body.lines().collect();
    if let Some(h1_line) = lines.iter().find(|l| l.trim().starts_with("# ")) {
        let h1_name = h1_line.trim().trim_start_matches("# ").trim().to_string();
        if !h1_name.is_empty() {
            name = h1_name;
            h1_to_remove = Some(h1_line.to_string());
        }
    }

    // 3. Normalize headers for our UI
    // Convert "**Role:** Product Manager" to "## Role\nProduct Manager"
    // Also handle generic headers like ## Function or ## Objective
    let mut normalized_body = Vec::new();

    for line in body.lines() {
        if let Some(ref h1) = h1_to_remove {
            if line == h1 {
                continue;
            }
        }

        let trimmed = line.trim();
        let mut processed_line = line.to_string();

        if trimmed.starts_with("**Role:**") {
            processed_line = format!(
                "## Role\n{}",
                trimmed.trim_start_matches("**Role:**").trim()
            );
        } else if trimmed.starts_with("**Tasks:**") || trimmed.starts_with("**Function:**") {
            processed_line = format!(
                "## Tasks\n{}",
                trimmed
                    .trim_start_matches("**Tasks:**")
                    .trim_start_matches("**Function:**")
                    .trim()
            );
        } else if trimmed.starts_with("**Output:**") || trimmed.starts_with("**Output Format:**") {
            processed_line = format!(
                "## Output\n{}",
                trimmed
                    .trim_start_matches("**Output:**")
                    .trim_start_matches("**Output Format:**")
                    .trim()
            );
        } else if trimmed.to_lowercase().starts_with("## function") {
            processed_line = "## Tasks".to_string();
        } else if trimmed.to_lowercase().starts_with("## objective") {
            processed_line = "## Role".to_string();
        }

        normalized_body.push(processed_line);
    }

    let final_body = normalized_body.join("\n").trim().to_string();

    // 4. Final description cleanup: if description is still generic, take the first non-header line
    if description == "Imported skill from registry" {
        for line in final_body.lines() {
            let trimmed = line.trim();
            // Skip headers, bold markers, and empty lines
            if !trimmed.is_empty()
                && !trimmed.starts_with('#')
                && !trimmed.starts_with('*')
                && !trimmed.starts_with('-')
            {
                description = trimmed.to_string();
                if description.len() > 200 {
                    description = format!("{}...", &description[..197]);
                }
                break;
            }
        }
    }

    (name, description, capabilities, final_body)
}
