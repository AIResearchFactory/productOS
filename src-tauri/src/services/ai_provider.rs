use crate::models::ai::{ChatResponse, ProviderType};
use crate::models::ai::chat_models::{ChatRequest, HealthStatus, ProviderMetadata};
use anyhow::Result;
use async_trait::async_trait;
use std::pin::Pin;

#[async_trait]
pub trait AIProvider: Send + Sync {
    async fn chat(
        &self,
        request: ChatRequest,
    ) -> Result<ChatResponse>;

    async fn chat_stream(
        &self,
        request: ChatRequest,
    ) -> Result<Pin<Box<dyn futures_util::Stream<Item = Result<String>> + Send>>>;

    async fn resolve_model(&self) -> String {
        "".to_string() 
    }

    async fn list_models(&self) -> Result<Vec<String>>;

    fn supports_mcp(&self) -> bool {
        false
    }

    fn provider_type(&self) -> ProviderType;

    /// Pluggable detection for CLI availability
    fn is_available(&self) -> bool;

    /// Verification of authentication (e.g., OAuth session or API key check)
    async fn check_authentication(&self) -> Result<bool>;

    /// Detailed health/status reporting
    async fn check_health(&self) -> Result<HealthStatus> {
        if self.is_available() {
            if self.check_authentication().await.unwrap_or(false) {
                Ok(HealthStatus::Healthy)
            } else {
                Ok(HealthStatus::Unhealthy("Authentication missing".to_string()))
            }
        } else {
            Ok(HealthStatus::Unhealthy("CLI not detected".to_string()))
        }
    }

    /// Provider capabilities and metadata
    fn metadata(&self) -> ProviderMetadata;
}
