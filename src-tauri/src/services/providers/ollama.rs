use async_trait::async_trait;
use anyhow::{Result, anyhow};
use reqwest::Client;
use serde_json::json;

use crate::models::ai::{Message, ChatResponse, Tool, ProviderType, OllamaConfig};
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
    async fn chat(&self, messages: Vec<Message>, system_prompt: Option<String>, _tools: Option<Vec<Tool>>, _project_path: Option<String>) -> Result<ChatResponse> {
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

        let res = self.client.post(&url)
            .json(&body)
            .send()
            .await?;

        if !res.status().is_success() {
            return Err(anyhow!("Ollama API error: status {}", res.status()));
        }

        let res_json: serde_json::Value = res.json().await?;
        
        let content = res_json.get("message")
            .and_then(|m| m.get("content"))
            .and_then(|c| c.as_str())
            .unwrap_or("")
            .to_string();

        Ok(ChatResponse { content, tool_calls: None })
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
