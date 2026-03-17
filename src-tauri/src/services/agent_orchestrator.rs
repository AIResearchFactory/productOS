use crate::models::ai::{ChatResponse, Message};
use crate::models::chat::ChatMessage;
use crate::services::ai_service::AIService;
use crate::services::chat_service::ChatService;
use crate::services::context_service::ContextService;
use crate::services::output_parser_service::OutputParserService;
use crate::services::research_log_service::ResearchLogService;
use crate::services::skill_service::SkillService;
use anyhow::{Context, Result};
use std::collections::HashMap;
use std::sync::Arc;

use tauri::{AppHandle, Emitter};

pub struct AgentOrchestrator {
    ai_service: Arc<AIService>,
    app_handle: AppHandle,
}

impl AgentOrchestrator {
    pub fn new(ai_service: Arc<AIService>, app_handle: AppHandle) -> Self {
        Self {
            ai_service,
            app_handle,
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
        let mut final_system_prompt =
            system_prompt.unwrap_or_else(|| "You are a helpful AI research assistant.".to_string());

        // 0a. Skill Injection
        let _ = self
            .app_handle
            .emit("trace-log", "Injecting skill instructions...");
        if let Some(ref sid) = skill_id {
            if let Ok(skill) = SkillService::load_skill(sid) {
                let params = skill_params.unwrap_or_default();
                if let Ok(rendered_skill) = skill.render_prompt(params) {
                    final_system_prompt.push_str("\n\n---\n");
                    final_system_prompt.push_str("SKILL INSTRUCTIONS:\n");
                    final_system_prompt.push_str(&rendered_skill);
                }
            }
        }

        // 0b. Context Injection (Stage C)
        let _ = self
            .app_handle
            .emit("trace-log", "Gathering project context...");
        if let Some(ref pid) = project_id {
            if let Ok(project_context) = ContextService::get_project_context(pid) {
                // Inject the gathered context
                final_system_prompt.push_str("\n\n---\n");
                final_system_prompt
                    .push_str("AUTOMATIC CONTEXT INJECTION (Project Files & History):\n");
                final_system_prompt.push_str(&project_context);
            }
        }

        // 0c. Workflow Injection
        let _ = self
            .app_handle
            .emit("trace-log", "Injecting available workflows...");
        if let Some(ref pid) = project_id {
            if let Ok(workflows) = crate::services::workflow_service::WorkflowService::load_project_workflows(pid) {
                if !workflows.is_empty() {
                    final_system_prompt.push_str("\n\n---\n");
                    final_system_prompt.push_str("AVAILABLE WORKFLOWS:\n");
                    for wf in workflows {
                        final_system_prompt.push_str(&format!("- {} (ID: {})\n", wf.name, wf.id));
                    }
                    final_system_prompt.push_str("\nTo execute a workflow, use the <SUGGEST_WORKFLOW> tag. Only suggest an existing workflow if it is strictly necessary for a multi-step project and the user explicitly requests structured automation. Always prefer responding directly in chat for information lookups or simple tool executions.\n");
                }
            }
        }

        // Tool execution is now managed natively by the providers (e.g. Claude Code, Gemini CLI).
        // No manual tool discovery or injection is performed here to prevent conflicts and slow response times.

        let provider_type = self.ai_service.get_active_provider_type().await;
        let _ = self.app_handle.emit(
            "trace-log",
            format!("Calling AI provider: {:?}", provider_type),
        );

        let chat_result = self
            .ai_service
            .chat(
                messages.clone(),
                Some(final_system_prompt),
                project_id.clone(),
            )
            .await;

        // 2. Handle metadata & logging (The "Observer" logic)
        if let Some(ref pid) = project_id {
            let provider_type = self.ai_service.get_active_provider_type().await;
            let provider_name = format!("{:?}", provider_type);

            match &chat_result {
                Ok(response) => {
                    // Log success
                    let _ =
                        ResearchLogService::log_event(pid, &provider_name, None, &response.content);

                    // Track Cost
                    if let Some(metadata) = &response.metadata {
                        if let Ok(project) = crate::services::project_service::ProjectService::load_project_by_id(pid) {
                            let cost_log_path = project.path.join(".metadata").join("cost_log.json");
                            let mut cost_log = crate::models::cost::CostLog::load(&cost_log_path).unwrap_or_default();
                            
                            let cost_usd = crate::models::cost::CostLog::compute_cost_usd(
                                &metadata.model_used, 
                                metadata.tokens_in, 
                                metadata.tokens_out
                            );

                            cost_log.add_record(crate::models::cost::CostRecord {
                                id: format!("cost-{}", chrono::Utc::now().timestamp_millis()),
                                timestamp: chrono::Utc::now(),
                                provider: provider_name.clone(),
                                model: metadata.model_used.clone(),
                                input_tokens: metadata.tokens_in,
                                output_tokens: metadata.tokens_out,
                                cost_usd,
                                artifact_id: None,
                                workflow_run_id: None,
                            });
                            
                            let _ = cost_log.save(&cost_log_path);
                            let _ = self.app_handle.emit("trace-log", format!("Cost Tracked: ${:.4} for {} tokens", cost_usd, metadata.tokens_in + metadata.tokens_out));
                        }
                    }

                    // Save chat history
                    let _ = self.app_handle.emit("trace-log", "Saving chat history...");
                    self.save_history(pid, messages, &response.content).await?;

                    // Apply file changes for ALL providers if detected
                    let changes = OutputParserService::parse_file_changes(&response.content);
                    if !changes.is_empty() {
                        let _ = self.app_handle.emit(
                            "trace-log",
                            format!("Detected {} file changes. Applying...", changes.len()),
                        );
                        OutputParserService::apply_changes(pid, &changes)?;
                        // Notify frontend to refresh file list
                        let _ = self.app_handle.emit("file-changed", (pid.to_string(), "unknown".to_string()));
                    }
                    let _ = self.app_handle.emit("trace-log", "Agent loop complete.");
                }
                Err(e) => {
                    let _ = self
                        .app_handle
                        .emit("trace-log", format!("ERROR in agent loop: {}", e));
                    // Log error
                    let _ = ResearchLogService::log_event(
                        pid,
                        &provider_name,
                        None,
                        &format!("ERROR: {}", e),
                    );
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
        let mut final_system_prompt =
            system_prompt.unwrap_or_else(|| "You are a helpful AI research assistant.".to_string());

        // 0a. Skill Injection
        let _ = self.app_handle.emit("trace-log", "Injecting skill instructions...");
        if let Some(ref sid) = skill_id {
            if let Ok(skill) = SkillService::load_skill(sid) {
                let params = skill_params.unwrap_or_default();
                if let Ok(rendered_skill) = skill.render_prompt(params) {
                    final_system_prompt.push_str("\n\n---\n");
                    final_system_prompt.push_str("SKILL INSTRUCTIONS:\n");
                    final_system_prompt.push_str(&rendered_skill);
                    let _ = self.app_handle.emit("trace-log", format!("Injected skill: {}", sid));
                }
            }
        }

        // 0b. Context Injection
        let _ = self.app_handle.emit("trace-log", "Gathering project context...");
        if let Some(ref pid) = project_id {
            if let Ok(project_context) = ContextService::get_project_context(pid) {
                final_system_prompt.push_str("\n\n---\n");
                final_system_prompt
                    .push_str("AUTOMATIC CONTEXT INJECTION (Project Files & History):\n");
                final_system_prompt.push_str(&project_context);
            }
        }

        // 0c. Workflow Injection
        let _ = self.app_handle.emit("trace-log", "Injecting available workflows...");
        if let Some(ref pid) = project_id {
            if let Ok(workflows) = crate::services::workflow_service::WorkflowService::load_project_workflows(pid) {
                if !workflows.is_empty() {
                    final_system_prompt.push_str("\n\n---\n");
                    final_system_prompt.push_str("AVAILABLE WORKFLOWS:\n");
                    for wf in workflows {
                        final_system_prompt.push_str(&format!("- {} (ID: {})\n", wf.name, wf.id));
                    }
                    final_system_prompt.push_str("\nTo execute a workflow, use the <SUGGEST_WORKFLOW> tag. Only suggest an existing workflow if it is strictly necessary for a multi-step project and the user explicitly requests structured automation. Always prefer responding directly in chat for information lookups or simple tool executions.\n");
                }
            }
        }

        let provider_type = self.ai_service.get_active_provider_type().await;
        let _ = self.app_handle.emit(
            "trace-log",
            format!("Calling AI provider (stream): {:?}", provider_type),
        );

        let stream_result = self
            .ai_service
            .chat_stream(
                messages.clone(),
                Some(final_system_prompt),
                project_id.clone(),
            )
            .await;

        let mut stream = match stream_result {
            Ok(s) => s,
            Err(e) => {
                let _ = self.app_handle.emit("trace-log", format!("ERROR starting stream: {}", e));
                if let Some(ref pid) = project_id {
                    let provider_name = format!("{:?}", provider_type);
                    let _ = ResearchLogService::log_event(pid, &provider_name, None, &format!("ERROR: {}", e));
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
                log::info!("Chat stream cancelled by user");
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
                    log::error!("{}", err_msg);
                    let _ = self.app_handle.emit("trace-log", format!("ERROR in stream: {}", e));
                    stream_error = Some(err_msg);
                    break;
                }
            }
        }

        // Clean up token
        {
            let mut tokens = crate::services::cancellation_service::CANCELLATION_MANAGER
                .active_tokens
                .lock()
                .await;
            tokens.remove("chat");
        }

        let provider_name = format!("{:?}", provider_type);

        // Detect empty response (provider returned nothing without an explicit error)
        if stream_error.is_none() && full_content.is_empty() {
            let empty_msg = "WARNING: AI provider returned an empty response. The provider may be misconfigured or unavailable.".to_string();
            log::warn!("{}", empty_msg);
            let _ = self.app_handle.emit("trace-log", format!("ERROR: {}", empty_msg));
            if let Some(ref pid) = project_id {
                let _ = ResearchLogService::log_event(pid, &provider_name, None, &format!("ERROR: {}", empty_msg));
            }
        }

        // Finalize (Save history, log, apply changes)
        if let Some(ref pid) = project_id {
            if let Some(ref err_msg) = stream_error {
                let _ = self.app_handle.emit("trace-log", format!("ERROR in agent loop: {}", err_msg));
                let _ = ResearchLogService::log_event(pid, &provider_name, None, &format!("ERROR: {}", err_msg));
            } else if !full_content.is_empty() {
                let _ = ResearchLogService::log_event(pid, &provider_name, None, &full_content);
                let _ = self.app_handle.emit("trace-log", "Saving chat history...");
                let _ = self.save_history(pid, messages, &full_content).await;

                let changes = OutputParserService::parse_file_changes(&full_content);
                if !changes.is_empty() {
                    let _ = self.app_handle.emit(
                        "trace-log",
                        format!("Detected {} file changes. Applying...", changes.len()),
                    );
                    let _ = OutputParserService::apply_changes(pid, &changes);
                    let _ = self.app_handle.emit("file-changed", (pid.to_string(), "unknown".to_string()));
                }
            }
        }

        let _ = self.app_handle.emit("trace-log", "Agent loop (stream) complete.");

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
