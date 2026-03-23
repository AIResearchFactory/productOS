use anyhow::{anyhow, Result};
use async_trait::async_trait;

use crate::models::ai::{ChatResponse, HostedConfig, ProviderType};
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

use crate::models::ai::chat_models::{ChatRequest, ProviderCapability, ProviderMetadata};

#[async_trait]
impl AIProvider for HostedAPIProvider {
    async fn chat(
        &self,
        request: ChatRequest,
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
            result = service.send_message_sync(request.messages, request.system_prompt, request.tools) => {
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

    async fn chat_stream(
        &self,
        request: ChatRequest,
    ) -> Result<std::pin::Pin<Box<dyn futures_util::Stream<Item = Result<String>> + Send>>> {
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
        let stream = service.send_message_stream(request.messages, request.system_prompt, request.tools).await?;
        Ok(stream)
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

    fn is_available(&self) -> bool {
        // Hosted API is available if an API key can be resolved
        let key = SecretsService::get_secret(&self.config.api_key_secret_id).ok().flatten()
            .or(SecretsService::get_secret("claude_api_key").ok().flatten())
            .or(SecretsService::get_secret("ANTHROPIC_API_KEY").ok().flatten());
        key.is_some()
    }

    async fn check_authentication(&self) -> Result<bool> {
        Ok(self.is_available())
    }

    fn metadata(&self) -> ProviderMetadata {
        ProviderMetadata {
            id: "hosted-api".to_string(),
            name: "Anthropic Hosted API".to_string(),
            description: "Direct connection to Anthropic's Claude models via REST API.".to_string(),
            capabilities: vec![
                ProviderCapability::Chat,
                ProviderCapability::Stream,
                ProviderCapability::Mcp,
            ],
            models: vec![self.config.model.clone()],
        }
    }
}
