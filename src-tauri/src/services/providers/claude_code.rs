use anyhow::Result;
use async_trait::async_trait;

use crate::models::ai::{ChatResponse, Message, ProviderType, Tool};
use crate::services::ai_provider::AIProvider;

pub struct ClaudeCodeProvider;

impl ClaudeCodeProvider {
    pub fn new() -> Self {
        Self
    }
}

impl Default for ClaudeCodeProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl AIProvider for ClaudeCodeProvider {
    async fn chat(
        &self,
        messages: Vec<Message>,
        system_prompt: Option<String>,
        _tools: Option<Vec<Tool>>,
        project_path: Option<String>,
    ) -> Result<ChatResponse> {
        let mut args = vec!["-p".to_string()];

        if let Some(system) = system_prompt {
            args.push("--append-system-prompt".to_string());
            args.push(system);
        }

        // Claude CLI expects a single prompt string. We need to serialize the conversation history.
        let mut full_prompt = String::new();
        for msg in &messages {
            // Check if we need to add a newline separator
            if !full_prompt.is_empty() {
                full_prompt.push_str("\n\n");
            }

            // Simple formatting - the CLI might have its own preferences but this preserves context
            match msg.role.as_str() {
                "user" => full_prompt.push_str(&format!("User: {}", msg.content)),
                "assistant" => full_prompt.push_str(&format!("Assistant: {}", msg.content)),
                "system" => full_prompt.push_str(&format!("System: {}", msg.content)),
                _ => full_prompt.push_str(&format!("{}: {}", msg.role, msg.content)),
            }
        }

        if full_prompt.is_empty() {
            full_prompt = "Hello".to_string();
        }

        args.push(full_prompt);

        let mut command = tokio::process::Command::new("claude");
        command.args(&args);

        if let Some(path) = project_path {
            command.current_dir(path);
        }

        // Inject MCP secrets using security-first approach
        use crate::services::cli_config_service::CliConfigService;
        if let Ok(secrets) = CliConfigService::collect_mcp_secrets() {
            for (k, v) in secrets {
                command.env(k, v);
            }
        }

        let child = command
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()?;

        // Register for cancellation
        let manager = crate::services::cancellation_service::CANCELLATION_MANAGER.clone();
        manager.register_process("chat".to_string(), child).await;

        // Retrieve process for waiting, but it might have been canceled
        let mut processes = manager.active_processes.lock().await;

        let output = if let Some(child_owned) = processes.remove("chat") {
            // Drop the lock while waiting to avoid deadlocks on double-cancel
            drop(processes); 
            child_owned.wait_with_output().await?
        } else {
            return Err(anyhow::anyhow!("Claude Code CLI was canceled or lost before execution."));
        };

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr).to_string();
            if stderr.is_empty() {
                return Err(anyhow::anyhow!(
                    "Claude Code CLI failed with exit code {}",
                    output.status.code().unwrap_or(-1)
                ));
            }
            return Err(anyhow::anyhow!("Claude Code CLI failed: {}", stderr));
        }

        let content = String::from_utf8_lossy(&output.stdout).to_string();
        if content.is_empty() {
            return Err(anyhow::anyhow!("Claude Code CLI returned empty output"));
        }
        
        Ok(ChatResponse {
            content,
            tool_calls: None,
            metadata: None,
        })
    }

    async fn chat_stream(
        &self,
        messages: Vec<Message>,
        system_prompt: Option<String>,
        _tools: Option<Vec<Tool>>,
        project_path: Option<String>,
    ) -> Result<std::pin::Pin<Box<dyn futures_util::Stream<Item = Result<String>> + Send>>> {
        let mut args = vec!["-p".to_string()];

        if let Some(system) = system_prompt {
            args.push("--append-system-prompt".to_string());
            args.push(system);
        }

        let mut full_prompt = String::new();
        for msg in &messages {
            if !full_prompt.is_empty() {
                full_prompt.push_str("\n\n");
            }
            match msg.role.as_str() {
                "user" => full_prompt.push_str(&format!("User: {}", msg.content)),
                "assistant" => full_prompt.push_str(&format!("Assistant: {}", msg.content)),
                "system" => full_prompt.push_str(&format!("System: {}", msg.content)),
                _ => full_prompt.push_str(&format!("{}: {}", msg.role, msg.content)),
            }
        }

        if full_prompt.is_empty() {
            full_prompt = "Hello".to_string();
        }

        args.push(full_prompt);

        let mut command = tokio::process::Command::new("claude");
        command.args(&args);

        if let Some(path) = project_path {
            command.current_dir(path);
        }

        use crate::services::cli_config_service::CliConfigService;
        if let Ok(secrets) = CliConfigService::collect_mcp_secrets() {
            for (k, v) in secrets {
                command.env(k, v);
            }
        }

        let mut child = command
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()?;

        let stdout = child.stdout.take().ok_or_else(|| anyhow::anyhow!("Failed to capture stdout"))?;
        
        let manager = crate::services::cancellation_service::CANCELLATION_MANAGER.clone();
        manager.register_process("chat".to_string(), child).await;

        let s = async_stream::try_stream! {
            use tokio::io::AsyncReadExt;
            let mut reader = stdout;
            let mut buffer = [0u8; 1024];

            loop {
                let n = reader.read(&mut buffer).await?;
                if n == 0 { break; }
                let text = String::from_utf8_lossy(&buffer[..n]).to_string();
                yield text;
            }
            
            let mut processes = crate::services::cancellation_service::CANCELLATION_MANAGER.active_processes.lock().await;
            processes.remove("chat");
        };

        Ok(Box::pin(s))
    }

    async fn list_models(&self) -> Result<Vec<String>> {
        Ok(vec!["claude-3-5-sonnet".to_string()])
    }

    fn supports_mcp(&self) -> bool {
        true
    }

    fn provider_type(&self) -> ProviderType {
        ProviderType::ClaudeCode
    }
}
