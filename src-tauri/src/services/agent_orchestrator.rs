use crate::models::ai::{ChatResponse, Message};
use crate::models::chat::ChatMessage;
use crate::services::ai_service::AIService;
use crate::services::chat_service::ChatService;
use crate::services::output_parser_service::OutputParserService;
use crate::services::research_log_service::ResearchLogService;
use crate::services::prompt_service::{PromptService, PromptMode};
use anyhow::{anyhow, Context, Result};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::Mutex;

struct ProviderPreflight {
    is_available: bool,
    is_authenticated: bool,
}

pub struct AgentOrchestrator {
    ai_service: Arc<AIService>,
    execution_lock: Mutex<()>,
    pub trace_sender: Option<tokio::sync::broadcast::Sender<String>>,
}

impl AgentOrchestrator {
    pub fn new(ai_service: Arc<AIService>) -> Self {
        Self {
            ai_service,
            execution_lock: Mutex::new(()),
            trace_sender: None,
        }
    }

    fn emit<S: serde::Serialize + Clone>(&self, event: &str, payload: S) {
        // Broadcast SSE events through Server routing later if needed.
        // If it's a trace-log and we have a broadcast sender, send it through
        if event == "trace-log" {
            if let Some(sender) = &self.trace_sender {
                let msg = match serde_json::to_value(&payload) {
                    Ok(serde_json::Value::String(s)) => s,
                    Ok(v) => v.to_string(),
                    Err(_) => "Error serializing trace log".to_string(),
                };
                println!("[AgentOrchestrator] Broadcasting trace-log: {}", msg);
                let _ = sender.send(msg);
            }
        }
    }

    async fn provider_preflight(
        provider: &Arc<dyn crate::services::ai_provider::AIProvider>,
    ) -> ProviderPreflight {
        let is_available = provider.is_available();
        let is_authenticated = if is_available {
            provider.check_authentication().await.unwrap_or(false)
        } else {
            false
        };

        ProviderPreflight {
            is_available,
            is_authenticated,
        }
    }

    fn provider_setup_guidance(
        provider_type: &crate::models::ai::ProviderType,
        preflight: &ProviderPreflight,
        original_error: Option<&anyhow::Error>,
    ) -> ChatResponse {
        let provider_label = match provider_type {
            crate::models::ai::ProviderType::Ollama => "Ollama",
            crate::models::ai::ProviderType::ClaudeCode => "Claude Code",
            crate::models::ai::ProviderType::HostedApi => "Hosted API",
            crate::models::ai::ProviderType::GeminiCli => "Gemini CLI",
            crate::models::ai::ProviderType::OpenAiCli => "OpenAI CLI",
            crate::models::ai::ProviderType::LiteLlm => "LiteLLM",
            crate::models::ai::ProviderType::AutoRouter => "Auto-Router",
            crate::models::ai::ProviderType::Custom(id) => id.as_str(),
        };

        let headline = if !preflight.is_available {
            format!(
                "I couldn't start chat yet because **{}** isn't available on this machine.",
                provider_label
            )
        } else {
            format!(
                "I opened the chat, but **{}** still needs setup before it can answer.",
                provider_label
            )
        };

        let setup_steps = match provider_type {
            crate::models::ai::ProviderType::Ollama => vec![
                "Install/start Ollama locally.",
                "Pull a model like `llama3`.",
                "Then retry your message.",
            ],
            crate::models::ai::ProviderType::ClaudeCode => vec![
                "Run `claude login` in your terminal, or add the API key in Settings.",
                "Then retry your message.",
            ],
            crate::models::ai::ProviderType::GeminiCli => vec![
                "Run `gemini --auth` or add a Gemini API key in Settings.",
                "Then retry your message.",
            ],
            crate::models::ai::ProviderType::OpenAiCli => vec![
                "Log into the OpenAI CLI / Codex CLI, or add your OpenAI API key in Settings.",
                "Then retry your message.",
            ],
            crate::models::ai::ProviderType::HostedApi => vec![
                "Add the required hosted-model API key in Settings.",
                "Then retry your message.",
            ],
            crate::models::ai::ProviderType::LiteLlm => vec![
                "Start your LiteLLM endpoint and configure its API key/base URL in Settings.",
                "Then retry your message.",
            ],
            crate::models::ai::ProviderType::AutoRouter => vec![
                "Configure at least one backing provider in Settings.",
                "Then retry your message.",
            ],
            crate::models::ai::ProviderType::Custom(_) => vec![
                "Check that the custom CLI command exists and its credentials are configured.",
                "Then retry your message.",
            ],
        };

        let mut content = format!(
            "{}\n\nPlease open **Settings → Models** and finish setup for **{}**.\n\n{}",
            headline,
            provider_label,
            setup_steps
                .iter()
                .enumerate()
                .map(|(idx, step)| format!("{}. {}", idx + 1, step))
                .collect::<Vec<_>>()
                .join("\n")
        );

        if let Some(error) = original_error {
            content.push_str(&format!("\n\n_Last error: {}_", error));
        }

        ChatResponse {
            content,
            tool_calls: None,
            metadata: None,
        }
    }

