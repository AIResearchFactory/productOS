use crate::models::ai::{ChatResponse, Message};
use crate::models::chat::ChatMessage;
use crate::services::ai_service::AIService;
use crate::services::chat_service::ChatService;
use crate::services::context_service::ContextService;
use crate::services::output_parser_service::OutputParserService;
use crate::services::providers::litellm::LiteLlmProvider;
use crate::services::research_log_service::ResearchLogService;
use crate::services::settings_service::SettingsService;
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

        // 0c. Tool Discovery & Trace
        let provider_type = self.ai_service.get_active_provider_type().await;
        if self.ai_service.supports_mcp().await {
            let _ = self.app_handle.emit("trace-log", "Fetching tools from enabled MCP servers...");
            match self.ai_service.get_mcp_tools().await {
                Ok(tools) => {
                    if tools.is_empty() {
                        let _ = self.app_handle.emit("trace-log", "No tools found in enabled MCP servers. Check server status and configuration.");
                    } else {
                        let _ = self.app_handle.emit("trace-log", format!("Capability Discovery: Found {} tools from MCP servers.", tools.len()));
                        for tool in &tools {
                            let _ = self.app_handle.emit("trace-log", format!("  - Tool available: {}", tool.name));
                        }
                    }
                },
                Err(e) => {
                    let _ = self.app_handle.emit("trace-log", format!("MCP Tool Discovery Error: {}", e));
                }
            }
        } else {
            let _ = self.app_handle.emit("trace-log", format!("Current AI provider ({:?}) does not support external tools. Using built-in capabilities only.", provider_type));
            if provider_type == crate::models::ai::ProviderType::ClaudeCode {
                let _ = self.app_handle.emit("trace-log", "Note: Claude Code CLI manages its own toolset. To use MCP servers configured here, please switch to Claude API.");
            }
        }

        // 1. Execute the AI call (Loop for tool calls)
        let _ = self.app_handle.emit("trace-log", format!("Calling AI provider: {:?}", provider_type));
        
        let mut messages = messages.clone();
        let mut chat_result = self.ai_service.chat(messages.clone(), Some(final_system_prompt.clone()), project_id.clone()).await;

        // Tool Loop
        let mut iterations = 0;
        while iterations < 10 { // Limit to 10 tool calls per turn
            match &chat_result {
                Ok(response) => {
                    if let Some(tool_calls) = &response.tool_calls {
                        let _ = self.app_handle.emit("trace-log", format!("AI requested {} tool calls...", tool_calls.len()));
                        
                        // Add assistant response to history BEFORE tool results
                        messages.push(Message {
                            role: "assistant".to_string(),
                            content: response.content.clone(),
                            tool_calls: Some(tool_calls.clone()),
                            tool_results: None,
                        });

                        let mut tool_results = Vec::new();
                        for tc in tool_calls {
                            let _ = self.app_handle.emit("trace-log", format!("Executing tool: {}...", tc.function.name));
                            
                            let args: serde_json::Value = serde_json::from_str(&tc.function.arguments).unwrap_or(serde_json::json!({}));
                            let result = match self.ai_service.call_mcp_tool(&tc.function.name, args).await {
                                Ok(res) => {
                                    let content = serde_json::to_string(&res).unwrap_or_default();
                                    // println!("TOOL RESULT: {}", content);
                                    crate::models::ai::ToolResult {
                                        tool_use_id: tc.id.clone(),
                                        content,
                                        is_error: false,
                                    }
                                },
                                Err(e) => {
                                    let content = format!("Error: {}", e);
                                    let _ = self.app_handle.emit("trace-log", format!("Tool {} failed: {}", tc.function.name, e));
                                    crate::models::ai::ToolResult {
                                        tool_use_id: tc.id.clone(),
                                        content,
                                        is_error: true,
                                    }
                                }
                            };
                            tool_results.push(result);
                        }

                        // Add tool results message
                        messages.push(Message {
                            role: "user".to_string(),
                            content: String::new(),
                            tool_calls: None,
                            tool_results: Some(tool_results),
                        });

                        // Call AI again with results
                        let _ = self.app_handle.emit("trace-log", "Sending tool results back to AI...");
                        chat_result = self.ai_service.chat(messages.clone(), Some(final_system_prompt.clone()), project_id.clone()).await;
                        iterations += 1;
                        continue;
                    }
                }
                Err(_) => break,
            }
            break;
        }
        // 1. Optional Shadow Routing (observe-only)
        if let Ok(settings) = SettingsService::load_global_settings() {
            if settings.litellm.enabled && settings.litellm.shadow_mode {
                let intent = LiteLlmProvider::classify_intent(&messages);
                let chosen_model = match intent {
                    crate::models::ai::TaskIntent::Research => {
                        settings.litellm.strategy.research_model
                    }
                    crate::models::ai::TaskIntent::Coding => settings.litellm.strategy.coding_model,
                    crate::models::ai::TaskIntent::Editing => {
                        settings.litellm.strategy.editing_model
                    }
                    crate::models::ai::TaskIntent::General => {
                        settings.litellm.strategy.default_model
                    }
                };
                let _ = self.app_handle.emit(
                    "trace-log",
                    format!(
                        "[Shadow Router] intent={:?} suggested_model={}",
                        intent, chosen_model
                    ),
                );
            }
        }

        // 2. Execute the AI call
        let _ = self.app_handle.emit(
            "trace-log",
            format!(
                "Calling AI provider: {:?}",
                self.ai_service.get_active_provider_type().await
            ),
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
                    let _ = self
                        .app_handle
                        .emit("trace-log", "Received response. Processing metadata...");
                    // Log success
                    let _ =
                        ResearchLogService::log_event(pid, &provider_name, None, &response.content);

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
