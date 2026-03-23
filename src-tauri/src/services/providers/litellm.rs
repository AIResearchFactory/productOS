use anyhow::{anyhow, Result};
use async_trait::async_trait;
use reqwest::Client;
use serde_json::json;

use crate::models::ai::{ChatResponse, LiteLlmConfig, Message, ProviderType, TaskIntent};
use crate::services::ai_provider::AIProvider;
use crate::services::secrets_service::SecretsService;

pub struct LiteLlmProvider {
    pub config: LiteLlmConfig,
    client: Client,
}

impl LiteLlmProvider {
    pub fn new(config: LiteLlmConfig) -> Self {
        Self {
            config,
            client: Client::new(),
        }
    }

    pub fn classify_intent(messages: &[Message]) -> TaskIntent {
        let latest_user = messages
            .iter()
            .rev()
            .find(|m| m.role.eq_ignore_ascii_case("user"))
            .map(|m| m.content.to_lowercase())
            .unwrap_or_default();

        let coding_markers = [
            "code",
            "bug",
            "rust",
            "typescript",
            "javascript",
            "python",
            "refactor",
            "function",
            "compile",
            "test",
            "fix",
        ];
        if coding_markers.iter().any(|m| latest_user.contains(m)) {
            return TaskIntent::Coding;
        }

        let research_markers = [
            "analyze",
            "analysis",
            "research",
            "compare",
            "tradeoff",
            "architecture",
            "deep dive",
            "investigate",
            "benchmark",
        ];
        if research_markers.iter().any(|m| latest_user.contains(m)) {
            return TaskIntent::Research;
        }

        let editing_markers = [
            "edit",
            "rewrite",
            "grammar",
            "format",
            "markdown",
            "shorten",
            "rephrase",
            "proofread",
        ];
        if editing_markers.iter().any(|m| latest_user.contains(m)) {
            return TaskIntent::Editing;
        }

        TaskIntent::General
    }

    pub fn model_for_intent(&self, intent: &TaskIntent) -> String {
        match intent {
            TaskIntent::Research => self.config.strategy.research_model.clone(),
            TaskIntent::Coding => self.config.strategy.coding_model.clone(),
            TaskIntent::Editing => self.config.strategy.editing_model.clone(),
            TaskIntent::General => self.config.strategy.default_model.clone(),
        }
    }
}

use crate::models::ai::chat_models::{ChatRequest, HealthStatus, ProviderCapability, ProviderMetadata};

#[async_trait]
impl AIProvider for LiteLlmProvider {
    async fn chat(
        &self,
        request: ChatRequest,
    ) -> Result<ChatResponse> {
        let api_key = SecretsService::get_secret(&self.config.api_key_secret_id)?
            .or_else(|| SecretsService::get_secret("LITELLM_API_KEY").ok().flatten())
            .ok_or_else(|| {
                anyhow!("LiteLLM API key not found. Please set it in Settings -> API Keys.")
            })?;

        let mut wire_messages = Vec::new();
        if let Some(system) = &request.system_prompt {
            wire_messages.push(json!({ "role": "system", "content": system }));
        }

        let intent = Self::classify_intent(&request.messages);

        for msg in &request.messages {
            wire_messages.push(json!({
                "role": msg.role,
                "content": msg.content,
            }));
        }
        let selected_model = self.model_for_intent(&intent);

        let body = json!({
            "model": selected_model,
            "messages": wire_messages,
            "stream": false,
            "temperature": request.options.temperature,
            "max_tokens": request.options.max_tokens,
            "top_p": request.options.top_p,
            "metadata": {
                "intent": format!("{:?}", intent).to_lowercase(),
            }
        });

        let base = self.config.base_url.trim_end_matches('/');
        let url = format!("{}/chat/completions", base);

        let response = self.client
            .post(url)
            .bearer_auth(api_key)
            .json(&body)
            .send()
            .await?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            let err_msg = format!("HTTP {}: {}", status, text);
            return Err(crate::services::ai_error_service::AIErrorService::map_error(
                &err_msg,
                &self.provider_type(),
                Some(&selected_model),
            ));
        }

        let json: serde_json::Value = response.json().await?;
        let content = json
            .get("choices")
            .and_then(|c| c.as_array())
            .and_then(|arr| arr.first())
            .and_then(|c| c.get("message"))
            .and_then(|m| m.get("content"))
            .and_then(|c| c.as_str())
            .ok_or_else(|| anyhow!("LiteLLM response missing choices[0].message.content"))?
            .to_string();