    /// Primary entry point for sending a message and handling all side effects
    pub async fn run_agent_loop(
        &self,
        messages: Vec<Message>,
        system_prompt: Option<String>,
        project_id: Option<String>,
        skill_id: Option<String>,
        skill_params: Option<HashMap<String, String>>,
    ) -> Result<ChatResponse> {
        let _lock = self.execution_lock.lock().await;

        self.emit("trace-log", "Initializing agent session...");

        // 1. Authentication & Health Guard
        let provider_type = self.ai_service.get_active_provider_type().await;
        let settings = crate::services::settings_service::SettingsService::load_global_settings()?;
        let active_provider: Arc<dyn crate::services::ai_provider::AIProvider> = match AIService::create_provider(&provider_type, &settings) {
            Ok(p) => Arc::from(p),
            Err(e) => return Err(anyhow!("Failed to initialize current provider: {}", e)),
        };

        let provider_preflight = Self::provider_preflight(&active_provider).await;

        if !provider_preflight.is_available {
            let msg = format!("Provider {:?} is not available on this machine yet.", provider_type);
            self.emit("trace-log", format!("WARN: {}", msg));
            return Ok(Self::provider_setup_guidance(&provider_type, &provider_preflight, None));
        }

        self.emit("trace-log", format!("Checking authentication for {:?}...", provider_type));
        if !provider_preflight.is_authenticated {
            let msg = format!("Provider {:?} may not be authenticated yet. Proceeding and letting provider return actionable auth guidance if needed.", provider_type);
            self.emit("trace-log", format!("WARN: {}", msg));
        }

        // 2. Build Unified System Prompt
        self.emit("trace-log", "Building unified system prompt...");
        
        let mode = if skill_id.is_some() { PromptMode::Artifact } else { PromptMode::General };
        let mut final_system_prompt = PromptService::build_system_prompt(
            project_id.as_deref(),
            mode,
        );

        // 3. Inject Skill Prompt (if applicable)
        if let Some(sid) = skill_id {
            if let Ok(skill) = crate::services::skill_service::SkillService::get_skill(&sid) {
                self.emit("trace-log", format!("Activating skill: {}...", skill.name));
                
                // Add skill metadata
                final_system_prompt.push_str("\n\n=== RELEVANT SKILL CONTEXT ===\n");
                final_system_prompt.push_str(&format!("Skill Name: {}\n", skill.name));
                final_system_prompt.push_str(&format!("Goal: {}\n\n", skill.description));
                
                // Render prompt template with params
                if let Ok(rendered) = skill.render_prompt(skill_params.unwrap_or_default()) {
                    final_system_prompt.push_str("--- SKILL INSTRUCTIONS ---\n");
                    final_system_prompt.push_str(&rendered);
                    final_system_prompt.push_str("\n--------------------------\n");
                }
            } else {
                self.emit("trace-log", format!("WARN: Requested skill '{}' not found. Falling back to general mode.", sid));
            }
        }

        if let Some(custom) = system_prompt {
            final_system_prompt.push_str("\n\n--- ADDITIONAL INSTRUCTIONS ---\n");
            final_system_prompt.push_str(&custom);
        }

        self.emit("trace-log", format!("Initiating chat request via {:?} (project: {:?})...", provider_type, project_id));
        let chat_result = self
            .ai_service
            .chat(
                messages.clone(),
                Some(final_system_prompt.clone()),
                project_id.clone(),
            )
            .await;

        match &chat_result {
            Ok(resp) => {
                self.emit("trace-log", format!("Request successful. Received {} chars.", resp.content.len()));
            },
            Err(e) => {
                self.emit("trace-log", format!("ERROR: Request failed: {}", e));
                if !provider_preflight.is_authenticated {
                    return Ok(Self::provider_setup_guidance(&provider_type, &provider_preflight, Some(e)));
                }
            }
        }

        // 4. Handle results & side effects
        if let Some(ref pid) = project_id {
            match &chat_result {
                Ok(response) => {
                    let provider_name = format!("{:?}", provider_type);
                    if let Err(e) = ResearchLogService::log_event(pid, &provider_name, None, &response.content) {
                        log::error!("[AgentOrchestrator] Failed to log research event for project {}: {}", pid, e);
                    }

                    // Track Cost
                    let metadata = match &response.metadata {
                        Some(m) => Some(m.clone()),
                        None => {
                            let model_used = active_provider.resolve_model().await;
                            Some(self.estimate_metadata(&messages, Some(&final_system_prompt), &response.content, &model_used).await)
                        }
                    };

                    if let Some(metadata) = metadata {
                        if let Ok(project) = crate::services::project_service::ProjectService::load_project_by_id(pid) {
                            let cost_log_path = project.path.join(".metadata").join("cost_log.json");
                            let mut cost_log = crate::models::cost::CostLog::load(&cost_log_path).unwrap_or_default();
                            
                            let cost_usd = if metadata.cost_usd > 0.0 {
                                metadata.cost_usd
                            } else {
                                crate::models::cost::CostLog::compute_cost_usd(
                                    &metadata.model_used, 
                                    metadata.tokens_in, 
                                    metadata.tokens_out,
                                    metadata.tokens_cache_read,
                                    metadata.tokens_cache_write,
                                )
                            };

                            let file_changes = OutputParserService::parse_file_changes(&response.content);
                            let artifact_changes = OutputParserService::parse_artifact_changes(&response.content);
                            
                            // More realistic time saved calculation
                            let time_saved_minutes = 3.0 
                                + (metadata.tokens_in as f64 / 1000.0) 
                                + (metadata.tokens_out as f64 / 100.0)
                                + (file_changes.len() as f64 * 5.0)
                                + (artifact_changes.len() as f64 * 10.0);
                                
                            let time_saved_minutes = time_saved_minutes.min(120.0); // Cap at 2 hours per prompt

                            cost_log.add_record(crate::models::cost::CostRecord {
                                id: format!("cost-{}", chrono::Utc::now().timestamp_millis()),
                                timestamp: chrono::Utc::now(),
                                provider: provider_name,
                                model: metadata.model_used.clone(),
                                input_tokens: metadata.tokens_in,
                                output_tokens: metadata.tokens_out,
                                cache_read_tokens: metadata.tokens_cache_read,
                                cache_creation_tokens: metadata.tokens_cache_write,
                                reasoning_tokens: metadata.tokens_reasoning,
                                cost_usd,
                                artifact_id: None,
                                workflow_run_id: None,
                                is_user_prompt: true,
                                time_saved_minutes,
                                tool_calls: response.tool_calls.as_ref().map(|tc| tc.len() as u32).unwrap_or(0),
                            });
                            let _ = cost_log.save(&cost_log_path);
                        }
                    }

                    // Save history
                    self.save_history(pid, messages, &response.content).await?;

                    // Apply file changes
                    let changes = OutputParserService::parse_file_changes(&response.content);
                    if !changes.is_empty() {
                        self.emit("trace-log", format!("Applying {} detected file changes...", changes.len()));
                        OutputParserService::apply_changes(pid, &changes)?;
                        self.emit("file-changed", (pid.to_string(), "unknown".to_string()));
                    }

                    // Apply artifact changes
                    let artifact_changes = OutputParserService::parse_artifact_changes(&response.content);
                    if !artifact_changes.is_empty() {
                        self.emit("trace-log", format!("Creating {} detected artifacts...", artifact_changes.len()));
                        OutputParserService::apply_artifact_changes(pid, &artifact_changes)?;
                        self.emit("file-changed", (pid.to_string(), "artifact".to_string()));
                    }

                    // Send notifications
                    let notifications = OutputParserService::parse_notifications(&response.content);
                    if !notifications.is_empty() {
                        self.emit("trace-log", format!("Sending {} detected notifications...", notifications.len()));
                        let _ = OutputParserService::apply_notifications(&notifications).await;
                    }
                    self.emit("trace-log", "Agent session completed successfully.");
                }
                Err(e) => {
                    self.emit("trace-log", format!("ERROR: {}", e));
                    let _ = ResearchLogService::log_event(pid, &format!("{:?}", provider_type), None, &format!("ERROR: {}", e));
                }
            }
        }

        chat_result.context("Failed to get response from AI agent")
    }

