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
use tokio::sync::Mutex;

use tauri::{AppHandle, Emitter};

pub struct AgentOrchestrator {
    ai_service: Arc<AIService>,
    app_handle: AppHandle,
    execution_lock: Mutex<()>,
}

impl AgentOrchestrator {
    pub fn new(ai_service: Arc<AIService>, app_handle: AppHandle) -> Self {
        Self {
            ai_service,
            app_handle,
            execution_lock: Mutex::new(()),
        }
    }

    /// Primary entry point for sending a message and handling all side effects
    pub async fn run_agent_loop(
        &self,
        messages: Vec<Message>,
        system_prompt: Option<String>,
        project_id: Option<String>,
        _skill_id: Option<String>,
        _skill_params: Option<HashMap<String, String>>,
    ) -> Result<ChatResponse> {
        let _lock = self.execution_lock.lock().await;

        let _ = self.app_handle.emit("trace-log", "Initializing agent session...");

        // 1. Authentication & Health Guard
        let provider_type = self.ai_service.get_active_provider_type().await;
        let settings = crate::services::settings_service::SettingsService::load_global_settings()?;
        let active_provider: Arc<dyn crate::services::ai_provider::AIProvider> = match AIService::create_provider(&provider_type, &settings) {
            Ok(p) => Arc::from(p),
            Err(e) => return Err(anyhow!("Failed to initialize current provider: {}", e)),
        };

        let _ = self.app_handle.emit("trace-log", format!("Checking authentication for {:?}...", provider_type));
        if !active_provider.check_authentication().await.unwrap_or(false) {
            let msg = format!("Provider {:?} may not be authenticated yet. Proceeding and letting provider return actionable auth guidance if needed.", provider_type);
            let _ = self.app_handle.emit("trace-log", format!("WARN: {}", msg));
        }

        // 2. Build Unified System Prompt
        let _ = self.app_handle.emit("trace-log", "Building unified system prompt...");
        let mut final_system_prompt = PromptService::build_system_prompt(
            project_id.as_deref(),
            PromptMode::General, // Default to general, can be refined based on skill_id
        );

        if let Some(custom) = system_prompt {
            final_system_prompt.push_str("\n\n--- ADDITIONAL INSTRUCTIONS ---\n");
            final_system_prompt.push_str(&custom);
        }

        // 3. Execute Chat
        let _ = self.app_handle.emit("trace-log", format!("Executing request via {:?}...", provider_type));
        let chat_result = self
            .ai_service
            .chat(
                messages.clone(),
                Some(final_system_prompt),
                project_id.clone(),
            )
            .await;

        // 4. Handle results & side effects
        if let Some(ref pid) = project_id {
            match &chat_result {
                Ok(response) => {
                    let provider_name = format!("{:?}", provider_type);
                    let _ = ResearchLogService::log_event(pid, &provider_name, None, &response.content);

                    // Track Cost
                    if let Some(metadata) = &response.metadata {
                        if let Ok(project) = crate::services::project_service::ProjectService::load_project_by_id(pid) {
                            let cost_log_path = project.path.join(".metadata").join("cost_log.json");
                            let mut cost_log = crate::models::cost::CostLog::load(&cost_log_path).unwrap_or_default();
                            let cost_usd = crate::models::cost::CostLog::compute_cost_usd(&metadata.model_used, metadata.tokens_in, metadata.tokens_out);
                            cost_log.add_record(crate::models::cost::CostRecord {
                                id: format!("cost-{}", chrono::Utc::now().timestamp_millis()),
                                timestamp: chrono::Utc::now(),
                                provider: provider_name,
                                model: metadata.model_used.clone(),
                                input_tokens: metadata.tokens_in,
                                output_tokens: metadata.tokens_out,
                                cost_usd,
                                artifact_id: None,
                                workflow_run_id: None,
                            });
                            let _ = cost_log.save(&cost_log_path);
                        }
                    }

                    // Save history
                    self.save_history(pid, messages, &response.content).await?;

                    // Apply file changes
                    let changes = OutputParserService::parse_file_changes(&response.content);
                    if !changes.is_empty() {
                        let _ = self.app_handle.emit("trace-log", format!("Applying {} detected file changes...", changes.len()));
                        OutputParserService::apply_changes(pid, &changes)?;
                        let _ = self.app_handle.emit("file-changed", (pid.to_string(), "unknown".to_string()));
                    }
                    let _ = self.app_handle.emit("trace-log", "Agent session completed successfully.");
                }
                Err(e) => {
                    let _ = self.app_handle.emit("trace-log", format!("ERROR: {}", e));
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
        _skill_id: Option<String>,
        _skill_params: Option<HashMap<String, String>>,
    ) -> Result<ChatResponse> {
        let _lock = self.execution_lock.lock().await;

        let _ = self.app_handle.emit("trace-log", "Initializing streaming agent session...");

        // 1. Authentication Guard
        let provider_type = self.ai_service.get_active_provider_type().await;
        let settings = crate::services::settings_service::SettingsService::load_global_settings()?;
        let active_provider: Arc<dyn crate::services::ai_provider::AIProvider> = match AIService::create_provider(&provider_type, &settings) {
            Ok(p) => Arc::from(p),
            Err(e) => return Err(anyhow!("Failed to initialize current provider: {}", e)),
        };

        if !active_provider.check_authentication().await.unwrap_or(false) {
            let msg = format!("Provider {:?} may not be authenticated. Continuing in advisory mode.", provider_type);
            let _ = self.app_handle.emit("trace-log", format!("WARN: {}", msg));
        }

        // 2. Build Prompt
        let mut final_system_prompt = PromptService::build_system_prompt(
            project_id.as_deref(),
            PromptMode::General,
        );
        if let Some(custom) = system_prompt {
            final_system_prompt.push_str("\n\n--- ADDITIONAL INSTRUCTIONS ---\n");
            final_system_prompt.push_str(&custom);
        }

        // 3. Execute Stream
        let stream_result = self
            .ai_service
            .chat_stream(
                messages.clone(),
                Some(final_system_prompt),
                project_id.clone(),
            )
            .await;

        let mut stream = stream_result.map_err(|e| {
            let _ = self.app_handle.emit("trace-log", format!("ERROR: {}", e));
            e
        })?;

        let token = tokio_util::sync::CancellationToken::new();
        crate::services::cancellation_service::CANCELLATION_MANAGER
            .register_token("chat".to_string(), token.clone())
            .await;

        let mut full_content = String::new();
        let mut stream_error: Option<String> = None;
        use futures_util::StreamExt;

        while let Some(chunk) = stream.next().await {
            if token.is_cancelled() {
                let _ = self.app_handle.emit("trace-log", "Stream cancelled by user.");
                break;
            }
            match chunk {
                Ok(text) => {
                    full_content.push_str(&text);
                    let _ = self.app_handle.emit("chat-delta", text);
                }
                Err(e) => {
                    let err_msg = format!("Stream error: {}", e);
                    let _ = self.app_handle.emit("trace-log", format!("ERROR: {}", err_msg));
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
                let _ = self.save_history(pid, messages, &full_content).await;

                let changes = OutputParserService::parse_file_changes(&full_content);
                if !changes.is_empty() {
                    let _ = OutputParserService::apply_changes(pid, &changes);
                    let _ = self.app_handle.emit("file-changed", (pid.to_string(), "unknown".to_string()));
                }
            }
        }

        let _ = self.app_handle.emit("trace-log", "Streaming session completed.");

        Ok(ChatResponse {
            content: full_content,
            tool_calls: None,
            metadata: None,
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
}
