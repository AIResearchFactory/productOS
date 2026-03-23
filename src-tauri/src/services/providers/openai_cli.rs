use async_trait::async_trait;
use anyhow::{Result, anyhow};

use crate::models::ai::{ChatResponse, ProviderType, OpenAiCliConfig};
use crate::services::ai_provider::AIProvider;
use crate::services::secrets_service::SecretsService;

pub struct OpenAiCliProvider {
    pub config: OpenAiCliConfig,
}

/// Resolve API key from configured secret id or OPENAI_API_KEY fallback.
fn resolve_bearer_token(config: &OpenAiCliConfig) -> Option<String> {
    if let Ok(Some(key)) = SecretsService::get_secret(&config.api_key_secret_id) {
        if !key.trim().is_empty() {
            return Some(key);
        }
    }
    if let Ok(Some(key)) = SecretsService::get_secret("OPENAI_API_KEY") {
        if !key.trim().is_empty() {
            return Some(key);
        }
    }
    None
}

/// Check whether a CLI binary is available on PATH.
fn binary_exists(bin: &str) -> bool {
    crate::utils::env::command_exists(bin)
}

use crate::models::ai::chat_models::{ChatRequest, ProviderCapability, ProviderMetadata};

#[async_trait]
impl AIProvider for OpenAiCliProvider {
    async fn resolve_model(&self) -> String {
        self.config.model_alias.clone()
    }

