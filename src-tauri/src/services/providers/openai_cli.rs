use async_trait::async_trait;
use anyhow::{Result, anyhow};

use crate::models::ai::{Message, ChatResponse, Tool, ProviderType, OpenAiCliConfig};
use crate::services::ai_provider::AIProvider;
use crate::services::secrets_service::SecretsService;
use crate::services::cli_config_service::CliConfigService;

pub struct OpenAiCliProvider {
    pub config: OpenAiCliConfig,
}

#[async_trait]
impl AIProvider for OpenAiCliProvider {
    async fn chat(&self, messages: Vec<Message>, system_prompt: Option<String>, _tools: Option<Vec<Tool>>, project_path: Option<String>) -> Result<ChatResponse> {
        let mut prompt = String::new();
        if let Some(system) = system_prompt {
            prompt.push_str(&system);
            prompt.push_str("\n\n");
        }
        for msg in &messages {
            prompt.push_str(&format!("{}: {}\n", msg.role, msg.content));
        }

        let api_key = SecretsService::get_secret(&self.config.api_key_secret_id)?
            .or_else(|| SecretsService::get_secret("OPENAI_API_KEY").ok().flatten());

        let cmd_parts: Vec<&str> = self.config.command.split_whitespace().collect();
        if cmd_parts.is_empty() {
            return Err(anyhow!("OpenAI CLI command is empty"));
        }
        
        let mut command = tokio::process::Command::new(cmd_parts[0]);
        if cmd_parts.len() > 1 {
            command.args(&cmd_parts[1..]);
        }
        if let Some(key) = api_key {
            if let Some(env_var) = &self.config.api_key_env_var {
                if !env_var.is_empty() {
                    command.env(env_var, key);
                } else {
                    command.env("OPENAI_API_KEY", key);
                }
            } else {
                command.env("OPENAI_API_KEY", key);
            }
        }
        
        if let Some(path) = &project_path {
            let config_dir = std::path::Path::new(path);
            command.current_dir(config_dir);

            // Set MCP Secrets in environment variables (security-first approach)
            match CliConfigService::collect_mcp_secrets() {
                Ok(secrets) => {
                    for (k, v) in secrets {
                        command.env(k, v);
                    }
                }
                Err(e) => log::warn!("[OpenAI CLI] Failed to collect MCP secrets: {}", e),
            }
        }
        
        log::info!("[OpenAI CLI] Executing command: {} with model alias: {}", cmd_parts[0], self.config.model_alias);
        
        // Support both legacy openai-style CLIs and Codex CLI syntax
        // - codex: codex exec --model <model> <prompt>
        // - openai: openai --model <model> --prompt <prompt>
        let output = if cmd_parts[0].eq_ignore_ascii_case("codex") {
            command
                .arg("exec")
                .arg("--model")
                .arg(&self.config.model_alias)
                .arg(&prompt)
                .output()
                .await?
        } else {
            command
                .arg("--model")
                .arg(&self.config.model_alias)
                .arg("--prompt")
                .arg(&prompt)
                .output()
                .await?
        };

        if output.status.success() {
            Ok(ChatResponse {
                content: String::from_utf8_lossy(&output.stdout).to_string(),
                tool_calls: None,
                metadata: None,
            })
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr).to_string();
            // Filter out common noise
            let filtered_err: Vec<&str> = stderr.lines()
                .filter(|line| !line.is_empty())
                .collect();
            
            let err_msg = if filtered_err.is_empty() {
                stderr
            } else {
                filtered_err.join("\n")
            };

            if err_msg.contains("429") || err_msg.contains("insufficient_quota") || err_msg.contains("exceeded your current quota") {
                Err(anyhow!("OpenAI API capacity exhausted (429). Check your billing dashboard.\n\nDetails: {}", err_msg))
            } else if err_msg.contains("404") || err_msg.contains("model_not_found") {
                Err(anyhow!("OpenAI model not found (404). Your model alias '{}' might be invalid.\n\nDetails: {}", self.config.model_alias, err_msg))
            } else {
                Err(anyhow!("OpenAI CLI error: {}", err_msg))
            }
        }
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

    async fn chat_stream(
        &self,
        messages: Vec<Message>,
        system_prompt: Option<String>,
        _tools: Option<Vec<Tool>>,
        project_path: Option<String>,
    ) -> Result<std::pin::Pin<Box<dyn futures_util::Stream<Item = Result<String>> + Send>>> {
        let mut prompt = String::new();
        if let Some(system) = system_prompt {
            prompt.push_str(&system);
            prompt.push_str("\n\n");
        }
        for msg in &messages {
            prompt.push_str(&format!("{}: {}\n", msg.role, msg.content));
        }

        let api_key = SecretsService::get_secret(&self.config.api_key_secret_id)?
            .or_else(|| SecretsService::get_secret("OPENAI_API_KEY").ok().flatten());

        let cmd_parts: Vec<&str> = self.config.command.split_whitespace().collect();
        if cmd_parts.is_empty() {
            return Err(anyhow!("OpenAI CLI command is empty"));
        }
        
        let mut command = tokio::process::Command::new(cmd_parts[0]);
        if cmd_parts.len() > 1 {
            command.args(&cmd_parts[1..]);
        }
        if let Some(key) = api_key {
            if let Some(env_var) = &self.config.api_key_env_var {
                if !env_var.is_empty() {
                    command.env(env_var, key);
                } else {
                    command.env("OPENAI_API_KEY", key);
                }
            } else {
                command.env("OPENAI_API_KEY", key);
            }
        }
        
        if let Some(path) = &project_path {
            let config_dir = std::path::Path::new(path);
            command.current_dir(config_dir);

            match CliConfigService::collect_mcp_secrets() {
                Ok(secrets) => {
                    for (k, v) in secrets {
                        command.env(k, v);
                    }
                }
                Err(e) => log::warn!("[OpenAI CLI] Failed to collect MCP secrets: {}", e),
            }
        }
        
        let mut child = if cmd_parts[0].eq_ignore_ascii_case("codex") {
            command
                .arg("exec")
                .arg("--model")
                .arg(&self.config.model_alias)
                .arg(&prompt)
                .stdout(std::process::Stdio::piped())
                .stderr(std::process::Stdio::piped())
                .spawn()?
        } else {
            command
                .arg("--model")
                .arg(&self.config.model_alias)
                .arg("--prompt")
                .arg(&prompt)
                .stdout(std::process::Stdio::piped())
                .stderr(std::process::Stdio::piped())
                .spawn()?
        };

        let stdout = child.stdout.take().ok_or_else(|| anyhow!("Failed to capture stdout"))?;
        
        // Register for cancellation
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
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::ai::{OpenAiCliConfig, Message};

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
        let messages = vec![Message { 
            role: "user".to_string(), 
            content: "hello".to_string(),
            tool_calls: None,
            tool_results: None,
        }];
        
        // No system prompt, no tools, no project path
        let result = provider.chat(messages, None, None, None).await;
        // The command will fail, so we expect an error
        // Either command not found or exit status 1
        assert!(result.is_err());
    }
}
