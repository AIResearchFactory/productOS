use crate::models::mcp::McpServerConfig;
use crate::services::settings_service::SettingsService;
use crate::services::secrets_service::SecretsService;
use anyhow::{Result, anyhow};
use std::path::{Path, PathBuf};
use serde_json::json;
use std::collections::HashMap;

pub enum CliType {
    Gemini,
    Claude,
    Custom(String),
}

pub struct CliConfigService;

impl CliConfigService {
    pub fn get_global_config_path(cli_type: &CliType) -> Option<PathBuf> {
        match cli_type {
            CliType::Gemini => dirs::home_dir().map(|h| h.join(".gemini").join("settings.json")),
            CliType::Claude => dirs::home_dir().map(|h| h.join(".claude").join("settings.json")),
            CliType::Custom(id) => {
                let settings = SettingsService::load_global_settings().ok()?;
                let custom_cli = settings.custom_clis.iter().find(|c| &c.id == id)?;
                custom_cli.settings_file_path.as_ref().map(|p| Self::resolve_home_dir(p))
            }
        }
    }

    /// Helper to resolve a path that might contain a '~' home directory prefix
    fn resolve_home_dir(path: &Path) -> PathBuf {
        let path_str = path.to_string_lossy();
        if path_str.starts_with("~/") {
            if let Some(home) = dirs::home_dir() {
                return home.join(&path_str[2..]);
            }
        } else if path_str == "~" {
            return dirs::home_dir().unwrap_or_else(|| path.to_path_buf());
        }
        path.to_path_buf()
    }

    /// Sync the current MCP configuration into the global CLI config file
    pub async fn sync_with_global_config(cli_type: &CliType) -> Result<PathBuf> {
        let config_path = Self::get_global_config_path(cli_type)
            .ok_or_else(|| anyhow!("Could not determine global config path for this CLI"))?;

        let settings = SettingsService::load_global_settings()
            .map_err(|e| anyhow!("Failed to load global settings: {}", e))?;

        let enabled_servers: HashMap<String, serde_json::Value> = settings.mcp_servers
            .iter()
            .filter(|s| s.enabled)
            .map(|s| (s.id.clone(), s.to_cli_mcp_config()))
            .collect();

        // Load existing config if it exists
        let mut config_json = if config_path.exists() {
            let content = std::fs::read_to_string(&config_path)?;
            serde_json::from_str(&content).unwrap_or_else(|_| json!({}))
        } else {
            json!({})
        };

        // Merge mcpServers
        if let Some(obj) = config_json.as_object_mut() {
            obj.insert("mcpServers".to_string(), json!(enabled_servers));
        }

        // Ensure directory exists
        if let Some(parent) = config_path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        let content = serde_json::to_string_pretty(&config_json)?;
        std::fs::write(&config_path, content)?;

        Ok(config_path)
    }

    /// Get the resolved config file path. If a custom path is provided, it is returned.
    pub fn get_cli_config_path(cli_type: &CliType, custom_path: Option<PathBuf>, project_path: &Path) -> PathBuf {
        if let Some(path) = custom_path {
            return path;
        }

        // Default local path for miscellaneous configuration
        let cli_dir = project_path.join(".metadata").join("cli");
        match cli_type {
            CliType::Custom(id) => cli_dir.join(id).join("config.json"),
            _ => cli_dir.join("mcp-config.json"), // Fallback default
        }
    }

    /// Check if the configuration needs to be regenerated
    pub fn should_regenerate_config(config_path: &Path) -> bool {
        if !config_path.exists() {
            return true;
        }

        // Ideally compare with global settings mod time
        // For now, let's just always generate if we want to be safe, 
        // but timestamp check is better for performance.
        let settings_path = match crate::utils::paths::get_global_settings_path() {
            Ok(p) => p,
            Err(_) => return true,
        };

        let config_meta = match std::fs::metadata(config_path) {
            Ok(m) => m,
            Err(_) => return true,
        };

        let settings_meta = match std::fs::metadata(settings_path) {
            Ok(m) => m,
            Err(_) => return true,
        };

        match (config_meta.modified(), settings_meta.modified()) {
            (Ok(c_time), Ok(s_time)) => c_time < s_time,
            _ => true,
        }
    }

    /// Generate MCP configuration file for a specific CLI
    pub async fn generate_cli_mcp_config(cli_type: &CliType, config_path: &Path) -> Result<PathBuf> {
        let settings = SettingsService::load_global_settings()
            .map_err(|e| anyhow!("Failed to load global settings: {}", e))?;

        let enabled_servers: HashMap<String, serde_json::Value> = settings.mcp_servers
            .iter()
            .filter(|s| s.enabled)
            .map(|s| (s.id.clone(), s.to_cli_mcp_config()))
            .collect();

        let config_json = json!({
            "mcpServers": enabled_servers
        });

        // Ensure directory exists
        if let Some(parent) = config_path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        let content = serde_json::to_string_pretty(&config_json)?;
        std::fs::write(config_path, content)?;

        Ok(config_path.to_path_buf())
    }

    /// Collect all secrets required by enabled MCP servers
    pub fn collect_mcp_secrets() -> Result<HashMap<String, String>> {
        let settings = SettingsService::load_global_settings()
            .map_err(|e| anyhow!("Failed to load global settings: {}", e))?;

        let mut all_secrets = HashMap::new();
        for server in settings.mcp_servers.iter().filter(|s| s.enabled) {
            if let Some(secrets_env) = &server.secrets_env {
                for (_, var_name) in secrets_env {
                    if let Some(secret_value) = SecretsService::get_secret(var_name)? {
                        all_secrets.insert(var_name.clone(), secret_value);
                    }
                }
            }
        }

        Ok(all_secrets)
    }
}
