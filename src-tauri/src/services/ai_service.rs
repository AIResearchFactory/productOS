use anyhow::{anyhow, Result};
use std::sync::Arc;
use tokio::sync::RwLock;

use crate::models::ai::{ChatResponse, ProviderType};
use crate::services::ai_provider::AIProvider;
use crate::services::settings_service::SettingsService;

// Import our new decoupled providers
use crate::services::providers::claude_code::ClaudeCodeProvider;
use crate::services::providers::custom_cli::CustomCliProvider;
use crate::services::providers::gemini_cli::GeminiCliProvider;
use crate::services::providers::hosted::HostedAPIProvider;
use crate::services::providers::litellm::LiteLlmProvider;
use crate::services::providers::ollama::OllamaProvider;
use crate::services::providers::openai_cli::OpenAiCliProvider;

pub struct AIService {
    active_provider: RwLock<Arc<dyn AIProvider>>,
    mcp_service: crate::services::mcp_service::McpService,
}

impl AIService {
    pub async fn new() -> Result<Self> {
        log::info!("Initializing AI Service...");
        let settings = SettingsService::load_global_settings().map_err(|e| {
            log::error!("Failed to load global settings: {}", e);
            anyhow!("Failed to load settings: {}", e)
        })?;

        let provider = Self::create_provider(&settings.active_provider, &settings)?;
        log::info!(
            "AI Service initialized with provider: {:?}",
            settings.active_provider
        );

        Ok(Self {
            active_provider: RwLock::new(Arc::from(provider)),
            mcp_service: crate::services::mcp_service::McpService::new(),
        })
    }

    pub async fn supports_mcp(&self) -> bool {
        self.active_provider.read().await.supports_mcp()
    }

    pub async fn get_mcp_tools(&self) -> Result<Vec<crate::services::mcp_service::McpTool>> {
        self.mcp_service.get_tools().await
    }

    pub fn create_provider(
        provider_type: &ProviderType,
        settings: &crate::models::settings::GlobalSettings,
    ) -> Result<Box<dyn AIProvider>> {
        log::debug!("Creating provider for type: {:?}", provider_type);
        let provider: Box<dyn AIProvider> = match provider_type {
            ProviderType::Ollama => {
                log::info!(
                    "Initializing Ollama provider with model: {}",
                    settings.ollama.model
                );
                Box::new(OllamaProvider::new(settings.ollama.clone()))
            }
            ProviderType::ClaudeCode => {
                log::info!("Initializing Claude Code provider");
                Box::new(ClaudeCodeProvider::new())
            }
            ProviderType::HostedApi => {
                log::info!(
                    "Initializing Hosted API provider with model: {}",
                    settings.hosted.model
                );
                Box::new(HostedAPIProvider::new(settings.hosted.clone()))
            }
            ProviderType::GeminiCli => {
                log::info!(
                    "Initializing Gemini CLI provider with model alias: {}",
                    settings.gemini_cli.model_alias
                );
                Box::new(GeminiCliProvider {
                    config: settings.gemini_cli.clone(),
                })
            }
            ProviderType::OpenAiCli => {
                log::info!(
                    "Initializing OpenAI CLI provider with model alias: {}",
                    settings.openai_cli.model_alias
                );
                Box::new(OpenAiCliProvider {
                    config: settings.openai_cli.clone(),
                })
            }
            ProviderType::LiteLlm => {
                log::info!(
                    "Initializing LiteLLM provider with base URL: {}",
                    settings.litellm.base_url
                );
                Box::new(LiteLlmProvider::new(settings.litellm.clone()))
            }
            ProviderType::Custom(id) => {
                let id_to_find = if let Some(stripped) = id.strip_prefix("custom-") {
                    stripped
                } else {
                    id
                };
                log::info!("Initializing Custom CLI provider: {}", id_to_find);
                if let Some(config) = settings.custom_clis.iter().find(|c| c.id == id_to_find) {
                    Box::new(CustomCliProvider {
                        config: config.clone(),
                    })
                } else if let Some(config) = settings.custom_clis.first() {
                    log::warn!(
                        "Custom CLI ID {} not found, falling back to first available custom CLI",
                        id_to_find
                    );
                    Box::new(CustomCliProvider {
                        config: config.clone(),
                    })
                } else {
                    log::error!("No custom CLIs found, falling back to Hosted API");
                    Box::new(HostedAPIProvider::new(settings.hosted.clone()))
                }
            }
            ProviderType::AutoRouter => {
                log::info!("Initializing Auto-Router provider (Falling back to HostedAPI baseline for direct invocation)");
                Box::new(HostedAPIProvider::new(settings.hosted.clone()))
            }
        };
        Ok(provider)
    }

    pub async fn chat(
        &self,
        messages: Vec<crate::models::ai::Message>,
        system_prompt: Option<String>,
        project_id: Option<String>,
    ) -> Result<ChatResponse> {
        self.chat_with_options(messages, system_prompt, project_id, crate::models::ai::chat_models::ChatOptions::default()).await
    }

