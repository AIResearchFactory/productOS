use std::collections::HashMap;
use std::process::Stdio;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, Command};
use serde::{Serialize, Deserialize};
use serde_json::{json, Value};
use anyhow::{Result, anyhow};
use std::sync::Arc;
use tokio::sync::Mutex;
use crate::models::mcp::McpServerConfig;
use crate::services::settings_service::SettingsService;
use crate::services::secrets_service::SecretsService;

#[derive(Debug, Serialize, Deserialize)]
pub struct McpTool {
    pub name: String,
    pub description: String,
    pub input_schema: Value,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ToolCallResponse {
    pub content: Vec<Value>,
    #[serde(default)]
    pub is_error: bool,
}

pub struct McpServer {
    pub config: McpServerConfig,
    child: Option<Child>,
}

pub struct McpService {
    active_servers: Arc<Mutex<HashMap<String, McpServer>>>,
}

impl McpService {
    pub fn new() -> Self {
        Self {
            active_servers: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub async fn get_tools(&self) -> Result<Vec<McpTool>> {
        let settings = SettingsService::load_global_settings().map_err(|e| anyhow!(e))?;
        let mut all_tools = Vec::new();

        log::info!("MCP Discovery: Checking {} configured servers", settings.mcp_servers.len());

        for config in settings.mcp_servers.iter().filter(|s| s.enabled) {
            log::info!("MCP Discovery: Fetching tools from enabled server '{}' ({})", config.name, config.id);
            match self.get_server_tools(config).await {
                Ok(tools) => {
                    log::info!("MCP Discovery: Found {} tools for '{}'", tools.len(), config.name);
                    all_tools.extend(tools);
                },
                Err(e) => log::warn!("MCP Discovery: Failed to get tools from {}: {}", config.name, e),
            }
        }

        Ok(all_tools)
    }

    async fn get_server_tools(&self, config: &McpServerConfig) -> Result<Vec<McpTool>> {
        let mut server = self.start_server(config).await?;
        
        let response = self.call_json_rpc(&mut server, "tools/list", json!({})).await?;
        
        let tools_val = response.get("tools").ok_or_else(|| anyhow!("No tools in response"))?;
        let tools: Vec<McpTool> = serde_json::from_value(tools_val.clone())?;
        
        // Prefix tool names with server ID to avoid collisions
        let prefixed_tools = tools.into_iter().map(|mut t| {
            t.name = format!("{}__{}", config.id, t.name);
            t
        }).collect();

        Ok(prefixed_tools)
    }

    pub async fn call_tool(&self, tool_name: &str, arguments: Value) -> Result<Value> {
        let parts: Vec<&str> = tool_name.split("__").collect();
        if parts.len() < 2 {
            return Err(anyhow!("Invalid tool name format: {}", tool_name));
        }

        let server_id = parts[0];
        let original_tool_name = parts[1..].join("__");

        let settings = SettingsService::load_global_settings().map_err(|e| anyhow!(e))?;
        let config = settings.mcp_servers.iter()
            .find(|s| s.id == server_id)
            .ok_or_else(|| anyhow!("MCP server {} not found", server_id))?;

        let mut server = self.start_server(config).await?;
        
        let response = self.call_json_rpc(&mut server, "tools/call", json!({
            "name": original_tool_name,
            "arguments": arguments
        })).await?;

        Ok(response)
    }

    async fn start_server(&self, config: &McpServerConfig) -> Result<McpServer> {
        // For now, we'll start a new process for each request to keep it simple and stateless
        // In the future, we could keep processes alive
        
        let mut command = Command::new(&config.command);
        command.args(&config.args);
        command.stdin(Stdio::piped())
               .stdout(Stdio::piped())
               .stderr(Stdio::piped());

        // Setup environment
        if let Some(env) = &config.env {
            for (k, v) in env {
                command.env(k, v);
            }
        }

        // Setup secret environment
        if let Some(secrets_env) = &config.secrets_env {
            log::debug!("MCP {}: Setting up {} secrets", config.id, secrets_env.len());
            for (k, secret_id) in secrets_env {
                match SecretsService::get_secret(secret_id) {
                    Ok(Some(secret_val)) => {
                        log::debug!("  - Setting env {} from secret {}", k, secret_id);
                        command.env(k, secret_val);
                    },
                    Ok(None) => log::warn!("  - Secret {} not found for env {}", secret_id, k),
                    Err(e) => log::error!("  - Failed to get secret {}: {}", secret_id, e),
                }
            }
        }

        let child = command.spawn().map_err(|e| anyhow!("Failed to spawn MCP server {}: {}", config.name, e))?;
        
        let mut server = McpServer {
            config: config.clone(),
            child: Some(child),
        };

        // Initialize MCP
        self.initialize_server(&mut server).await?;

        Ok(server)
    }

    async fn initialize_server(&self, server: &mut McpServer) -> Result<()> {
        let _response = self.call_json_rpc(server, "initialize", json!({
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "clientInfo": {
                "name": "ai-researcher",
                "version": "1.0.0"
            }
        })).await?;

        // Send initialized notification
        self.send_notification(server, "notifications/initialized", json!({})).await?;

        Ok(())
    }

    async fn call_json_rpc(&self, server: &mut McpServer, method: &str, params: Value) -> Result<Value> {
        let request_id = 1; // Simplification: we use 1 for everything since we are synchronous here
        let request = json!({
            "jsonrpc": "2.0",
            "id": request_id,
            "method": method,
            "params": params
        });

        let child = server.child.as_mut().ok_or_else(|| anyhow!("Server child not found"))?;
        let stdin = child.stdin.as_mut().ok_or_else(|| anyhow!("Stdin not found"))?;
        let stdout = child.stdout.as_mut().ok_or_else(|| anyhow!("Stdout not found"))?;
        
        let request_str = serde_json::to_string(&request)? + "\n";
        stdin.write_all(request_str.as_bytes()).await?;
        stdin.flush().await?;

        let mut reader = BufReader::new(stdout).lines();
        while let Some(line) = reader.next_line().await? {
            if line.trim().is_empty() { continue; }
            
            let response: Value = match serde_json::from_str(&line) {
                Ok(v) => v,
                Err(e) => {
                    log::debug!("MCP {}: Ignoring non-JSON/invalid output: {}. Error: {}", server.config.id, line, e);
                    continue;
                }
            };
            
            if response.get("id") == Some(&json!(request_id)) {
                if let Some(error) = response.get("error") {
                    return Err(anyhow!("MCP server {} returned error: {}", server.config.id, error));
                }
                return Ok(response.get("result").cloned().unwrap_or(Value::Null));
            }
        }

        Err(anyhow!("MCP server closed connection without response"))
    }

    async fn send_notification(&self, server: &mut McpServer, method: &str, params: Value) -> Result<()> {
        let notification = json!({
            "jsonrpc": "2.0",
            "method": method,
            "params": params
        });

        let child = server.child.as_mut().ok_or_else(|| anyhow!("Server child not found"))?;
        let stdin = child.stdin.as_mut().ok_or_else(|| anyhow!("Stdin not found"))?;
        
        let msg = serde_json::to_string(&notification)? + "\n";
        stdin.write_all(msg.as_bytes()).await?;
        stdin.flush().await?;

        Ok(())
    }
}
