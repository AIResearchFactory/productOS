use crate::models::chat::ChatMessage;
use anyhow::{Context, Result};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Write;
use std::path::PathBuf;
use tempfile::NamedTempFile;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ChatMetadata {
    pub created: String,
    pub model: String,
    pub message_count: usize,
}

pub struct ChatService;

impl ChatService {
    /// Save chat conversation to markdown file
    pub async fn save_chat_to_file(
        project_id: &str,
        messages: Vec<ChatMessage>,
        model: &str,
    ) -> Result<String> {
        let chat_dir = Self::get_chat_directory(project_id)?;
        fs::create_dir_all(&chat_dir).context("Failed to create chat directory")?;

        let timestamp = Utc::now();
        let file_prefix = format!("chat_{}", timestamp.format("%Y%m%d_%H%M%S"));
        let md_file_name = format!("{}.md", file_prefix);
        let md_file_path = chat_dir.join(&md_file_name);

        // 1. Save Content (Pure Markdown)
        let md_content = Self::format_chat_markdown(&messages);
        let mut temp_md =
            NamedTempFile::new_in(&chat_dir).context("Failed to create temporary file for chat")?;
        temp_md.write_all(md_content.as_bytes())?;
        temp_md.persist(&md_file_path)?;

        // 2. Save Metadata (JSON Sidecar)
        let metadata_dir = chat_dir.join(".metadata").join("chats");
        fs::create_dir_all(&metadata_dir)?;
        let metadata_path = metadata_dir.join(format!("{}.json", file_prefix));

        let metadata = ChatMetadata {
            created: timestamp.to_rfc3339(),
            model: model.to_string(),
            message_count: messages.len(),
        };
        let meta_json = serde_json::to_string_pretty(&metadata)?;
        fs::write(metadata_path, meta_json)?;

        Ok(md_file_name)
    }

    /// Get the chat directory for a project
    fn get_chat_directory(project_id: &str) -> Result<PathBuf> {
        let base_dir = crate::utils::paths::get_app_data_dir()?;
        Ok(base_dir.join(project_id).join("chats"))
    }

    /// Format chat messages as markdown (Pure content, no frontmatter)
    fn format_chat_markdown(messages: &[ChatMessage]) -> String {
        let mut content = String::from("# Conversation\n\n");

        for message in messages {
            let role = if message.role == "user" {
                "User"
            } else {
                "Assistant"
            };
            content.push_str(&format!("## {}\n", role));
            content.push_str(&message.content);
            content.push_str("\n\n");
        }

        content
    }

    /// Load chat history from a file
    pub async fn load_chat_from_file(
        project_id: &str,
        file_name: &str,
    ) -> Result<Vec<ChatMessage>> {
        let chat_dir = Self::get_chat_directory(project_id)?;
        let file_path = chat_dir.join(file_name);

        let content = fs::read_to_string(&file_path).context("Failed to read chat file")?;

        // Note: Metadata loading can be added here if needed for the UI,
        // but this method only returns messages.
        Self::parse_chat_markdown(&content)
    }

    /// Parse chat messages from markdown
    fn parse_chat_markdown(content: &str) -> Result<Vec<ChatMessage>> {
        let mut messages = Vec::new();
        let mut current_role: Option<String> = None;
        let mut current_content = String::new();
        let mut in_conversation = false;

        for line in content.lines() {
            // Skip frontmatter
            if line.trim() == "---" {
                continue;
            }

            // Start of conversation section
            if line.trim() == "# Conversation" {
                in_conversation = true;
                continue;
            }

            if !in_conversation {
                continue;
            }

            // Check for message headers
            if line.starts_with("## User") {
                // Save previous message if any
                if let Some(role) = current_role.take() {
                    messages.push(ChatMessage {
                        role,
                        content: current_content.trim().to_string(),
                    });
                    current_content.clear();
                }
                current_role = Some("user".to_string());
            } else if line.starts_with("## Assistant") {
                // Save previous message if any
                if let Some(role) = current_role.take() {
                    messages.push(ChatMessage {
                        role,
                        content: current_content.trim().to_string(),
                    });
                    current_content.clear();
                }
                current_role = Some("assistant".to_string());
            } else if current_role.is_some() {
                // Accumulate message content
                if !current_content.is_empty() {
                    current_content.push('\n');
                }
                current_content.push_str(line);
            }
        }

        // Save the last message
        if let Some(role) = current_role {
            messages.push(ChatMessage {
                role,
                content: current_content.trim().to_string(),
            });
        }

        Ok(messages)
    }

    /// Get list of chat files for a project
    pub async fn get_chat_files(project_id: &str) -> Result<Vec<String>> {
        let chat_dir = Self::get_chat_directory(project_id)?;

        if !chat_dir.exists() {
            return Ok(Vec::new());
        }

        let mut files = Vec::new();
        for entry in fs::read_dir(&chat_dir).context("Failed to read chat directory")? {
            let entry = entry.context("Failed to read directory entry")?;
            let path = entry.path();
            if path.is_file() && path.extension().is_some_and(|ext| ext == "md") {
                if let Some(file_name) = path.file_name() {
                    files.push(file_name.to_string_lossy().to_string());
                }
            }
        }

        // Sort files by name (newest first due to timestamp format)
        files.sort_by(|a, b| b.cmp(a));

        Ok(files)
    }
}
