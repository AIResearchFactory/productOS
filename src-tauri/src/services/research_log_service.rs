use crate::models::research_log::ResearchLogEntry;
use crate::services::project_service::ProjectService;
use anyhow::{Context, Result};
use chrono::Utc;
use std::fs;
use std::fs::OpenOptions;
use std::io::Write;

pub struct ResearchLogService;

impl ResearchLogService {
    /// Append a log entry to research_log.md in the project directory
    pub fn log_event(
        project_id: &str,
        provider_name: &str,
        command: Option<&str>,
        content: &str,
    ) -> Result<()> {
        let project = ProjectService::load_project_by_id(project_id)
            .context("Failed to load project for logging")?;

        let log_path = project.path.join("research_log.md");

        // Ensure file exists with header if it doesn't
        if !log_path.exists() {
            fs::write(&log_path, format!("# Research Log: {}\n\nThis file tracks automatic agent interactions and observations.\n\n", project.name))?;
        }

        let mut file = OpenOptions::new()
            .append(true)
            .open(&log_path)
            .context("Failed to open research_log.md for appending")?;

        let timestamp = Utc::now().to_rfc3339();

        writeln!(file, "---")?;
        writeln!(file, "### Interaction: {}", timestamp)?;
        writeln!(file, "**Provider**: {}", provider_name)?;
        if let Some(cmd) = command {
            writeln!(file, "**Command**: `{}`", cmd)?;
        }
        writeln!(file, "\n#### Agent Output:\n")?;
        writeln!(file, "{}", content)?;
        writeln!(file, "\n")?;

        Ok(())
    }

    /// Load all log entries from research_log.md
    pub fn get_log(project_id: &str) -> Result<Vec<ResearchLogEntry>> {
        let project = ProjectService::load_project_by_id(project_id)
            .context("Failed to load project for logs")?;
        let log_path = project.path.join("research_log.md");

        if !log_path.exists() {
            return Ok(vec![]);
        }

        let full_content = fs::read_to_string(log_path).context("Failed to read log file")?;
        Ok(Self::parse_log_content(&full_content))
    }

    /// Internal parser for research_log.md content
    pub fn parse_log_content(content: &str) -> Vec<ResearchLogEntry> {
        // Split by "---" separator
        let interactions: Vec<&str> = content.split("---").skip(1).collect();

        let mut entries = Vec::new();

        for interaction in interactions {
            let lines: Vec<&str> = interaction.trim().lines().collect();
            if lines.is_empty() {
                continue;
            }

            let mut timestamp = String::new();
            let mut provider = String::new();
            let mut command = None;
            let mut agent_output = String::new();
            let mut in_output = false;

            for line in lines {
                if line.starts_with("### Interaction: ") {
                    timestamp = line.replace("### Interaction: ", "").trim().to_string();
                } else if line.starts_with("**Provider**: ") {
                    provider = line.replace("**Provider**: ", "").trim().to_string();
                } else if line.starts_with("**Command**: ") {
                    let cmd_raw = line.replace("**Command**: ", "").trim().to_string();
                    command = Some(cmd_raw.trim_matches('`').to_string());
                } else if line.trim() == "#### Agent Output:" {
                    in_output = true;
                } else if in_output {
                    agent_output.push_str(line);
                    agent_output.push('\n');
                }
            }

            entries.push(ResearchLogEntry {
                timestamp,
                provider,
                command,
                content: agent_output.trim().to_string(),
            });
        }

        entries
    }

    /// Reset research_log.md
    pub fn clear_log(project_id: &str) -> Result<()> {
        let project = ProjectService::load_project_by_id(project_id)
            .context("Failed to load project for clearing log")?;
        let log_path = project.path.join("research_log.md");

        if log_path.exists() {
            fs::write(
                &log_path,
                format!(
                    "# Research Log: {}\n\nThis file tracks automatic agent interactions and observations.\n\n",
                    project.name
                ),
            )?;
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;
    use crate::models::project::Project;

    #[test]
    fn test_parsing_research_log() {
        let temp_dir = tempdir().unwrap();
        let _project_path = temp_dir.path().to_path_buf();
        
        // Create log file manually
        let log_content = r#"# Research Log: Test Project

This file tracks automatic agent interactions and observations.

---
### Interaction: 2024-03-21T22:04:28Z
**Provider**: claude
**Command**: `ls -la`

#### Agent Output:

File details here...

---
### Interaction: 2024-03-21T22:05:00Z
**Provider**: gemini
**Command**: `grep foo bar`

#### Agent Output:

Match found!
"#;
        
        let entries = ResearchLogService::parse_log_content(log_content);
        
        assert_eq!(entries.len(), 2);
        assert_eq!(entries[0].timestamp, "2024-03-21T22:04:28Z");
        assert_eq!(entries[0].provider, "claude");
        assert_eq!(entries[0].command, Some("ls -la".to_string()));
        assert_eq!(entries[0].content, "File details here...");
        
        assert_eq!(entries[1].timestamp, "2024-03-21T22:05:00Z");
        assert_eq!(entries[1].provider, "gemini");
        assert_eq!(entries[1].command, Some("grep foo bar".to_string()));
        assert_eq!(entries[1].content, "Match found!");
    }
}