    async fn chat(&self, request: ChatRequest) -> Result<ChatResponse> {
        let mut combined_prompt = String::new();
        if let Some(system) = &request.system_prompt {
            combined_prompt.push_str(&format!("System: {}\n\n", system));
        }
        for msg in &request.messages {
            combined_prompt.push_str(&format!("{}: {}\n", msg.role, msg.content));
        }

        if combined_prompt.trim().is_empty() {
            return Err(anyhow!("OpenAI request was empty."));
        }

        let cmd_parts: Vec<&str> = self.config.command.split_whitespace().collect();
        let bin = cmd_parts.first().copied().unwrap_or("");

        if bin.is_empty() || !binary_exists(bin) {
            return Err(anyhow!("OpenAI/Codex CLI not found."));
        }

        let api_key = resolve_bearer_token(&self.config);
        let api_key_env_var = self.config.api_key_env_var.as_deref().unwrap_or("OPENAI_API_KEY");

        let mut command = crate::services::providers::cli_executor::CliExecutor::prepare_command(
            &self.config.command,
            api_key,
            api_key_env_var,
            request.project_path.as_deref(),
        )?;
        
        let resolved_model = self.resolve_model().await;
        let mapped_model = if bin.eq_ignore_ascii_case("codex") {
            resolved_model
        } else {
            resolved_model
        };

        if cmd_parts[0].eq_ignore_ascii_case("codex") {
            command.arg("exec")
                   .arg("--skip-git-repo-check")
                   .arg("-c")
                   .arg("model_provider_options.store=false");
            
            if mapped_model != "auto" {
                command.arg("--model").arg(&mapped_model);
            }
            command.arg(&combined_prompt);
        } else {
            if mapped_model != "auto" {
                command.arg("--model").arg(&mapped_model);
            }
            command.arg("--prompt").arg(&combined_prompt);
        }

        let output = command.output().await?;

        if output.status.success() {
            let content = String::from_utf8_lossy(&output.stdout).to_string();
            let metadata = crate::services::output_parser_service::OutputParserService::parse_generation_metadata(&content);
            Ok(ChatResponse {
                content,
                tool_calls: None,
                metadata,
            })
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr).to_string();
            Err(crate::services::providers::cli_executor::CliExecutor::map_error(
                &stderr,
                &self.provider_type(),
                Some(&self.config.model_alias),
            ))
        }
    }

    async fn chat_stream(
        &self,
        request: ChatRequest,
    ) -> Result<std::pin::Pin<Box<dyn futures_util::Stream<Item = Result<String>> + Send>>> {
        let mut combined_prompt = String::new();
        if let Some(system) = &request.system_prompt {
            combined_prompt.push_str(&format!("System: {}\n\n", system));
        }
        for msg in &request.messages {
            combined_prompt.push_str(&format!("{}: {}\n", msg.role, msg.content));
        }

        if combined_prompt.trim().is_empty() {
            return Err(anyhow!("OpenAI request was empty."));
        }

        let cmd_parts: Vec<&str> = self.config.command.split_whitespace().collect();
        let bin = cmd_parts.first().copied().unwrap_or("");

        if bin.is_empty() || !binary_exists(bin) {
            return Err(anyhow!("OpenAI/Codex CLI not found."));
        }

        let api_key = resolve_bearer_token(&self.config);
        let api_key_env_var = self.config.api_key_env_var.as_deref().unwrap_or("OPENAI_API_KEY");

        let mut command = crate::services::providers::cli_executor::CliExecutor::prepare_command(
            &self.config.command,
            api_key,
            api_key_env_var,
            request.project_path.as_deref(),
        )?;
        
        let resolved_model = self.resolve_model().await;
        let mapped_model = if bin.eq_ignore_ascii_case("codex") {
            resolved_model
        } else {
            resolved_model
        };

        if cmd_parts[0].eq_ignore_ascii_case("codex") {
            command.arg("exec")
                   .arg("--skip-git-repo-check")
                   .arg("-c")
                   .arg("model_provider_options.store=false");
            
            if mapped_model != "auto" {
                command.arg("--model").arg(&mapped_model);
            }
            command.arg("--stream");
            command.arg(&combined_prompt);
        } else {
            if mapped_model != "auto" {
                command.arg("--model").arg(&mapped_model);
            }
            command.arg("--stream");
            command.arg("--prompt").arg(&combined_prompt);
        }

        command.stdout(std::process::Stdio::piped());
        command.stderr(std::process::Stdio::piped());

        let mut child = command.spawn()?;
        let stdout = child.stdout.take().ok_or_else(|| anyhow!("Failed to capture stdout"))?;
        
        crate::services::providers::cli_executor::CliExecutor::register_cancellation("chat_openai", child).await;

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
            
            crate::services::providers::cli_executor::CliExecutor::unregister_cancellation("chat_openai").await;
        };

        Ok(Box::pin(s))
    }

    async fn list_models(&self) -> Result<Vec<String>> {
        Ok(vec![self.config.model_alias.clone()])
    }

    fn supports_mcp(&self) -> bool {
        true
    }

    fn provider_type(&self) -> ProviderType {
        ProviderType::OpenAiCli
    }

    fn is_available(&self) -> bool {
        let cmd_parts: Vec<&str> = self.config.command.split_whitespace().collect();
        let bin = cmd_parts.first().copied().unwrap_or("");
        !bin.is_empty() && binary_exists(bin)
    }

    async fn check_authentication(&self) -> Result<bool> {
        // Prefer explicit API key check, but allow CLI-session based auth flows.
        if resolve_bearer_token(&self.config).is_some() {
            return Ok(true);
        }

        // If CLI exists, treat auth as potentially available and let execution return
        // actionable errors (e.g., login required) instead of hiding provider in UI.
        Ok(self.is_available())
    }

    fn metadata(&self) -> ProviderMetadata {
        ProviderMetadata {
            id: "openai-cli".to_string(),
            name: "OpenAI CLI".to_string(),
            description: "OpenAI CLI or Codex CLI for GPT-based models.".to_string(),
            capabilities: vec![
                ProviderCapability::Chat,
                ProviderCapability::Stream,
                ProviderCapability::Mcp,
            ],
            models: vec![self.config.model_alias.clone()],
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::ai::{OpenAiCliConfig, Message};
    use crate::models::ai::chat_models::{ChatOptions, ChatRequest};

    #[tokio::test]
    async fn test_openai_cli_provider_metadata() {
        let config = OpenAiCliConfig {
            command: "echo".to_string(),
            model_alias: "gpt-4o".to_string(),
            api_key_secret_id: "TEST_KEY".to_string(),
            api_key_env_var: None,
            detected_path: None,
        };
        let provider = OpenAiCliProvider { config: config.clone() };
        
        assert_eq!(provider.provider_type(), ProviderType::OpenAiCli);
        assert_eq!(provider.supports_mcp(), true);
        
        let models = provider.list_models().await.unwrap();
        assert_eq!(models, vec!["gpt-4o".to_string()]);
    }

    #[tokio::test]
    async fn test_openai_cli_provider_chat_failure() {
        let config = OpenAiCliConfig {
            command: "false".to_string(), // Use 'false' command which always fails
            model_alias: "gpt-4o".to_string(),
            api_key_secret_id: "NON_EXISTENT_KEY".to_string(),
            api_key_env_var: None,
            detected_path: None,
        };
        let provider = OpenAiCliProvider { config };
        let request = ChatRequest {
            messages: vec![Message { 
                role: "user".to_string(), 
                content: "hello".to_string(),
                tool_calls: None,
                tool_results: None,
            }],
            system_prompt: None,
            tools: None,
            project_path: None,
            options: ChatOptions::default(),
        };
        
        // No system prompt, no tools, no project path
        let result = provider.chat(request).await;
        // The command will fail, so we expect an error
        assert!(result.is_err());
    }
}


