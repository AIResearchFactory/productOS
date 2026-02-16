use async_trait::async_trait;
use anyhow::{Result, anyhow};

use crate::models::ai::{Message, ChatResponse, Tool, ProviderType, GeminiCliConfig};
use crate::services::ai_provider::AIProvider;
use crate::services::secrets_service::SecretsService;
use crate::services::cli_config_service::{CliConfigService, CliType};

pub struct GeminiCliProvider {
    pub config: GeminiCliConfig,
}

#[async_trait]
impl AIProvider for GeminiCliProvider {
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
            .or_else(|| SecretsService::get_secret("GEMINI_API_KEY").ok().flatten());

        let cmd_parts: Vec<&str> = self.config.command.split_whitespace().collect();
        if cmd_parts.is_empty() {
            return Err(anyhow!("Gemini CLI command is empty"));
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
                    command.env("GEMINI_API_KEY", key);
                }
            } else {
                command.env("GEMINI_API_KEY", key);
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
                Err(e) => log::warn!("[Gemini CLI] Failed to collect MCP secrets: {}", e),
            }
        }
        
        log::info!("[Gemini CLI] Executing command: {} with model alias: {}", cmd_parts[0], self.config.model_alias);
        
        let output = command
            .arg("--model")
            .arg(&self.config.model_alias)
            .arg("--prompt")
            .arg(&prompt)
            .output()
            .await?;

        if output.status.success() {
            Ok(ChatResponse {
                content: String::from_utf8_lossy(&output.stdout).to_string(),
                tool_calls: None,
            })
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr).to_string();
            // Filter out common noise like [WARN] skipping directories
            let filtered_err: Vec<&str> = stderr.lines()
                .filter(|line| !line.contains("[WARN] Skipping unreadable directory"))
                .filter(|line| !line.is_empty())
                .collect();
            
            let err_msg = if filtered_err.is_empty() {
                stderr
            } else {
                filtered_err.join("\n")
            };

            if err_msg.contains("429") || err_msg.contains("RESOURCE_EXHAUSTED") || err_msg.contains("No capacity available") {
                Err(anyhow!("Gemini API capacity exhausted (429). Try switching to a different model like 'flash' in Chat settings.\n\nDetails: {}", err_msg))
            } else if err_msg.contains("ModelNotFoundError") || err_msg.contains("entity was not found") || err_msg.contains("404") {
                Err(anyhow!("Gemini model not found (404). Your model alias '{}' might be invalid or deprecated.\n\nDetails: {}", self.config.model_alias, err_msg))
            } else {
                Err(anyhow!("Gemini CLI error: {}", err_msg))
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
        ProviderType::GeminiCli
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::ai::{GeminiCliConfig, Message};

    #[tokio::test]
    async fn test_gemini_cli_provider_metadata() {
        let config = GeminiCliConfig {
            command: "echo".to_string(),
            model_alias: "test-model".to_string(),
            api_key_secret_id: "TEST_KEY".to_string(),
            api_key_env_var: None,
            detected_path: None,
        };
        let provider = GeminiCliProvider { config: config.clone() };
        
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
        let messages = vec![Message { 
            role: "user".to_string(), 
            content: "hello".to_string(),
            tool_calls: None,
            tool_results: None,
        }];
        
        let result = provider.chat(messages, None, None, None).await;
        // The command will fail, so we expect an error
        assert!(result.is_err());
    }
}
