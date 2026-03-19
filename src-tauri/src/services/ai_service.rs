use anyhow::{anyhow, Result};
use std::sync::Arc;
use tokio::sync::RwLock;

use crate::models::ai::{ChatResponse, Message, ProviderType};
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

    fn create_provider(
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
        messages: Vec<Message>,
        system_prompt: Option<String>,
        project_id: Option<String>,
    ) -> Result<ChatResponse> {
        let provider = self.active_provider.read().await.clone();

        // Resolve project path if project_id is provided
        let project_path = if let Some(pid) = project_id {
            if let Ok(project) =
                crate::services::project_service::ProjectService::load_project_by_id(&pid)
            {
                Some(project.path.to_string_lossy().to_string())
            } else {
                None
            }
        } else {
            None
        };

        // Fetch MCP tools if provider supports them
        let tools = if provider.supports_mcp() {
            match self.mcp_service.get_tools().await {
                Ok(t) => {
                    let mut ai_tools = Vec::new();
                    for mcp_tool in t {
                        ai_tools.push(crate::models::ai::Tool {
                            name: mcp_tool.name,
                            description: mcp_tool.description,
                            input_schema: mcp_tool.input_schema,
                            tool_type: "function".to_string(),
                        });
                    }
                    if ai_tools.is_empty() {
                        None
                    } else {
                        Some(ai_tools)
                    }
                }
                Err(e) => {
                    log::error!("Failed to fetch MCP tools: {}", e);
                    None
                }
            }
        } else {
            None
        };

        log::info!(
            "Sending chat request to provider: {:?} (Project Path: {:?}, Tools: {})",
            provider.provider_type(),
            project_path,
            tools.as_ref().map(|t| t.len()).unwrap_or(0)
        );

        provider
            .chat(messages, system_prompt, tools, project_path)
            .await
            .map_err(|e| {
                log::error!("Chat request failed: {}", e);
                e
            })
    }

    pub async fn chat_stream(
        &self,
        messages: Vec<Message>,
        system_prompt: Option<String>,
        project_id: Option<String>,
    ) -> Result<std::pin::Pin<Box<dyn futures_util::Stream<Item = Result<String>> + Send>>> {
        let provider = self.active_provider.read().await.clone();

        // Resolve project path if project_id is provided
        let project_path = if let Some(pid) = project_id {
            if let Ok(project) =
                crate::services::project_service::ProjectService::load_project_by_id(&pid)
            {
                Some(project.path.to_string_lossy().to_string())
            } else {
                None
            }
        } else {
            None
        };

        // Fetch MCP tools if provider supports them
        let tools = if provider.supports_mcp() {
            match self.mcp_service.get_tools().await {
                Ok(t) => {
                    let mut ai_tools = Vec::new();
                    for mcp_tool in t {
                        ai_tools.push(crate::models::ai::Tool {
                            name: mcp_tool.name,
                            description: mcp_tool.description,
                            input_schema: mcp_tool.input_schema,
                            tool_type: "function".to_string(),
                        });
                    }
                    if ai_tools.is_empty() {
                        None
                    } else {
                        Some(ai_tools)
                    }
                }
                Err(e) => {
                    log::error!("Failed to fetch MCP tools: {}", e);
                    None
                }
            }
        } else {
            None
        };

        log::info!(
            "Sending streaming chat request to provider: {:?} (Project Path: {:?}, Tools: {})",
            provider.provider_type(),
            project_path,
            tools.as_ref().map(|t| t.len()).unwrap_or(0)
        );

        provider
            .chat_stream(messages, system_prompt, tools, project_path)
            .await
            .map_err(|e| {
                log::error!("Streaming chat request failed: {}", e);
                e
            })
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

    pub async fn list_available_providers() -> Result<Vec<ProviderType>> {
        log::debug!("Listing available providers with status-based detection...");
        let settings = SettingsService::load_global_settings()
            .map_err(|e| anyhow!("Failed to load settings: {}", e))?;
        let secrets = crate::services::secrets_service::SecretsService::load_secrets().unwrap_or_default();

        let mut available = Vec::new();

        // Always include hosted if model is set
        available.push(ProviderType::HostedApi);
        log::debug!("- Added HostedApi");

        // Ollama check
        let ollama_available = (settings.ollama.detected_path.is_some() || crate::utils::env::command_exists("ollama"))
            && !settings.ollama.model.is_empty();
        if ollama_available {
            available.push(ProviderType::Ollama);
            log::debug!("- Added Ollama");
        }

        // Claude Code check - if binary exists, it's available (auth manages its own state)
        let claude_available = settings.claude.detected_path.is_some() || crate::utils::env::command_exists("claude");
        if claude_available {
            available.push(ProviderType::ClaudeCode);
            log::debug!("- Added ClaudeCode");
        }

        // Gemini CLI - Robust health check: 'gemini models list'
        let gemini_bin = if let Some(ref path) = settings.gemini_cli.detected_path {
            path.to_string_lossy().to_string()
        } else if crate::utils::env::command_exists("gemini") {
            "gemini".to_string()
        } else {
            "".to_string()
        };

        if !gemini_bin.is_empty() {
            // Check auth status: 'gemini --list-sessions' contains 'Loaded cached credentials.'
            let output = tokio::time::timeout(std::time::Duration::from_millis(6000), async {
                tokio::process::Command::new(&gemini_bin)
                    .arg("--list-sessions")
                    .output()
                    .await
            }).await;

            let is_authed = match output {
                Ok(Ok(out)) => {
                    let combined = format!("{} {}", String::from_utf8_lossy(&out.stdout), String::from_utf8_lossy(&out.stderr));
                    combined.contains("Loaded cached credentials.")
                }
                _ => {
                    let has_marker = secrets.custom_api_keys.get("GOOGLE_ANTIGRAVITY_AUTH_MARKER")
                        .map(|v| !v.trim().is_empty())
                        .unwrap_or(false);
                    has_marker || secrets.gemini_api_key.as_ref().map(|k| !k.trim().is_empty()).unwrap_or(false)
                }
            };

            if is_authed {
                available.push(ProviderType::GeminiCli);
                log::debug!("- Added GeminiCli (Authenticated)");
            } else {
                // If not authed via CLI, but binary exists, we might still show it if it's the active provider
                // or let the user try to auth it. But for list_available, we follow the OpenAiCli pattern.
                log::debug!("- Skipped GeminiCli (Not Authenticated)");
            }
        }

        // OpenAI CLI / Codex - Robust health check: 'codex login status'
        let openai_bin = if let Some(ref path) = settings.openai_cli.detected_path {
            path.to_string_lossy().to_string()
        } else if crate::utils::env::command_exists("codex") {
            "codex".to_string()
        } else {
            "".to_string()
        };

        if !openai_bin.is_empty() {
            let output = tokio::time::timeout(std::time::Duration::from_millis(2000), async {
                tokio::process::Command::new(&openai_bin)
                    .arg("login")
                    .arg("status")
                    .output()
                    .await
            }).await;

            let is_authed = match output {
                Ok(Ok(out)) => {
                    let combined = format!("{} {}", String::from_utf8_lossy(&out.stdout), String::from_utf8_lossy(&out.stderr)).to_lowercase();
                    // Some versions return non-zero on info commands, so we prioritize the string check
                    combined.contains("logged in") || combined.contains("authenticated")
                }
                _ => secrets.custom_api_keys.contains_key("OPENAI_OAUTH_ACCESS_TOKEN")
            };

            if is_authed {
                available.push(ProviderType::OpenAiCli);
                log::debug!("- Added OpenAiCli (Health Check Passed)");
            }
        }

        if settings.litellm.enabled && !settings.litellm.base_url.is_empty() {
            available.push(ProviderType::LiteLlm);
            log::debug!("- Added LiteLlm");
        }

        for cli in settings.custom_clis {
            if cli.is_configured {
                available.push(ProviderType::Custom(format!("custom-{}", cli.id)));
                log::debug!("- Added Custom: {}", cli.name);
            }
        }

        Ok(available)
    }
}
