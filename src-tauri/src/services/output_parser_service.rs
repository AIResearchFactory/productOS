use crate::services::file_service::FileService;
use anyhow::Result;
use regex::Regex;

pub struct OutputParserService;

#[derive(Debug, PartialEq)]
pub struct FileChange {
    pub path: String,
    pub content: String,
}

impl OutputParserService {
    /// Parse the output string for file change requests.
    /// Supports multiple patterns:
    /// 1. FILE: path/to/file
    /// 2. UPDATE: path/to/file
    /// 3. MODIFY: path/to/file
    /// Followed by:
    /// ```language
    /// content
    /// ```
    pub fn parse_file_changes(output: &str) -> Vec<FileChange> {
        let mut changes = Vec::new();

        // Regex to match file operation keywords followed by filename and code block
        // Supports: FILE:, UPDATE:, MODIFY:, CHANGE: (case-insensitive)
        // Allows optional markdown formatting (bold, italic, etc.)
        // Captures filename and content in code block
        let re = Regex::new(
            r"(?mi)^\s*(?:\*\*)?(?:FILE|UPDATE|MODIFY|CHANGE):\s*(.+?)(?:\*\*)?\s*$[\s\S]*?```[^\n]*\n([\s\S]*?)\n```"
        ).unwrap();

        for cap in re.captures_iter(output) {
            let raw_path = cap[1].trim();
            // Sanitize path to remove markdown formatting from both ends
            // Only remove specific markdown characters, not all whitespace-like chars
            let path = raw_path
                .trim_start_matches(|c: char| {
                    c == '*' || c == '_' || c == '`' || c == '\'' || c == '"'
                })
                .trim_end_matches(|c: char| {
                    c == '*' || c == '_' || c == '`' || c == '\'' || c == '"'
                })
                .trim() // Then trim actual whitespace
                .to_string();
            let content = cap[2].to_string();

            if !path.is_empty() {
                changes.push(FileChange { path, content });
            }
        }

        changes
    }

    /// Automatically apply changes to the project
    pub fn apply_changes(project_id: &str, changes: &[FileChange]) -> Result<()> {
        for change in changes {
            FileService::write_file(project_id, &change.path, &change.content)?;
        }
        Ok(())
    }

    /// Parse the output string for <SAVE_WORKFLOW> tags
    pub fn parse_workflow_saves(output: &str) -> Vec<crate::models::workflow::Workflow> {
        let mut workflows = Vec::new();
        let re = Regex::new(r"(?mi)<SAVE_WORKFLOW>\s*([\s\S]*?)\s*</SAVE_WORKFLOW>").unwrap();

        for cap in re.captures_iter(output) {
            let json_str = cap[1].trim();
            if let Ok(workflow) = serde_json::from_str::<crate::models::workflow::Workflow>(json_str) {
                workflows.push(workflow);
            }
        }
        workflows
    }

    /// Save detected workflows
    pub fn apply_workflow_saves(project_id: &str, workflows: &[crate::models::workflow::Workflow]) -> Result<()> {
        use crate::services::workflow_service::WorkflowService;
        for mut workflow in workflows.to_vec() {
            workflow.project_id = project_id.to_string();
            WorkflowService::save_workflow(&workflow)
                .map_err(|e| anyhow::anyhow!("Failed to save workflow: {}", e))?;
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_file_changes() {
        let output = r#"
I have generated the code for you.

FILE: src/main.rs
```rust
fn main() {
    println!("Hello, world!");
}
```

And also a README:

FILE: README.md
```markdown
# My Project
```
"#;
        let changes = OutputParserService::parse_file_changes(output);
        assert_eq!(changes.len(), 2);
        assert_eq!(changes[0].path, "src/main.rs");
        assert!(changes[0].content.contains("println!"));
        assert_eq!(changes[1].path, "README.md");
        assert_eq!(changes[1].content, "# My Project");
    }

    #[test]
    fn test_parse_file_changes_loose_format() {
        let output = r#"
Here is the file you requested:

**FILE: hidden_layer.md**

Some description here...

```markdown
# Hidden Layer
```
"#;
        let changes = OutputParserService::parse_file_changes(output);
        assert_eq!(changes.len(), 1);
        assert_eq!(changes[0].path, "hidden_layer.md"); // trim() removes ** if strict or just spaces?
                                                        // Wait, my regex `(?mi)^(?:[#*]*\s*)?FILE:\s*(.*?)[\s\r\n]*```...`
                                                        // Group 1 is `(.*?)`. If input is `**FILE: hidden_layer.md**`
                                                        // The regex matches `**FILE:` prefix successfully.
                                                        // Then `(.*?)` matches `hidden_layer.md**`?
                                                        // Ah, `(.*?)` is non-greedy. But `[\s\r\n]*` follows.
                                                        // If there are `**` after filename, `(.*?)` will capture them if `[\s\r\n]*` doesn't match `*`.
                                                        // So `hidden_layer.md**` might be captured.
                                                        // I need to update regex or test expectation.

        // Actually, let's just update the regex to handle trailing ** as well if possible, or just trim in code.
        // But for now let's see what happens.
        // If I update regex to `FILE:\s*(.*?)(?:\*\*|[\s\r\n])`...
    }
}
