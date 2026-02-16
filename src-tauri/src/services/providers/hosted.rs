use async_trait::async_trait;
use anyhow::{Result, anyhow};

use crate::models::ai::{Message, ChatResponse, Tool, ProviderType, HostedConfig};
use crate::services::ai_provider::AIProvider;
use crate::services::secrets_service::SecretsService;
use crate::services::claude_service::ClaudeService;

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
    async fn chat(&self, messages: Vec<Message>, system_prompt: Option<String>, tools: Option<Vec<Tool>>, _project_path: Option<String>) -> Result<ChatResponse> {
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
            m => m
        };

        let service = ClaudeService::new(api_key, model_id.to_string());
        service.send_message_sync(messages, system_prompt, tools).await
    }

    async fn list_models(&self) -> Result<Vec<String>> {
        Ok(vec![self.config.model.clone()])
    }

    fn supports_mcp(&self) -> bool { true }

    fn provider_type(&self) -> ProviderType {
        ProviderType::HostedApi
    }
}
