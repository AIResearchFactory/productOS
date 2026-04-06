use crate::services::file_service::FileService;
use anyhow::Result;
use regex::Regex;

pub struct OutputParserService;

#[derive(Debug, PartialEq)]
pub struct FileChange {
    pub path: String,
    pub content: String,
}

#[derive(Debug, PartialEq)]
pub struct ArtifactChange {
    pub artifact_type: String,
    pub title: String,
    pub content: String,
}

impl OutputParserService {
    /// Parse the output string for file change requests.
    pub fn parse_file_changes(output: &str) -> Vec<FileChange> {
        let mut changes = Vec::new();

        // Regex to match file operation keywords followed by filename and code block
        let re = Regex::new(
            r"(?mi)^\s*(?:\*\*)?(?:FILE|UPDATE|MODIFY|CHANGE):\s*(.+?)(?:\*\*)?\s*$[\s\S]*?```[^\n]*\n([\s\S]*?)\n```"
        ).unwrap();

        for cap in re.captures_iter(output) {
            let raw_path = cap[1].trim();
            let path = raw_path
                .trim_start_matches(|c: char| {
                    c == '*' || c == '_' || c == '`' || c == '\'' || c == '"'
                })
                .trim_end_matches(|c: char| {
                    c == '*' || c == '_' || c == '`' || c == '\'' || c == '"'
                })
                .trim()
                .to_string();
            let content = cap[2].to_string();

            if !path.is_empty() {
                changes.push(FileChange { path, content });
            }
        }

        changes
    }

