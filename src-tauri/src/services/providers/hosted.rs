use anyhow::{anyhow, Result};
use async_trait::async_trait;

use crate::models::ai::{ChatResponse, HostedConfig, Message, ProviderType, Tool};
use crate::services::ai_provider::AIProvider;
use crate::services::claude_service::ClaudeService;
use crate::services::secrets_service::SecretsService;

pub struct HostedAPIProvider {
    pub config: HostedConfig,
}

impl HostedAPIProvider {
    pub fn new(config: HostedConfig) -> Self {
        Self { config }
    }
}

#[async_trait]
impl AIProvider for HostedAPIProvider {
    async fn chat(
        &self,
        messages: Vec<Message>,
        system_prompt: Option<String>,
        tools: Option<Vec<Tool>>,
        _project_path: Option<String>,
    ) -> Result<ChatResponse> {
        let api_key = match SecretsService::get_secret(&self.config.api_key_secret_id)? {
            Some(key) => key,
            None => {
                SecretsService::get_secret("claude_api_key")?
                    .or(SecretsService::get_secret("ANTHROPIC_API_KEY")?)
                    .ok_or_else(|| anyhow!("API key not found. Please ensure 'Anthropic API Key' is set in Settings -> API Configuration."))?
            }
        };

        let model_id = match self.config.model.as_str() {
            "claude-3-opus" => "claude-3-opus-20240229",
            "claude-3-sonnet" => "claude-3-sonnet-20240229",
            "claude-3-haiku" => "claude-3-haiku-20240307",
            "claude-3-5-sonnet" => "claude-3-5-sonnet-20241022",
            m => m,
        };

        let service = ClaudeService::new(api_key, model_id.to_string());
        
        let token = tokio_util::sync::CancellationToken::new();
        crate::services::cancellation_service::CancellationService::global()
            .register_token("chat".to_string(), token.clone())
            .await;

        tokio::select! {
            result = service.send_message_sync(messages, system_prompt, tools) => {
                {
                    let manager = crate::services::cancellation_service::CANCELLATION_MANAGER.clone();
                    let mut tokens = manager.active_tokens.lock().await;
                    tokens.remove("chat");
                }
                result
            }
            _ = token.cancelled() => {
                Err(anyhow!("Claude API execution was cancelled."))
            }
        }
    }

    async fn list_models(&self) -> Result<Vec<String>> {
        Ok(vec![self.config.model.clone()])
    }

    fn supports_mcp(&self) -> bool {
        true
    }

    fn provider_type(&self) -> ProviderType {
        ProviderType::HostedApi
    }
}
