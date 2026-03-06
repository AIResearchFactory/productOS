use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct McpServerConfig {
    pub id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub command: String,
    pub args: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub env: Option<HashMap<String, String>>,
    #[serde(alias = "secrets_env", skip_serializing_if = "Option::is_none")]
    pub secrets_env: Option<HashMap<String, String>>,
    pub enabled: bool,
    // Enhanced metadata
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stars: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub author: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub categories: Option<Vec<String>>,
    #[serde(alias = "iconUrl", skip_serializing_if = "Option::is_none")]
    pub icon_url: Option<String>,
}

impl McpServerConfig {
    /// Convert to a format suitable for CLI settings.json
    pub fn to_cli_mcp_config(&self) -> serde_json::Value {
        let env = self.env.clone().unwrap_or_default();

        // Note: `secrets_env` is intentionally NOT merged here. 
        // We inject them directly into the shell environment inside
        // `collect_mcp_secrets` right before execution to prevent
        // tokens from being saved dynamically in cleartext settings.json

        let trusted_command = matches!(
            self.command.as_str(),
            "npx" | "node" | "uvx" | "python" | "python3"
        );
        let trusted_source = matches!(self.source.as_deref(), Some("registry") | Some("mcpmarket"));

        serde_json::json!({
            "command": self.command,
            "args": self.args,
            "env": env,
            "timeout": 60000, // Default timeout
            "trust": trusted_command && trusted_source,
        })
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegistryResponse {
    pub servers: Vec<RegistryItem>,
    pub metadata: Option<RegistryMetadata>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegistryItem {
    pub server: RegistryServer,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegistryServer {
    pub name: String,
    pub description: Option<String>,
    pub version: Option<String>,
    pub packages: Option<Vec<RegistryPackage>>,
    pub title: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegistryPackage {
    #[serde(rename = "registryType")]
    pub registry_type: String,
    pub identifier: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegistryMetadata {
    #[serde(rename = "nextCursor")]
    pub next_cursor: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpMarketSearchResponse {
    pub tools: Vec<McpMarketTool>,
    pub pagination: Option<McpMarketPagination>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpMarketTool {
    pub name: String,
    pub description: Option<String>,
    pub github: Option<String>,
    pub github_stars: Option<u32>,
    pub owner: Option<McpMarketOwner>,
    pub categories: Option<Vec<McpMarketCategory>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpMarketOwner {
    pub name: String,
    pub avatar: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpMarketCategory {
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpMarketPagination {
    #[serde(rename = "hasMore")]
    pub has_more: bool,
}