    /// Parse the output string for artifact creation requests.
    /// Format: ARTIFACT: type: title
    pub fn parse_artifact_changes(output: &str) -> Vec<ArtifactChange> {
        let mut changes = Vec::new();
        let re = Regex::new(
            r"(?mi)^\s*(?:\*\*)?ARTIFACT:\s*(.+?):\s*(.+?)(?:\*\*)?\s*$[\s\S]*?```[^\n]*\n([\s\S]*?)\n```"
        ).unwrap();

        for cap in re.captures_iter(output) {
            let artifact_type = cap[1].trim().to_lowercase();
            let title = cap[2].trim().to_string();
            let content = cap[3].to_string();

            if !artifact_type.is_empty() && !title.is_empty() {
                changes.push(ArtifactChange {
                    artifact_type,
                    title,
                    content,
                });
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

    /// Automatically apply artifact changes to the project
    pub fn apply_artifact_changes(project_id: &str, changes: &[ArtifactChange]) -> Result<()> {
        use crate::services::artifact_service::ArtifactService;
        use crate::models::artifact::ArtifactType;

        for change in changes {
            // Map string type to enum
            let artifact_type = match change.artifact_type.as_str() {
                "roadmap" => ArtifactType::Roadmap,
                "product_vision" | "vision" => ArtifactType::ProductVision,
                "one_pager" | "one-pager" => ArtifactType::OnePager,
                "prd" | "p_r_d" => ArtifactType::PRD,
                "initiative" => ArtifactType::Initiative,
                "competitive_research" | "research" => ArtifactType::CompetitiveResearch,
                "user_story" | "story" => ArtifactType::UserStory,
                "insight" => ArtifactType::Insight,
                "presentation" => ArtifactType::Presentation,
                _ => {
                    log::warn!("Unknown artifact type: {}", change.artifact_type);
                    continue;
                }
            };

            let mut artifact = ArtifactService::create_artifact(project_id, artifact_type, &change.title)
                .map_err(|e| anyhow::anyhow!("Failed to create artifact: {}", e))?;
            
            artifact.content = change.content.clone();
            artifact.save().map_err(|e| anyhow::anyhow!("Failed to save artifact: {}", e))?;
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

    /// Parse the output string for NOTIFY: messages
    pub fn parse_notifications(output: &str) -> Vec<String> {
        let mut notifications = Vec::new();

        // 1. Standard NOTIFY: format
        let re = Regex::new(r"(?mi)^\s*NOTIFY:\s*(.*)$").unwrap();
        for cap in re.captures_iter(output) {
            let message = cap[1].trim().to_string();
            if !message.is_empty() {
                notifications.push(message);
            }
        }

        // 2. Fallback: Parse XML-style tool tags used by some CLI providers
        // Format: <send_telegram_message><message>...</message></send_telegram_message>
        let xml_re = Regex::new(r"(?s)<send_(?:telegram|whatsapp)_message>\s*<message>(.*?)</message>\s*</send_(?:telegram|whatsapp)_message>").unwrap();
        for cap in xml_re.captures_iter(output) {
            let message = cap[1].trim().to_string();
            if !message.is_empty() {
                notifications.push(message);
            }
        }

        notifications
    }

    /// Send detected notifications
    pub async fn apply_notifications(notifications: &[String]) -> Result<()> {
        use crate::services::channel_service::ChannelService;
        for message in notifications {
            let _ = ChannelService::send_notification(message).await;
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

        // Cost parsing: "Cost: 0.15", "est. cost: $0.15", "Usage cost: 0.15"
        let cost_re = Regex::new(r"(?i)(?:cost|usage\s+cost|price):?\s*\$?\s*(\d+\.?\d*)").unwrap();
        if let Some(cap) = cost_re.captures(output) {
            if let Ok(c) = cap[1].parse::<f64>() {
                cost = c;
                found = true;
            }
        }

        // Input/Prompt tokens parsing
        let in_tokens_patterns = [
            r"(?i)(?:input|prompt|context)(?:_|\s+)?tokens:?\s*(\d+)",
            r"(?i)tokens\s+in:?\s*(\d+)",
            r"(?i)in\s+tokens:?\s*(\d+)",
            r"(?i)tokens:?\s*(\d+)\s+in",
            r"(?i)tokens:?\s*(\d+)", // Fallback for plain "Tokens: 1200"
        ];
        for pattern in in_tokens_patterns {
            let re = Regex::new(pattern).unwrap();
            if let Some(cap) = re.captures(output) {
                if let Ok(t) = cap[1].parse::<u64>() {
                    tokens_in = t;
                    found = true;
                    break;
                }
            }
        }

        // Output/Completion tokens parsing
        let out_tokens_patterns = [
            r"(?i)(?:output|completion|response)(?:_|\s+)?tokens:?\s*(\d+)",
            r"(?i)tokens\s+out:?\s*(\d+)",
            r"(?i)out\s+tokens:?\s*(\d+)",
            r"(?i)tokens:?\s*(\d+)\s+out",
            r"(?i)(\d+)\s+out", // Match "800 out"
        ];
        for pattern in out_tokens_patterns {
            let re = Regex::new(pattern).unwrap();
            if let Some(cap) = re.captures(output) {
                if let Ok(t) = cap[1].parse::<u64>() {
                    tokens_out = t;
                    found = true;
                    break;
                }
            }
        }

        // Cache read patterns
        let cache_read_patterns = [
            r"(?i)cache(?:d)?(?:_|\s+)?(?:read|input)?(?:(?:_|\s+)?tokens)?:?\s*(\d+)",
            r"(?i)tokens\s+cache(?:d)?\s+read:?\s*(\d+)",
        ];
        for pattern in cache_read_patterns {
            let re = Regex::new(pattern).unwrap();
            if let Some(cap) = re.captures(output) {
                if let Ok(t) = cap[1].parse::<u64>() {
                    tokens_cache_read = t;
                    found = true;
                    break;
                }
            }
        }

        // Cache write patterns
        let cache_write_patterns = [
            r"(?i)cache(?:d)?(?:_|\s+)?(?:creation|write|input)?(?:(?:_|\s+)?tokens)?:?\s*(\d+)",
            r"(?i)tokens\s+cache(?:d)?\s+write:?\s*(\d+)",
        ];
        for pattern in cache_write_patterns {
            let re = Regex::new(pattern).unwrap();
            if let Some(cap) = re.captures(output) {
                if let Ok(t) = cap[1].parse::<u64>() {
                    tokens_cache_write = t;
                    found = true;
                    break;
                }
            }
        }

        // Reasoning patterns
        let reasoning_patterns = [
            r"(?i)(?:reasoning|thinking)(?:(?:_|\s+)?tokens)?:?\s*(\d+)",
        ];
        for pattern in reasoning_patterns {
            let re = Regex::new(pattern).unwrap();
            if let Some(cap) = re.captures(output) {
                if let Ok(t) = cap[1].parse::<u64>() {
                    tokens_reasoning = t;
                    found = true;
                    break;
                }
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
        // Test case 1: Standard format
        let output1 = r#"
Successfully completed tasks.
[using tool attempt_completion: Successfully completed | Cost: 0.15]
Tokens: 1200
output_tokens: 450
"#;
        let meta1 = OutputParserService::parse_generation_metadata(output1).unwrap();
        assert_eq!(meta1.cost_usd, 0.15);
        assert_eq!(meta1.tokens_in, 1200);
        assert_eq!(meta1.tokens_out, 450);

        // Test case 2: Anthropic CLI-like format
        let output2 = r#"
Summary:
Prompt tokens: 1500
Completion tokens: 600
Reasoning tokens: 100
Usage cost: $0.1234
"#;
        let meta2 = OutputParserService::parse_generation_metadata(output2).unwrap();
        assert_eq!(meta2.cost_usd, 0.1234);
        assert_eq!(meta2.tokens_in, 1500);
        assert_eq!(meta2.tokens_out, 600);
        assert_eq!(meta2.tokens_reasoning, 100);

        // Test case 3: Caching format
        let output3 = r#"
Tokens: 2000 in, 800 out
Cache read tokens: 500
Cache write: 100
Cost: 0.05
"#;
        let meta3 = OutputParserService::parse_generation_metadata(output3).unwrap();
        assert_eq!(meta3.tokens_in, 2000);
        assert_eq!(meta3.tokens_out, 800);
        assert_eq!(meta3.tokens_cache_read, 500);
        assert_eq!(meta3.tokens_cache_write, 100);

        // Test case 4: Thinking tokens
        let output4 = r#"
Thinking tokens: 250
"#;
        let meta4 = OutputParserService::parse_generation_metadata(output4).unwrap();
        assert_eq!(meta4.tokens_reasoning, 250);
    }

    #[test]
    fn test_parse_notifications() {
        let output = r#"
I have completed the task.
NOTIFY: Task A is done.
<send_telegram_message>
<message>Task B is also done.</message>
</send_telegram_message>
NOTIFY: One more thing.
<send_whatsapp_message><message>WhatsApp msg</message></send_whatsapp_message>
"#;
        let notifications = OutputParserService::parse_notifications(output);
        assert_eq!(notifications.len(), 4);
        assert_eq!(notifications[0], "Task A is done.");
        assert_eq!(notifications[1], "Task B is also done.");
        assert_eq!(notifications[2], "One more thing.");
        assert_eq!(notifications[3], "WhatsApp msg");
    }
}
