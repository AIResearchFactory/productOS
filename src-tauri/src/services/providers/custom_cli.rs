use anyhow::{anyhow, Result};
use async_trait::async_trait;
use crate::models::ai::chat_models::{ChatRequest, ProviderCapability, ProviderMetadata};
use crate::models::ai::{ChatResponse, CustomCliConfig, ProviderType};
use crate::services::ai_provider::AIProvider;
use crate::services::cli_config_service::{CliConfigService, CliType};
use crate::services::secrets_service::SecretsService;
use crate::services::providers::cli_executor::CliExecutor;

pub struct CustomCliProvider {
    pub config: CustomCliConfig,
}

impl CustomCliProvider {
    fn format_prompt(&self, request: &ChatRequest) -> String {
        let mut prompt = String::new();
        if let Some(system) = &request.system_prompt {
            prompt.push_str(system);
            prompt.push_str("\n\n");
        }
        for msg in &request.messages {
            prompt.push_str(&format!("{}: {}\n", msg.role, msg.content));
        }
        prompt
    }
}

#[async_trait]
impl AIProvider for CustomCliProvider {
    async fn chat(
        &self,
        request: ChatRequest,
    ) -> Result<ChatResponse> {
        let prompt = self.format_prompt(&request);
        let api_key = if let Some(secret_id) = &self.config.api_key_secret_id {
            SecretsService::get_secret(secret_id).ok().flatten()
        } else {
            None
        };

        let env_var = self.config.api_key_env_var.as_deref().unwrap_or("API_KEY");
        let final_env_var = if env_var.is_empty() { "API_KEY" } else { env_var };

        let mut command = CliExecutor::prepare_command(
            &self.config.command,
            api_key,
            final_env_var,
            request.project_path.as_deref(),
        )?;

        // Specific Custom CLI logic for MCP config flag
        if let Some(project_path) = &request.project_path {
            if let Some(mcp_path) = &self.config.settings_file_path {
                let config_dir = std::path::Path::new(project_path);
                let config_path = CliConfigService::get_cli_config_path(
                    &CliType::Custom(self.config.id.clone()),
                    Some(mcp_path.clone()),
                    config_dir,
                );

                if let Some(flag) = &self.config.mcp_config_flag {
                    if !flag.is_empty() {
                        command.arg(flag).arg(&config_path);
                    }
                }
            }
        }

        command.arg(&prompt);
        command.stdout(std::process::Stdio::piped());
        command.stderr(std::process::Stdio::piped());

        let child = command.spawn()?;
        CliExecutor::register_cancellation("chat", child).await;

        let mut processes = crate::services::cancellation_service::CANCELLATION_MANAGER.active_processes.lock().await;
        let output = if let Some(child_owned) = processes.remove("chat") {
            drop(processes);
            child_owned.wait_with_output().await?
        } else {
            return Err(anyhow!("Custom CLI process was canceled or lost before execution."));
        };

        if output.status.success() {
            let content = String::from_utf8_lossy(&output.stdout).to_string();
            let metadata = crate::services::output_parser_service::OutputParserService::parse_generation_metadata(&content);
            Ok(ChatResponse {
                content,
                tool_calls: None,
                metadata,
            })
        } else {
            let err = String::from_utf8_lossy(&output.stderr).to_string();
            Err(CliExecutor::map_error(&err, &self.provider_type(), Some("default")))
        }
    }

    async fn chat_stream(
        &self,
        request: ChatRequest,
    ) -> Result<std::pin::Pin<Box<dyn futures_util::Stream<Item = Result<String>> + Send>>> {
        let prompt = self.format_prompt(&request);
        let api_key = if let Some(secret_id) = &self.config.api_key_secret_id {
            SecretsService::get_secret(secret_id).ok().flatten()
        } else {
            None
        };

        let env_var = self.config.api_key_env_var.as_deref().unwrap_or("API_KEY");
        let final_env_var = if env_var.is_empty() { "API_KEY" } else { env_var };

        let mut command = CliExecutor::prepare_command(
            &self.config.command,
            api_key,
            final_env_var,
            request.project_path.as_deref(),
        )?;

        if let Some(project_path) = &request.project_path {
            if let Some(mcp_path) = &self.config.settings_file_path {
                let config_dir = std::path::Path::new(project_path);
                let config_path = CliConfigService::get_cli_config_path(
                    &CliType::Custom(self.config.id.clone()),
                    Some(mcp_path.clone()),
                    config_dir,
                );

                if let Some(flag) = &self.config.mcp_config_flag {
                    if !flag.is_empty() {
                        command.arg(flag).arg(&config_path);
                    }
                }
            }
        }

        let mut child = command
            .arg(&prompt)
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()?;

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
        Ok(vec!["default".to_string()])
    }

    fn supports_mcp(&self) -> bool {
        self.config.settings_file_path.is_some()
    }

    fn provider_type(&self) -> ProviderType {
        ProviderType::Custom(format!("custom-{}", self.config.id))
    }

    fn is_available(&self) -> bool {
        self.config.is_configured
    }

    async fn check_authentication(&self) -> Result<bool> {
        // For custom CLI, we assume if it's configured and optionally has a key, it's "authenticated"
        if let Some(secret_id) = &self.config.api_key_secret_id {
            if secret_id.is_empty() {
                return Ok(true);
            }
            Ok(crate::services::secrets_service::SecretsService::get_secret(secret_id).unwrap_or(None).is_some())
        } else {
            Ok(true)
        }
    }

    fn metadata(&self) -> ProviderMetadata {
        let mut capabilities = vec![
            ProviderCapability::Chat,
            ProviderCapability::Stream,
        ];
        if self.supports_mcp() {
            capabilities.push(ProviderCapability::Mcp);
        }

        ProviderMetadata {
            id: format!("custom-{}", self.config.id),
            name: self.config.name.clone(),
            description: format!("Custom CLI provider for {}", self.config.name),
            capabilities,
            models: vec!["default".to_string()],
        }
    }
}
