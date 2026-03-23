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
            let mut json_str = cap[1].trim().to_string();
            
            // Strip markdown code fences if present
            json_str = json_str.replace("```json", "");
            json_str = json_str.replace("```", "");
            json_str = json_str.trim().to_string();
            
            // Extract substring between first `{` and last `}`
            if let Some(start) = json_str.find('{') {
                if let Some(end) = json_str.rfind('}') {
                    if start < end {
                        json_str = json_str[start..=end].to_string();
                    }
                }
            }

            if let Ok(workflow) = serde_json::from_str::<crate::models::workflow::Workflow>(&json_str) {
                workflows.push(workflow);
            }
        }
        workflows
    }

    /// Save detected workflows
    pub fn apply_workflow_saves(
        project_id: &str,
        workflows: &[crate::models::workflow::Workflow],
    ) -> Result<()> {
        use crate::services::workflow_service::WorkflowService;
        for mut workflow in workflows.to_vec() {
            workflow.project_id = project_id.to_string();
            WorkflowService::save_workflow(&workflow)
                .map_err(|e| anyhow::anyhow!("Failed to save workflow: {}", e))?;
        }
        Ok(())
    }

    /// Parse the output string for cost and token information.
    pub fn parse_generation_metadata(output: &str) -> Option<crate::models::ai::GenerationMetadata> {
        let mut cost = 0.0;
        let mut tokens_in = 0;
        let mut tokens_out = 0;
        let mut tokens_cache_read = 0;
        let mut tokens_cache_write = 0;
        let mut tokens_reasoning = 0;
        let mut found = false;

        // Cost parsing: "Cost: 0.15" or "Cost: $0.15"
        let cost_re = Regex::new(r"(?i)cost:?\s*\$?\s*(\d+\.?\d*)").unwrap();
        if let Some(cap) = cost_re.captures(output) {
            if let Ok(c) = cap[1].parse::<f64>() {
                cost = c;
                found = true;
            }
        }

        // Tokens parsing (generic "Tokens: X" or "input_tokens: X")
        let tokens_re = Regex::new(r"(?i)(?:input_)?tokens:?\s*(\d+)").unwrap();
        if let Some(cap) = tokens_re.captures(output) {
            if let Ok(t) = cap[1].parse::<u64>() {
                tokens_in = t;
                found = true;
            }
        }

        // Output tokens parsing: "output_tokens: X"
        let out_tokens_re = Regex::new(r"(?i)output_tokens:?\s*(\d+)").unwrap();
        if let Some(cap) = out_tokens_re.captures(output) {
            if let Ok(t) = cap[1].parse::<u64>() {
                tokens_out = t;
                found = true;
            }
        }

        // New fields parsing
        let cache_read_re = Regex::new(r"(?i)cache_read(?:_tokens)?:?\s*(\d+)").unwrap();
        if let Some(cap) = cache_read_re.captures(output) {
            if let Ok(t) = cap[1].parse::<u64>() {
                tokens_cache_read = t;
                found = true;
            }
        }

        let cache_write_re = Regex::new(r"(?i)cache_write(?:_tokens)?:?\s*(\d+)").unwrap();
        if let Some(cap) = cache_write_re.captures(output) {
            if let Ok(t) = cap[1].parse::<u64>() {
                tokens_cache_write = t;
                found = true;
            }
        }

        let reasoning_re = Regex::new(r"(?i)reasoning(?:_tokens)?:?\s*(\d+)").unwrap();
        if let Some(cap) = reasoning_re.captures(output) {
            if let Ok(t) = cap[1].parse::<u64>() {
                tokens_reasoning = t;
                found = true;
            }
        }

        if found {
            Some(crate::models::ai::GenerationMetadata {
                confidence: 1.0,
                cost_usd: cost,
                model_used: "cli-extracted".to_string(),
                tokens_in,
                tokens_out,
                tokens_cache_read,
                tokens_cache_write,
                tokens_reasoning,
            })
        } else {
            None
        }
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

    #[test]
    fn test_parse_generation_metadata() {
        let output = r#"
Successfully completed tasks.
[using tool attempt_completion: Successfully completed | Cost: 0.15]
Tokens: 1200
output_tokens: 450
"#;
        let meta = OutputParserService::parse_generation_metadata(output).unwrap();
        assert_eq!(meta.cost_usd, 0.15);
        assert_eq!(meta.tokens_in, 1200);
        assert_eq!(meta.tokens_out, 450);
    }
}
