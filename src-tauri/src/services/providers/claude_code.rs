use anyhow::Result;
use async_trait::async_trait;

use crate::models::ai::{ChatResponse, ProviderType};
use crate::models::ai::chat_models::{ChatRequest, ProviderCapability, ProviderMetadata};
use crate::services::ai_provider::AIProvider;
use crate::services::output_cleaner_service::OutputCleanerService;
use crate::detector::claude_code_detector::ClaudeCodeDetector;
use crate::detector::cli_detector::CliDetector;

pub struct ClaudeCodeProvider;

impl ClaudeCodeProvider {
    pub fn new() -> Self {
        Self
    }

    fn clean_cli_output(output: &str) -> String {
        // Delegate to the shared OutputCleanerService so chat responses and
        // workflow file outputs both use the same cleaning logic.
        OutputCleanerService::clean(output)
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
        request: ChatRequest,
    ) -> Result<ChatResponse> {
        let mut args = vec!["-p".to_string()];

        if let Some(system) = &request.system_prompt {
            args.push("--append-system-prompt".to_string());
            args.push(system.clone());
        }

        let mut full_prompt = String::new();
        for msg in &request.messages {
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

        if let Some(path) = &request.project_path {
            command.current_dir(path);
        }

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

        let manager = crate::services::cancellation_service::CANCELLATION_MANAGER.clone();
        manager.register_process("chat".to_string(), child).await;

        let mut processes = manager.active_processes.lock().await;
        let output = if let Some(child_owned) = processes.remove("chat") {
            drop(processes); 
            child_owned.wait_with_output().await?
        } else {
            return Err(anyhow::anyhow!("Claude Code CLI was canceled or lost before execution."));
        };

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr).to_string();
            return Err(crate::services::ai_error_service::AIErrorService::map_error(
                &stderr,
                &self.provider_type(),
                Some("claude-3-5-sonnet"),
            ));
        }

        let mut content = String::from_utf8_lossy(&output.stdout).to_string();
        if content.is_empty() {
            return Err(anyhow::anyhow!("Claude Code CLI returned empty output"));
        }
        
        content = Self::clean_cli_output(&content);
        
        Ok(ChatResponse {
            content,
            tool_calls: None,
            metadata: None,
        })
    }

    async fn chat_stream(
        &self,
        request: ChatRequest,
    ) -> Result<std::pin::Pin<Box<dyn futures_util::Stream<Item = Result<String>> + Send>>> {
        let mut args = vec!["-p".to_string()];

        if let Some(system) = &request.system_prompt {
            args.push("--append-system-prompt".to_string());
            args.push(system.clone());
        }

        let mut full_prompt = String::new();
        for msg in &request.messages {
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

        // Anti-buffering variables to enforce line-streaming
        command.env("FORCE_COLOR", "1");
        command.env("PYTHONUNBUFFERED", "1");

        if let Some(path) = &request.project_path {
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

    fn is_available(&self) -> bool {
        let _detector = ClaudeCodeDetector::new();
        // Since we are in a sync function but detect is async, we can't easily call it properly if it needs to be sync.
        // However, is_available in AIProvider trait is sync.
        // Let's use a simpler check for is_available (binary exists) and leave full detection for check_authentication or elsewhere.
        crate::utils::env::command_exists("claude") || crate::utils::env::command_exists("claude-code")
    }

    async fn check_authentication(&self) -> Result<bool> {
        let detector = ClaudeCodeDetector::new();
        Ok(detector.check_authentication().await.unwrap_or(false))
    }

    fn metadata(&self) -> ProviderMetadata {
        ProviderMetadata {
            id: "claude-code".to_string(),
            name: "Claude Code".to_string(),
            description: "Anthropic Claude Code CLI with native agentic capabilities.".to_string(),
            capabilities: vec![
                ProviderCapability::Chat,
                ProviderCapability::Stream,
                ProviderCapability::Mcp,
            ],
            models: vec!["claude-3-5-sonnet".to_string()],
        }
    }
}