    pub async fn run_agent_loop_stream(
        &self,
        messages: Vec<Message>,
        system_prompt: Option<String>,
        project_id: Option<String>,
        skill_id: Option<String>,
        skill_params: Option<HashMap<String, String>>,
    ) -> Result<ChatResponse> {
        let _lock = self.execution_lock.lock().await;

        self.emit("trace-log", format!("Initializing streaming agent session for project: {:?}", project_id));
        log::info!("Starting agent session. Project ID: {:?}", project_id);

        // 1. Authentication Guard
        let provider_type = self.ai_service.get_active_provider_type().await;
        let settings = crate::services::settings_service::SettingsService::load_global_settings()?;
        let active_provider: Arc<dyn crate::services::ai_provider::AIProvider> = match AIService::create_provider(&provider_type, &settings) {
            Ok(p) => Arc::from(p),
            Err(e) => {
                let err_msg = format!("Failed to initialize current provider: {}", e);
                if let Some(ref pid) = project_id {
                    let _ = ResearchLogService::log_event(pid, &format!("{:?}", provider_type), None, &format!("ERROR: {}", err_msg));
                    // Targeted fix for macOS E2E runners: allow time for filesystem sync before returning error
                    tokio::time::sleep(Duration::from_millis(500)).await;
                }
                return Err(anyhow::anyhow!("{}", err_msg));
            }
        };

        let provider_preflight = Self::provider_preflight(&active_provider).await;

        if !provider_preflight.is_available {
            let msg = format!("Provider {:?} is not available on this machine yet.", provider_type);
            self.emit("trace-log", format!("WARN: {}", msg));
            return Ok(Self::provider_setup_guidance(&provider_type, &provider_preflight, None));
        }

        if !provider_preflight.is_authenticated {
            let msg = format!("Provider {:?} may not be authenticated. Continuing in advisory mode.", provider_type);
            self.emit("trace-log", format!("WARN: {}", msg));
        }

        // 2. Build Prompt
        let mode = if skill_id.is_some() { PromptMode::Artifact } else { PromptMode::General };
        let mut final_system_prompt = PromptService::build_system_prompt(
            project_id.as_deref(),
            mode,
        );

        // 3. Inject Skill Prompt (Stream version)
        if let Some(sid) = skill_id {
            if let Ok(skill) = crate::services::skill_service::SkillService::get_skill(&sid) {
                self.emit("trace-log", format!("Activating skill: {} (Stream Mode)...", skill.name));
                
                final_system_prompt.push_str("\n\n=== RELEVANT SKILL CONTEXT ===\n");
                final_system_prompt.push_str(&format!("Skill Name: {}\n", skill.name));
                final_system_prompt.push_str(&format!("Goal: {}\n\n", skill.description));
                
                if let Ok(rendered) = skill.render_prompt(skill_params.unwrap_or_default()) {
                    final_system_prompt.push_str("--- SKILL INSTRUCTIONS ---\n");
                    final_system_prompt.push_str(&rendered);
                    final_system_prompt.push_str("\n--------------------------\n");
                }
            }
        }
        if let Some(custom) = system_prompt {
            final_system_prompt.push_str("\n\n--- ADDITIONAL INSTRUCTIONS ---\n");
            final_system_prompt.push_str(&custom);
        }

        // 3. Execute Stream
        let stream_result = self
            .ai_service
            .chat_stream(
                messages.clone(),
                Some(final_system_prompt.clone()),
                project_id.clone(),
            )
            .await;

        let mut stream = match stream_result {
            Ok(s) => s,
            Err(e) => {
                self.emit("trace-log", format!("ERROR: {}", e));
                if !provider_preflight.is_authenticated {
                    return Ok(Self::provider_setup_guidance(&provider_type, &provider_preflight, Some(&e)));
                }
                if let Some(ref pid) = project_id {
                    let provider_name = format!("{:?}", provider_type);
                    let _ = ResearchLogService::log_event(pid, &provider_name, None, &format!("ERROR: Failed to initialize AI provider: {}", e));
                }
                return Err(e);
            }
        };

        let token = tokio_util::sync::CancellationToken::new();
        crate::services::cancellation_service::CANCELLATION_MANAGER
            .register_token("chat".to_string(), token.clone())
            .await;

        let mut full_content = String::new();
        let mut stream_error: Option<String> = None;
        use futures_util::StreamExt;

        while let Some(chunk) = stream.next().await {
            if token.is_cancelled() {
                self.emit("trace-log", "Stream cancelled by user.");
                break;
            }
            match chunk {
                Ok(text) => {
                    full_content.push_str(&text);
                    self.emit("chat-delta", text);
                }
                Err(e) => {
                    let err_msg = format!("Stream error: {}", e);
                    self.emit("trace-log", format!("ERROR: {}", err_msg));
                    stream_error = Some(err_msg);
                    break;
                }
            }
        }

        // Cleanup
        {
            let mut tokens = crate::services::cancellation_service::CANCELLATION_MANAGER.active_tokens.lock().await;
            tokens.remove("chat");
        }

        // 4. Finalize
        if let Some(ref pid) = project_id {
            let provider_name = format!("{:?}", provider_type);
            if let Some(ref err_msg) = stream_error {
                let _ = ResearchLogService::log_event(pid, &provider_name, None, &format!("ERROR: {}", err_msg));
            } else if !full_content.is_empty() {
                let _ = ResearchLogService::log_event(pid, &provider_name, None, &full_content);
                let _ = self.save_history(pid, messages.clone(), &full_content).await;

                // Track Cost for Stream
                let metadata = match crate::services::output_parser_service::OutputParserService::parse_generation_metadata(&full_content) {
                    Some(m) => Some(m),
                    None => {
                        let model_used = active_provider.resolve_model().await;
                        Some(self.estimate_metadata(&messages, Some(&final_system_prompt), &full_content, &model_used).await)
                    }
                };

                if let Some(meta) = metadata {
                    if let Ok(project) = crate::services::project_service::ProjectService::load_project_by_id(pid) {
                        let cost_log_path = project.path.join(".metadata").join("cost_log.json");
                        let mut cost_log = crate::models::cost::CostLog::load(&cost_log_path).unwrap_or_default();
                        
                        let cost_usd = if meta.cost_usd > 0.0 {
                            meta.cost_usd
                        } else {
                            crate::models::cost::CostLog::compute_cost_usd(
                                &meta.model_used, 
                                meta.tokens_in, 
                                meta.tokens_out,
                                meta.tokens_cache_read,
                                meta.tokens_cache_write,
                            )
                        };

                        let file_changes = OutputParserService::parse_file_changes(&full_content);
                        let artifact_changes = OutputParserService::parse_artifact_changes(&full_content);
                        
                        // Use improved time saved formula
                        let time_saved_minutes = 3.0 
                            + (meta.tokens_in as f64 / 1000.0) 
                            + (meta.tokens_out as f64 / 100.0)
                            + (file_changes.len() as f64 * 5.0)
                            + (artifact_changes.len() as f64 * 10.0);
                        let time_saved_minutes = time_saved_minutes.min(120.0);

                        cost_log.add_record(crate::models::cost::CostRecord {
                            id: format!("cost-stream-{}", chrono::Utc::now().timestamp_millis()),
                            timestamp: chrono::Utc::now(),
                            provider: provider_name.clone(),
                            model: meta.model_used.clone(),
                            input_tokens: meta.tokens_in,
                            output_tokens: meta.tokens_out,
                            cache_read_tokens: meta.tokens_cache_read,
                            cache_creation_tokens: meta.tokens_cache_write,
                            reasoning_tokens: meta.tokens_reasoning,
                            cost_usd,
                            artifact_id: None,
                            workflow_run_id: None,
                            is_user_prompt: true,
                            time_saved_minutes,
                            tool_calls: 0,
                        });
                        let _ = cost_log.save(&cost_log_path);
                    }
                }

                let changes = OutputParserService::parse_file_changes(&full_content);
                if !changes.is_empty() {
                    let _ = OutputParserService::apply_changes(pid, &changes);
                    self.emit("file-changed", (pid.to_string(), "unknown".to_string()));
                }

                let artifact_changes = OutputParserService::parse_artifact_changes(&full_content);
                if !artifact_changes.is_empty() {
                    let _ = OutputParserService::apply_artifact_changes(pid, &artifact_changes);
                    self.emit("file-changed", (pid.to_string(), "artifact".to_string()));
                }

                // Send notifications
                let notifications = OutputParserService::parse_notifications(&full_content);
                if !notifications.is_empty() {
                    self.emit("trace-log", format!("Sending {} detected notifications...", notifications.len()));
                    let _ = OutputParserService::apply_notifications(&notifications).await;
                }
            }
        }

        self.emit("trace-log", "Streaming session completed.");
        
        let final_metadata = match crate::services::output_parser_service::OutputParserService::parse_generation_metadata(&full_content) {
            Some(m) => Some(m),
            None => {
                let model_used = active_provider.resolve_model().await;
                Some(self.estimate_metadata(&messages, Some(&final_system_prompt), &full_content, &model_used).await)
            }
        };

        Ok(ChatResponse {
            content: full_content,
            tool_calls: None,
            metadata: final_metadata,
        })
    }

