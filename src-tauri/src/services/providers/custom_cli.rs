use async_trait::async_trait;
use anyhow::{Result, anyhow};
use std::process::Stdio;

use crate::models::ai::{Message, ChatResponse, Tool, ProviderType, CustomCliConfig};
use crate::services::ai_provider::AIProvider;
use crate::services::secrets_service::SecretsService;
use crate::services::cli_config_service::{CliConfigService, CliType};

pub struct CustomCliProvider {
    pub config: CustomCliConfig,
}

#[async_trait]
impl AIProvider for CustomCliProvider {
    async fn chat(&self, messages: Vec<Message>, system_prompt: Option<String>, _tools: Option<Vec<Tool>>, project_path: Option<String>) -> Result<ChatResponse> {
        let mut prompt = String::new();
        if let Some(system) = system_prompt {
            prompt.push_str(&system);
            prompt.push_str("\n\n");
        }
        for msg in &messages {
            prompt.push_str(&format!("{}: {}\n", msg.role, msg.content));
        }

        let cmd_parts: Vec<&str> = self.config.command.split_whitespace().collect();
        if cmd_parts.is_empty() {
            return Err(anyhow!("Custom CLI command is empty"));
        }
        
        let mut command = tokio::process::Command::new(cmd_parts[0]);
        if cmd_parts.len() > 1 {
            command.args(&cmd_parts[1..]);
        }
        
        if let Some(path) = &project_path {
            let config_dir = std::path::Path::new(path);
            command.current_dir(config_dir);

            // Handle MCP Configuration if configured
            if let Some(mcp_path) = &self.config.settings_file_path {
                let config_path = CliConfigService::get_cli_config_path(
                    &CliType::Custom(self.config.id.clone()),
                    Some(mcp_path.clone()),
                    config_dir
                );

                // Set MCP Secrets in environment variables (security-first)
                match CliConfigService::collect_mcp_secrets() {
                    Ok(secrets) => {
                        for (k, v) in secrets {
                            command.env(k, v);
                        }
                    }
                    Err(e) => log::warn!("[Custom CLI] Failed to collect MCP secrets: {}", e),
                }

                // Pass config flag if provided
                if let Some(flag) = &self.config.mcp_config_flag {
                    if !flag.is_empty() {
                        command.arg(flag).arg(&config_path);
                    }
                }
            }
        }
        
        let mut command_args = cmd_parts[1..].to_vec();
        command_args.push(&prompt);

        log::info!("[Custom CLI] Executing command: {} with {} total arguments", cmd_parts[0], command_args.len());
        
        // Add API key if configured
        let mut key_set = false;
        if let Some(secret_id) = &self.config.api_key_secret_id {
            if let Ok(Some(key)) = SecretsService::get_secret(secret_id) {
                let env_var = self.config.api_key_env_var.as_deref().unwrap_or("API_KEY");
                let final_env_var = if env_var.is_empty() { "API_KEY" } else { env_var };
                
                command.env(final_env_var, &key);
                log::info!("[Custom CLI] Set API key in environment variable: {}", final_env_var);
                key_set = true;
            }
        }
        
        if !key_set {
            log::info!("[Custom CLI] No API key set for this execution");
        }

        let output = command
            .arg(&prompt)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .output()
            .await?;

        if output.status.success() {
            Ok(ChatResponse {
                content: String::from_utf8_lossy(&output.stdout).to_string(),
                tool_calls: None,
            })
        } else {
            let err = String::from_utf8_lossy(&output.stderr).to_string();
            Err(anyhow!("Custom CLI '{}' error: {}", self.config.name, err))
        }
    }

    async fn list_models(&self) -> Result<Vec<String>> {
        Ok(vec!["default".to_string()])
    }

    fn supports_mcp(&self) -> bool {
        self.config.settings_file_path.is_some()
    }

    fn provider_type(&self) -> ProviderType {
        ProviderType::Custom(format!("custom-{}", self.config.id))
    }
}
