use anyhow::{anyhow, Result};
use async_trait::async_trait;
use reqwest::Client;
use serde_json::json;

use crate::models::ai::{ChatResponse, Message, OllamaConfig, ProviderType, Tool};
use crate::services::ai_provider::AIProvider;

pub struct OllamaProvider {
    pub config: OllamaConfig,
    client: Client,
}

impl OllamaProvider {
    pub fn new(config: OllamaConfig) -> Self {
        Self {
            config,
            client: Client::new(),
        }
    }
}

#[async_trait]
impl AIProvider for OllamaProvider {
    async fn chat(
        &self,
        messages: Vec<Message>,
        system_prompt: Option<String>,
        _tools: Option<Vec<Tool>>,
        _project_path: Option<String>,
    ) -> Result<ChatResponse> {
        let url = format!("{}/api/chat", self.config.api_url.trim_end_matches('/'));

        let mut final_messages = Vec::new();
        if let Some(sys) = system_prompt {
            final_messages.push(json!({ "role": "system", "content": sys }));
        }
        for msg in messages {
            final_messages.push(json!({ "role": msg.role, "content": msg.content }));
        }

        let body = json!({
            "model": self.config.model,
            "messages": final_messages,
            "stream": false
        });

        let token = tokio_util::sync::CancellationToken::new();
        crate::services::cancellation_service::CancellationService::global()
            .register_token("chat".to_string(), token.clone())
            .await;

        let res = tokio::select! {
            result = self.client.post(&url).json(&body).send() => {
                // Clear token on completion
                {
                    let manager = crate::services::cancellation_service::CANCELLATION_MANAGER.clone();
                    let mut tokens = manager.active_tokens.lock().await;
                    tokens.remove("chat");
                }
                result?
            }
            _ = token.cancelled() => {
                return Err(anyhow!("Ollama execution was cancelled."));
            }
        };

        if !res.status().is_success() {
            return Err(anyhow!("Ollama API error: status {}", res.status()));
        }

        let res_json: serde_json::Value = res.json().await?;

        let content = res_json
            .get("message")
            .and_then(|m| m.get("content"))
            .and_then(|c| c.as_str())
            .unwrap_or("")
            .to_string();

        Ok(ChatResponse {
            content,
            tool_calls: None,
            metadata: None,
        })
    }

    async fn chat_stream(
        &self,
        messages: Vec<Message>,
        system_prompt: Option<String>,
        _tools: Option<Vec<Tool>>,
        _project_path: Option<String>,
    ) -> Result<std::pin::Pin<Box<dyn futures_util::Stream<Item = Result<String>> + Send>>> {
        let url = format!("{}/api/chat", self.config.api_url.trim_end_matches('/'));

        let mut final_messages = Vec::new();
        if let Some(sys) = system_prompt {
            final_messages.push(json!({ "role": "system", "content": sys }));
        }
        for msg in messages {
            final_messages.push(json!({ "role": msg.role, "content": msg.content }));
        }

        let body = json!({
            "model": self.config.model,
            "messages": final_messages,
            "stream": true
        });

        let response = self.client.post(&url).json(&body).send().await?;

        if !response.status().is_success() {
            return Err(anyhow!("Ollama API error: status {}", response.status()));
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
                let val: serde_json::Value = serde_json::from_str(&line)?;
                if let Some(msg) = val.get("message") {
                    if let Some(content) = msg.get("content").and_then(|c| c.as_str()) {
                        yield content.to_string();
                    }
                }
                if val.get("done").and_then(|d| d.as_bool()).unwrap_or(false) {
                    break;
                }
            }
        };

        Ok(Box::pin(s))
    }

    async fn list_models(&self) -> Result<Vec<String>> {
        let url = format!("{}/api/tags", self.config.api_url.trim_end_matches('/'));
        let res = self.client.get(&url).send().await?;

        if !res.status().is_success() {
            return Err(anyhow!("Failed to list models: {}", res.status()));
        }

        let res_json: serde_json::Value = res.json().await?;
        let mut models = Vec::new();

        if let Some(list) = res_json.get("models").and_then(|v| v.as_array()) {
            for item in list {
                if let Some(name) = item.get("name").and_then(|n| n.as_str()) {
                    models.push(name.to_string());
                }
            }
        }

        Ok(models)
    }

    fn provider_type(&self) -> ProviderType {
        ProviderType::Ollama
    }
}