    pub async fn chat_with_options(
        &self,
        messages: Vec<crate::models::ai::Message>,
        system_prompt: Option<String>,
        project_id: Option<String>,
        options: crate::models::ai::chat_models::ChatOptions,
    ) -> Result<ChatResponse> {
        let provider = self.active_provider.read().await.clone();

        let project_path = if let Some(pid) = project_id {
            crate::services::project_service::ProjectService::load_project_by_id(&pid)
                .ok()
                .map(|p| p.path.to_string_lossy().to_string())
        } else {
            None
        };

        let tools = if provider.supports_mcp() {
            match self.mcp_service.get_tools().await {
                Ok(t) if !t.is_empty() => Some(t.into_iter().map(|mt| crate::models::ai::Tool {
                    name: mt.name,
                    description: mt.description,
                    input_schema: mt.input_schema,
                    tool_type: "function".to_string(),
                }).collect()),
                _ => None,
            }
        } else {
            None
        };

        let request = crate::models::ai::chat_models::ChatRequest {
            messages,
            system_prompt,
            tools,
            project_path,
            options,
        };

        provider.chat(request).await
    }

    pub async fn chat_stream(
        &self,
        messages: Vec<crate::models::ai::Message>,
        system_prompt: Option<String>,
        project_id: Option<String>,
    ) -> Result<std::pin::Pin<Box<dyn futures_util::Stream<Item = Result<String>> + Send>>> {
        self.chat_stream_with_options(messages, system_prompt, project_id, crate::models::ai::chat_models::ChatOptions::default()).await
    }

    pub async fn chat_stream_with_options(
        &self,
        messages: Vec<crate::models::ai::Message>,
        system_prompt: Option<String>,
        project_id: Option<String>,
        options: crate::models::ai::chat_models::ChatOptions,
    ) -> Result<std::pin::Pin<Box<dyn futures_util::Stream<Item = Result<String>> + Send>>> {
        let provider = self.active_provider.read().await.clone();

        let project_path = if let Some(pid) = project_id {
            crate::services::project_service::ProjectService::load_project_by_id(&pid)
                .ok()
                .map(|p| p.path.to_string_lossy().to_string())
        } else {
            None
        };

        let tools = if provider.supports_mcp() {
            match self.mcp_service.get_tools().await {
                Ok(t) if !t.is_empty() => Some(t.into_iter().map(|mt| crate::models::ai::Tool {
                    name: mt.name,
                    description: mt.description,
                    input_schema: mt.input_schema,
                    tool_type: "function".to_string(),
                }).collect()),
                _ => None,
            }
        } else {
            None
        };

        let request = crate::models::ai::chat_models::ChatRequest {
            messages,
            system_prompt,
            tools,
            project_path,
            options,
        };

        provider.chat_stream(request).await
    }

    pub async fn call_mcp_tool(
        &self,
        tool_name: &str,
        arguments: serde_json::Value,
    ) -> Result<serde_json::Value> {
        self.mcp_service.call_tool(tool_name, arguments).await
    }

    pub async fn switch_provider(&self, provider_type: ProviderType) -> Result<()> {
        log::info!("Switching AI provider to: {:?}", provider_type);
        let settings = SettingsService::load_global_settings()
            .map_err(|e| anyhow!("Failed to load settings: {}", e))?;

        let new_provider = Self::create_provider(&provider_type, &settings)?;

        let mut active = self.active_provider.write().await;
        *active = Arc::from(new_provider);

        // Persist to settings
        let mut settings = SettingsService::load_global_settings()
            .map_err(|e| anyhow!("Failed to load settings: {}", e))?;
        settings.active_provider = provider_type;
        SettingsService::save_global_settings(&settings)
            .map_err(|e| anyhow!("Failed to save settings: {}", e))?;

        log::info!("Successfully switched provider and updated settings");
        Ok(())
    }

    pub async fn get_active_provider_type(&self) -> ProviderType {
        let provider = self.active_provider.read().await;
        provider.provider_type()
    }

    pub async fn get_provider_metadata(&self, provider_type: &ProviderType) -> Result<crate::models::ai::chat_models::ProviderMetadata> {
        let settings = SettingsService::load_global_settings()?;
        let provider = Self::create_provider(provider_type, &settings)?;
        Ok(provider.metadata())
    }

    pub async fn list_available_providers() -> Result<Vec<ProviderType>> {
        log::debug!("Listing available providers using unified AIProvider interface...");
        let settings = SettingsService::load_global_settings()
            .map_err(|e| anyhow!("Failed to load settings: {}", e))?;

        let mut available = Vec::new();
        let all_types = vec![
            ProviderType::GeminiCli,
            ProviderType::ClaudeCode,
            ProviderType::Ollama,
            ProviderType::LiteLlm,
            ProviderType::OpenAiCli,
            ProviderType::HostedApi,
        ];

        for t in all_types {
            if let Ok(p) = Self::create_provider(&t, &settings) {
                if p.is_available() {
                    // Keep provider visible if installed/available.
                    // Authentication is validated at call time with actionable errors,
                    // so UI does not hide providers due to strict detector parsing.
                    available.push(t);
                }
            }
        }

        for cli in &settings.custom_clis {
            let t = ProviderType::Custom(format!("custom-{}", cli.id));
            if let Ok(p) = Self::create_provider(&t, &settings) {
                if p.is_available() {
                    available.push(t);
                }
            }
        }

        Ok(available)
    }
}