        let metadata = if let Some(usage) = json.get("usage") {
            let tokens_in = usage.get("prompt_tokens").and_then(|v| v.as_u64()).unwrap_or(0);
            let tokens_out = usage.get("completion_tokens").and_then(|v| v.as_u64()).unwrap_or(0);
            let tokens_cache_read = usage.get("cache_read_input_tokens").or(usage.get("prompt_tokens_details").and_then(|d| d.get("cached_tokens"))).and_then(|v| v.as_u64()).unwrap_or(0);
            let tokens_cache_write = usage.get("cache_creation_input_tokens").and_then(|v| v.as_u64()).unwrap_or(0);
            let tokens_reasoning = usage.get("completion_tokens_details").and_then(|d| d.get("reasoning_tokens")).and_then(|v| v.as_u64()).unwrap_or(0);
            
            Some(crate::models::ai::GenerationMetadata {
                confidence: 1.0,
                cost_usd: 0.0,
                model_used: selected_model,
                tokens_in,
                tokens_out,
                tokens_cache_read,
                tokens_cache_write,
                tokens_reasoning,
            })
        } else {
            None
        };

        Ok(ChatResponse { content, tool_calls: None, metadata })
    }

    async fn chat_stream(
        &self,
        request: ChatRequest,
    ) -> Result<std::pin::Pin<Box<dyn futures_util::Stream<Item = Result<String>> + Send>>> {
        let api_key = SecretsService::get_secret(&self.config.api_key_secret_id)?
            .or_else(|| SecretsService::get_secret("LITELLM_API_KEY").ok().flatten())
            .ok_or_else(|| {
                anyhow!("LiteLLM API key not found. Please set it in Settings -> API Keys.")
            })?;

        let mut wire_messages = Vec::new();
        if let Some(system) = &request.system_prompt {
            wire_messages.push(json!({ "role": "system", "content": system }));
        }

        let intent = Self::classify_intent(&request.messages);
        for msg in &request.messages {
            wire_messages.push(json!({
                "role": msg.role,
                "content": msg.content,
            }));
        }
        let selected_model = self.model_for_intent(&intent);

        let body = json!({
            "model": selected_model,
            "messages": wire_messages,
            "stream": true,
            "temperature": request.options.temperature,
            "max_tokens": request.options.max_tokens,
            "top_p": request.options.top_p,
        });

        let base = self.config.base_url.trim_end_matches('/');
        let url = format!("{}/chat/completions", base);

        let response = self.client
            .post(url)
            .bearer_auth(api_key)
            .json(&body)
            .send()
            .await?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            let err_msg = format!("HTTP {}: {}", status, text);
            return Err(crate::services::ai_error_service::AIErrorService::map_error(
                &err_msg,
                &self.provider_type(),
                Some(&selected_model),
            ));
        }

        use futures_util::StreamExt;
        let event_stream = response.bytes_stream();

        let s = async_stream::try_stream! {
            let stream_reader = tokio_util::io::StreamReader::new(
                futures_util::TryStreamExt::map_err(event_stream, |e| std::io::Error::new(std::io::ErrorKind::Other, e))
            );
            let mut reader = tokio_util::codec::FramedRead::new(
                stream_reader,
                tokio_util::codec::LinesCodec::new()
            );

            while let Some(line) = reader.next().await {
                let line = line?;
                if line.trim().is_empty() { continue; }
                if line.starts_with("data: ") {
                    let data = &line[6..];
                    if data == "[DONE]" { break; }
                    let val: serde_json::Value = serde_json::from_str(data)?;
                    if let Some(choices) = val.get("choices").and_then(|c| c.as_array()) {
                        if let Some(delta) = choices.first().and_then(|c| c.get("delta")) {
                            if let Some(content) = delta.get("content").and_then(|c| c.as_str()) {
                                yield content.to_string();
                            }
                        }
                    }
                }
            }
        };

        Ok(Box::pin(s))
    }

    async fn list_models(&self) -> Result<Vec<String>> {
        Ok(vec![
            self.config.strategy.default_model.clone(),
            self.config.strategy.research_model.clone(),
            self.config.strategy.coding_model.clone(),
            self.config.strategy.editing_model.clone(),
        ])
    }

    fn provider_type(&self) -> ProviderType {
        ProviderType::LiteLlm
    }

    fn is_available(&self) -> bool {
        self.config.enabled && !self.config.base_url.is_empty()
    }

    async fn check_authentication(&self) -> Result<bool> {
        let api_key = SecretsService::get_secret(&self.config.api_key_secret_id)?
            .or_else(|| SecretsService::get_secret("LITELLM_API_KEY").ok().flatten());
        Ok(api_key.is_some())
    }

    async fn check_health(&self) -> Result<HealthStatus> {
        let base = self.config.base_url.trim_end_matches('/');
        let url = format!("{}/health", base);
        match self.client.get(&url).send().await {
            Ok(res) if res.status().is_success() => Ok(HealthStatus::Healthy),
            Ok(res) => Ok(HealthStatus::Degraded(format!("LiteLLM returned status {}", res.status()))),
            Err(e) => Ok(HealthStatus::Unhealthy(format!("LiteLLM unreachable: {}", e))),
        }
    }

    fn metadata(&self) -> ProviderMetadata {
        ProviderMetadata {
            id: "litellm".to_string(),
            name: "LiteLLM Proxy".to_string(),
            description: "Unified API proxy for 100+ LLMs with automatic routing and fallback support.".to_string(),
            capabilities: vec![
                ProviderCapability::Chat,
                ProviderCapability::Stream,
            ],
            models: vec![],
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::ai::RoutingStrategy;

    fn make_msg(content: &str) -> Message {
        Message {
            role: "user".to_string(),
            content: content.to_string(),
            tool_calls: None,
            tool_results: None,
        }
    }

    fn test_config() -> LiteLlmConfig {
        LiteLlmConfig {
            enabled: true,
            base_url: "http://localhost:4000".to_string(),
            api_key_secret_id: "test-key".to_string(),
            strategy: RoutingStrategy {
                default_model: "gpt-4.1-mini".to_string(),
                research_model: "gemini-2.5-pro".to_string(),
                coding_model: "claude-sonnet-4".to_string(),
                editing_model: "gpt-4.1-nano".to_string(),
            },
            shadow_mode: false,
        }
    }

    // ===== L1: Coding intent classification =====
    #[test]
    fn test_classify_intent_coding_fix() {
        let msgs = vec![make_msg("fix this bug in rust")];
        assert_eq!(LiteLlmProvider::classify_intent(&msgs), TaskIntent::Coding);
    }

    #[test]
    fn test_classify_intent_coding_test() {
        let msgs = vec![make_msg("write a test for the login function")];
        assert_eq!(LiteLlmProvider::classify_intent(&msgs), TaskIntent::Coding);
    }

    #[test]
    fn test_classify_intent_coding_refactor() {
        let msgs = vec![make_msg("refactor this typescript module")];
        assert_eq!(LiteLlmProvider::classify_intent(&msgs), TaskIntent::Coding);
    }

    // ===== L2: Research intent classification =====
    #[test]
    fn test_classify_intent_research_analyze() {
        let msgs = vec![make_msg("analyze the market trends for AI startups")];
        assert_eq!(
            LiteLlmProvider::classify_intent(&msgs),
            TaskIntent::Research
        );
    }

    #[test]
    fn test_classify_intent_research_benchmark() {
        let msgs = vec![make_msg("benchmark these two approaches")];
        assert_eq!(
            LiteLlmProvider::classify_intent(&msgs),
            TaskIntent::Research
        );
    }

    // ===== L3: Editing intent classification =====
    #[test]
    fn test_classify_intent_editing_rewrite() {
        let msgs = vec![make_msg("rewrite this paragraph to be more concise")];
        assert_eq!(LiteLlmProvider::classify_intent(&msgs), TaskIntent::Editing);
    }

    #[test]
    fn test_classify_intent_editing_grammar() {
        let msgs = vec![make_msg("check the grammar of this document")];
        assert_eq!(LiteLlmProvider::classify_intent(&msgs), TaskIntent::Editing);
    }

    // ===== L4: General intent fallback =====
    #[test]
    fn test_classify_intent_general() {
        let msgs = vec![make_msg("hello, how are you today?")];
        assert_eq!(LiteLlmProvider::classify_intent(&msgs), TaskIntent::General);
    }

    #[test]
    fn test_classify_intent_empty_messages() {
        let msgs: Vec<Message> = vec![];
        assert_eq!(LiteLlmProvider::classify_intent(&msgs), TaskIntent::General);
    }

    #[test]
    fn test_classify_intent_uses_latest_user_message() {
        // System/assistant messages should be ignored; only latest user message counts
        let msgs = vec![
            Message {
                role: "assistant".to_string(),
                content: "Here is some code to fix".to_string(),
                tool_calls: None,
                tool_results: None,
            },
            make_msg("thanks, that looks great!"),
        ];
        // "thanks, that looks great!" has no coding/research/editing markers
        assert_eq!(LiteLlmProvider::classify_intent(&msgs), TaskIntent::General);
    }

    // ===== L5: model_for_intent routing =====
    #[test]
    fn test_model_for_intent_research() {
        let provider = LiteLlmProvider::new(test_config());
        assert_eq!(
            provider.model_for_intent(&TaskIntent::Research),
            "gemini-2.5-pro"
        );
    }

    #[test]
    fn test_model_for_intent_coding() {
        let provider = LiteLlmProvider::new(test_config());
        assert_eq!(
            provider.model_for_intent(&TaskIntent::Coding),
            "claude-sonnet-4"
        );
    }

    #[test]
    fn test_model_for_intent_editing() {
        let provider = LiteLlmProvider::new(test_config());
        assert_eq!(
            provider.model_for_intent(&TaskIntent::Editing),
            "gpt-4.1-nano"
        );
    }

    #[test]
    fn test_model_for_intent_general() {
        let provider = LiteLlmProvider::new(test_config());
        assert_eq!(
            provider.model_for_intent(&TaskIntent::General),
            "gpt-4.1-mini"
        );
    }
}
