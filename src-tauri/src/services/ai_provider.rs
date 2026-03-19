use crate::models::ai::{ChatResponse, Message, ProviderType, Tool};
use anyhow::Result;
use async_trait::async_trait;
use std::pin::Pin;

#[async_trait]
pub trait AIProvider: Send + Sync {
    async fn chat(
        &self,
        messages: Vec<Message>,
        system_prompt: Option<String>,
        tools: Option<Vec<Tool>>,
        project_path: Option<String>,
    ) -> Result<ChatResponse>;

    async fn chat_stream(
        &self,
        messages: Vec<Message>,
        system_prompt: Option<String>,
        tools: Option<Vec<Tool>>,
        project_path: Option<String>,
    ) -> Result<Pin<Box<dyn futures_util::Stream<Item = Result<String>> + Send>>>;
    async fn resolve_model(&self) -> String {
        "".to_string() // Placeholder, override in implementations
    }
    async fn list_models(&self) -> Result<Vec<String>>;
    fn supports_mcp(&self) -> bool {
        false
    }
    fn provider_type(&self) -> ProviderType;
}