    async fn save_history(
        &self,
        project_id: &str,
        user_messages: Vec<Message>,
        assistant_content: &str,
    ) -> Result<()> {
        let mut all_messages = user_messages;
        all_messages.push(Message {
            role: "assistant".to_string(),
            content: assistant_content.to_string(),
            tool_calls: None,
            tool_results: None,
        });

        let chat_messages: Vec<ChatMessage> = all_messages
            .into_iter()
            .map(|m| ChatMessage {
                role: m.role,
                content: m.content,
            })
            .collect();

        ChatService::save_chat_to_file(project_id, chat_messages, "UnifiedAI").await?;
        Ok(())
    }

    /// Estimate metadata (tokens/cost) when provider doesn't return explicit usage statistics.
    async fn estimate_metadata(
        &self,
        messages: &[Message],
        system_prompt: Option<&str>,
        content: &str,
        model_name: &str,
    ) -> crate::models::ai::GenerationMetadata {
        let mut tokens_in = 0;
        if let Some(system) = system_prompt {
            tokens_in += (system.len() as u64) / 4;
        }
        for msg in messages {
            tokens_in += (msg.content.len() as u64) / 4;
            // Add overhead for role and structuring
            tokens_in += 20;
        }

        let tokens_out = (content.len() as u64) / 4;
        
        let cost_usd = crate::models::cost::CostLog::compute_cost_usd(
            model_name,
            tokens_in,
            tokens_out,
            0,
            0,
        );

        crate::models::ai::GenerationMetadata {
            confidence: 1.0,
            cost_usd,
            model_used: model_name.to_string(),
            tokens_in,
            tokens_out,
            tokens_cache_read: 0,
            tokens_cache_write: 0,
            tokens_reasoning: 0,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::ai::{GeminiCliConfig, Message, ProviderType};
    use crate::models::settings::GlobalSettings;
    use crate::services::settings_service::SettingsService;
    use tempfile::TempDir;

    #[test]
    fn provider_guidance_mentions_setup_steps() {
        let response = AgentOrchestrator::provider_setup_guidance(
            &ProviderType::GeminiCli,
            &ProviderPreflight {
                is_available: true,
                is_authenticated: false,
            },
            None,
        );

        assert!(response.content.contains("Gemini CLI"));
        assert!(response.content.contains("Settings → Models"));
        assert!(response.content.contains("gemini --auth"));
    }

    #[tokio::test]
    async fn run_agent_loop_returns_guidance_when_provider_is_missing() {
        let _guard = crate::test_support::ENV_LOCK.lock().unwrap();
        let temp_dir = TempDir::new().unwrap();
        let appdata_root = temp_dir.path().join("appdata");
        std::fs::create_dir_all(&appdata_root).unwrap();

        let _appdata = crate::test_support::EnvVarGuard::set("APPDATA", &appdata_root);
        let _localappdata = crate::test_support::EnvVarGuard::set("LOCALAPPDATA", &appdata_root);
        let _home = crate::test_support::EnvVarGuard::set("HOME", temp_dir.path());
        let _projects_dir = crate::test_support::EnvVarGuard::set(
            "PROJECTS_DIR",
            appdata_root.join("projects"),
        );

        crate::utils::paths::initialize_directory_structure().unwrap();

        let settings = GlobalSettings {
            active_provider: ProviderType::GeminiCli,
            gemini_cli: GeminiCliConfig {
                command: "definitely-not-a-real-gemini-command".to_string(),
                ..GlobalSettings::default().gemini_cli
            },
            ..GlobalSettings::default()
        };
        SettingsService::save_global_settings(&settings).unwrap();

        let ai_service = Arc::new(AIService::new().await.unwrap());
        let orchestrator = AgentOrchestrator::new(ai_service);

        let response = orchestrator
            .run_agent_loop(
                vec![Message {
                    role: "user".to_string(),
                    content: "Hello".to_string(),
                    tool_calls: None,
                    tool_results: None,
                }],
                None,
                None,
                None,
                None,
            )
            .await
            .unwrap();

        assert!(response.content.contains("isn't available on this machine"));
        assert!(response.content.contains("Gemini CLI"));
        assert!(response.content.contains("Settings → Models"));
    }
}
