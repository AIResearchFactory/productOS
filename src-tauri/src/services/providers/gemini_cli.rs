use anyhow::{anyhow, Result};
use async_trait::async_trait;
use crate::models::ai::chat_models::{ChatRequest, ProviderCapability, ProviderMetadata};
use crate::models::ai::{ChatResponse, GeminiCliConfig, ProviderType};
use crate::services::ai_provider::AIProvider;
use crate::services::providers::cli_executor::CliExecutor;
use crate::services::secrets_service::SecretsService;
use crate::detector::gemini_detector::GeminiDetector;
use crate::detector::cli_detector::CliDetector;

pub struct GeminiCliProvider {
    pub config: GeminiCliConfig,
}

impl GeminiCliProvider {
    fn format_prompt(&self, request: &ChatRequest) -> String {
        let mut prompt = String::new();
        if let Some(system) = &request.system_prompt {
            prompt.push_str("System Instruction:\n");
            prompt.push_str(system);
            prompt.push_str("\n\n");
        }
        for msg in &request.messages {
            let role = match msg.role.as_str() {
                "user" => "User",
                "assistant" => "Model",
                "system" => "System",
                _ => &msg.role,
            };
            prompt.push_str(&format!("{}: {}\n", role, msg.content));
        }
        prompt
    }
}

#[async_trait]
impl AIProvider for GeminiCliProvider {
    async fn resolve_model(&self) -> String {
        self.config.model_alias.clone()
    }

    async fn chat(
        &self,
        request: ChatRequest,
    ) -> Result<ChatResponse> {
        let prompt = self.format_prompt(&request);
        let api_key = SecretsService::get_secret(&self.config.api_key_secret_id)?
            .or_else(|| SecretsService::get_secret("GEMINI_API_KEY").ok().flatten());
        
        let api_key_env_var = self.config.api_key_env_var.as_ref()
            .filter(|v| !v.is_empty())
            .unwrap_or(&"GEMINI_API_KEY".to_string())
            .clone();

        let mut command = CliExecutor::prepare_command(
            &self.config.command,
            api_key,
            &api_key_env_var,
            request.project_path.as_deref(),
        )?;

        let model = self.resolve_model().await;
        if model != "auto" {
            command.arg("--model").arg(&model);
        }

        command.arg("--prompt").arg(&prompt);
        command.stdout(std::process::Stdio::piped());
        command.stderr(std::process::Stdio::piped());

        let child = command.spawn()?;
        CliExecutor::register_cancellation("chat", child).await;

        let mut processes = crate::services::cancellation_service::CANCELLATION_MANAGER.active_processes.lock().await;
        let output = if let Some(child_owned) = processes.remove("chat") {
            drop(processes);
            child_owned.wait_with_output().await?
        } else {
            return Err(anyhow!("Gemini CLI process was canceled or lost before execution."));
        };

        if output.status.success() {
            let stdout_text = String::from_utf8_lossy(&output.stdout).to_string();
            if stdout_text.trim().is_empty() {
                return Err(anyhow!("Gemini returned an empty response. Please verify authentication/model and retry."));
            }

            let metadata = crate::services::output_parser_service::OutputParserService::parse_generation_metadata(&stdout_text);
            Ok(ChatResponse {
                content: stdout_text,
                tool_calls: None,
                metadata,
            })
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr).to_string();
            Err(CliExecutor::map_error(
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
        let prompt = self.format_prompt(&request);
        let api_key = SecretsService::get_secret(&self.config.api_key_secret_id)?
            .or_else(|| SecretsService::get_secret("GEMINI_API_KEY").ok().flatten());
        
        let cmd_parts: Vec<&str> = self.config.command.split_whitespace().collect();
        let mut command = tokio::process::Command::new(cmd_parts[0]);
        if cmd_parts.len() > 1 {
            command.args(&cmd_parts[1..]);
        }
        
        command.stdin(std::process::Stdio::null());

        if let Some(key) = api_key {
            let env_var = self.config.api_key_env_var.as_ref().filter(|v| !v.is_empty()).unwrap_or(&"GEMINI_API_KEY".to_string()).clone();
            command.env(env_var, key);
        }

        // Anti-buffering variables to enforce line-streaming
        command.env("FORCE_COLOR", "1");
        command.env("PYTHONUNBUFFERED", "1");

        if let Some(path) = &request.project_path {
            command.current_dir(std::path::Path::new(path));
            use crate::services::cli_config_service::CliConfigService;
            if let Ok(secrets) = CliConfigService::collect_mcp_secrets() {
                for (k, v) in secrets {
                    command.env(k, v);
                }
            }
        }

        let model = self.resolve_model().await;
        if model != "auto" {
            command.arg("--model").arg(&model);
        }

        command.arg("--prompt").arg(&prompt);
        command.stdout(std::process::Stdio::piped());
        command.stderr(std::process::Stdio::piped());

        let mut child = command.spawn()?;
        let stdout = child.stdout.take().ok_or_else(|| anyhow!("Failed to capture stdout"))?;
        
        CliExecutor::register_cancellation("chat", child).await;

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
            
            CliExecutor::unregister_cancellation("chat").await;
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
        ProviderType::GeminiCli
    }

    fn is_available(&self) -> bool {
        // Prefer detected path when available, but also support PATH fallback.
        if let Some(path) = &self.config.detected_path {
            if path.exists() {
                return true;
            }
        }

        let cmd_parts: Vec<&str> = self.config.command.split_whitespace().collect();
        let bin = cmd_parts.first().copied().unwrap_or("");
        !bin.is_empty() && crate::utils::env::command_exists(bin)
    }

    async fn check_authentication(&self) -> Result<bool> {
        let detector = GeminiDetector::new();
        Ok(detector.check_authentication().await.unwrap_or(false))
    }

    fn metadata(&self) -> ProviderMetadata {
        ProviderMetadata {
            id: "gemini-cli".to_string(),
            name: "Gemini CLI".to_string(),
            description: "Google Gemini CLI with support for system instructions and high-speed execution.".to_string(),
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
    use crate::models::ai::{GeminiCliConfig, Message};
    use crate::models::ai::chat_models::{ChatOptions, ChatRequest};

    #[tokio::test]
    async fn test_gemini_cli_provider_metadata() {
        let config = GeminiCliConfig {
            command: "echo".to_string(),
            model_alias: "test-model".to_string(),
            api_key_secret_id: "TEST_KEY".to_string(),
            api_key_env_var: None,
            detected_path: None,
        };
        let provider = GeminiCliProvider {
            config: config.clone(),
        };

        assert_eq!(provider.provider_type(), ProviderType::GeminiCli);
        assert_eq!(provider.supports_mcp(), true);

        let models = provider.list_models().await.unwrap();
        assert_eq!(models, vec!["test-model".to_string()]);
    }

    #[tokio::test]
    async fn test_gemini_cli_provider_chat_failure_no_key() {
        let config = GeminiCliConfig {
            command: "false".to_string(), // Use 'false' command which always fails
            model_alias: "test-model".to_string(),
            api_key_secret_id: "NON_EXISTENT_KEY".to_string(),
            api_key_env_var: None,
            detected_path: None,
        };
        let provider = GeminiCliProvider { config };
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

        let result = provider.chat(request).await;
        // The command will fail, so we expect an error
        assert!(result.is_err());
    }
}

