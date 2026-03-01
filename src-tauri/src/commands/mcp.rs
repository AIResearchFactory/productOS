use crate::models::mcp::{McpMarketSearchResponse, McpServerConfig, RegistryResponse};
use crate::services::settings_service::SettingsService;
use reqwest::header::{HeaderMap, HeaderValue, USER_AGENT};
use std::collections::HashSet;

#[tauri::command]
pub async fn get_mcp_servers() -> Result<Vec<McpServerConfig>, String> {
    let settings = SettingsService::load_global_settings()
        .map_err(|e| format!("Failed to load global settings: {}", e))?;
    Ok(settings.mcp_servers)
}

#[tauri::command]
pub async fn add_mcp_server(config: McpServerConfig) -> Result<(), String> {
    let mut settings = SettingsService::load_global_settings()
        .map_err(|e| format!("Failed to load global settings: {}", e))?;

    // If ID already exists, update it, otherwise push new
    if let Some(index) = settings.mcp_servers.iter().position(|s| s.id == config.id) {
        settings.mcp_servers[index] = config;
    } else {
        settings.mcp_servers.push(config);
    }

    SettingsService::save_global_settings(&settings)
        .map_err(|e| format!("Failed to save global settings: {}", e))
}

#[tauri::command]
pub async fn remove_mcp_server(id: String) -> Result<(), String> {
    let mut settings = SettingsService::load_global_settings()
        .map_err(|e| format!("Failed to load global settings: {}", e))?;

    settings.mcp_servers.retain(|s| s.id != id);

    SettingsService::save_global_settings(&settings)
        .map_err(|e| format!("Failed to save global settings: {}", e))
}

#[tauri::command]
pub async fn toggle_mcp_server(id: String, enabled: bool) -> Result<(), String> {
    let mut settings = SettingsService::load_global_settings()
        .map_err(|e| format!("Failed to load global settings: {}", e))?;

    if let Some(server) = settings.mcp_servers.iter_mut().find(|s| s.id == id) {
        server.enabled = enabled;
    } else {
        return Err(format!("MCP server with ID '{}' not found", id));
    }

    SettingsService::save_global_settings(&settings)
        .map_err(|e| format!("Failed to save global settings: {}", e))
}

#[tauri::command]
pub async fn update_mcp_server(config: McpServerConfig) -> Result<(), String> {
    let mut settings = SettingsService::load_global_settings()
        .map_err(|e| format!("Failed to load global settings: {}", e))?;

    if let Some(index) = settings.mcp_servers.iter().position(|s| s.id == config.id) {
        settings.mcp_servers[index] = config;
    } else {
        return Err(format!("MCP server with ID '{}' not found", config.id));
    }

    SettingsService::save_global_settings(&settings)
        .map_err(|e| format!("Failed to save global settings: {}", e))
}

#[tauri::command]
pub async fn fetch_mcp_marketplace(query: Option<String>) -> Result<Vec<McpServerConfig>, String> {
    let client = reqwest::Client::new();
    let mut all_servers = Vec::new();

    // Helper to check if a server matches the query
    let matches_query = |name: &str, desc: Option<&str>, q: &Option<String>| match q {
        None => true,
        Some(query_str) => {
            let low_q = query_str.to_lowercase();
            name.to_lowercase().contains(&low_q)
                || desc
                    .map(|d| d.to_lowercase().contains(&low_q))
                    .unwrap_or(false)
        }
    };

    // 0. Manual injection of core and PM-focused tools to ensure they are "out of the box"
    let core_tools = vec![
        McpServerConfig {
            id: "aha-mcp".to_string(),
            name: "Aha!".to_string(),
            description: Some("Connect to Aha! Product Management to manage initiatives, requirements, and releases.".to_string()),
            command: "npx".to_string(),
            args: vec!["-y".to_string(), "@cedricziel/aha-mcp".to_string()],
            env: None,
            secrets_env: None,
            enabled: false,
            stars: None,
            author: Some("Cedric Ziel".to_string()),
            source: Some("registry".to_string()),
            categories: Some(vec!["Product Management".to_string(), "Featured".to_string()]),
            icon_url: None,
        },
        McpServerConfig {
            id: "jira-mcp".to_string(),
            name: "Jira".to_string(),
            description: Some("Manage Jira issues, sprints, and projects directly from your AI assistant.".to_string()),
            command: "npx".to_string(),
            args: vec!["-y".to_string(), "@modelcontextprotocol/server-jira".to_string()],
            env: None,
            secrets_env: None,
            enabled: false,
            stars: None,
            author: Some("MCP Official".to_string()),
            source: Some("registry".to_string()),
            categories: Some(vec!["Product Management".to_string(), "Featured".to_string()]),
            icon_url: None,
        },
        McpServerConfig {
            id: "monday-mcp".to_string(),
            name: "Monday.com".to_string(),
            description: Some("Interact with Monday.com boards and items to track work and collaboration.".to_string()),
            command: "npx".to_string(),
            args: vec!["-y".to_string(), "@mondaydotcomorg/mcp-server".to_string()],
            env: None,
            secrets_env: None,
            enabled: false,
            stars: None,
            author: Some("Monday.com".to_string()),
            source: Some("registry".to_string()),
            categories: Some(vec!["Productivity".to_string(), "Featured".to_string()]),
            icon_url: None,
        },
        McpServerConfig {
            id: "productboard-mcp".to_string(),
            name: "ProductBoard".to_string(),
            description: Some("Access Productboard insights, features, and roadmaps.".to_string()),
            command: "npx".to_string(),
            args: vec!["-y".to_string(), "productboard-mcp-server".to_string()],
            env: None,
            secrets_env: None,
            enabled: false,
            stars: None,
            author: Some("ProductBoard".to_string()),
            source: Some("registry".to_string()),
            categories: Some(vec!["Product Management".to_string(), "Featured".to_string()]),
            icon_url: None,
        },
        McpServerConfig {
            id: "mcp-github".to_string(),
            name: "GitHub".to_string(),
            description: Some("Interact with repositories, issues, and pull requests on GitHub.".to_string()),
            command: "npx".to_string(),
            args: vec!["-y".to_string(), "@modelcontextprotocol/server-github".to_string()],
            env: None,
            secrets_env: None,
            enabled: false,
            stars: None,
            author: Some("MCP Official".to_string()),
            source: Some("registry".to_string()),
            categories: Some(vec!["Core".to_string(), "Featured".to_string()]),
            icon_url: None,
        },
        McpServerConfig {
            id: "mcp-filesystem".to_string(),
            name: "Filesystem".to_string(),
            description: Some("Read and write access to your local filesystem with full safety controls.".to_string()),
            command: "npx".to_string(),
            args: vec!["-y".to_string(), "@modelcontextprotocol/server-filesystem".to_string()],
            env: None,
            secrets_env: None,
            enabled: false,
            stars: None,
            author: Some("MCP Official".to_string()),
            source: Some("registry".to_string()),
            categories: Some(vec!["Core".to_string(), "Featured".to_string()]),
            icon_url: None,
        },
    ];

    for tool in core_tools {
        if matches_query(&tool.name, tool.description.as_deref(), &query) {
            all_servers.push(tool);
        }
    }

    // 1. Try fetching from mcpmarket.com for broader coverage and richer data
    let market_url = format!(
        "https://mcpmarket.com/api/search?query={}",
        query.as_deref().unwrap_or("")
    );

    let mut headers = HeaderMap::new();
    headers.insert(
        USER_AGENT,
        HeaderValue::from_static("AI-Researcher-App/0.1"),
    );

    if let Ok(res) = client
        .get(&market_url)
        .headers(headers.clone())
        .timeout(std::time::Duration::from_secs(5))
        .send()
        .await
    {
        if res.status().is_success() {
            if let Ok(market_data) = res.json::<McpMarketSearchResponse>().await {
                for tool in market_data.tools {
                    let id = tool
                        .github
                        .clone()
                        .unwrap_or(tool.name.clone())
                        .replace("/", "-");

                    // Skip if already in our list (e.g. from manual injection)
                    if all_servers
                        .iter()
                        .any(|s| s.name.to_lowercase() == tool.name.to_lowercase() || s.id == id)
                    {
                        continue;
                    }

                    let config = McpServerConfig {
                        id: id.clone(),
                        name: {
                            // Sanitise technical names like "io.github.owner/repo" or "owner/repo"
                            let raw = tool.name.clone();
                            let base = if raw.contains('/') {
                                raw.split('/').last().unwrap_or(&raw).to_string()
                            } else {
                                raw
                            };
                            // Title case or replace dashes/dots with spaces
                            base.replace('-', " ")
                                .replace('.', " ")
                                .replace('_', " ")
                                .split_whitespace()
                                .map(|word| {
                                    let mut chars = word.chars();
                                    match chars.next() {
                                        None => String::new(),
                                        Some(f) => {
                                            f.to_uppercase().collect::<String>() + chars.as_str()
                                        }
                                    }
                                })
                                .collect::<Vec<String>>()
                                .join(" ")
                        },
                        description: tool.description.clone(),
                        command: "npx".to_string(), // Default to npx
                        args: vec!["-y".to_string(), tool.github.clone().unwrap_or_default()],
                        env: None,
                        secrets_env: None,
                        enabled: false,
                        stars: tool.github_stars,
                        author: tool.owner.as_ref().map(|o| o.name.clone()),
                        source: Some("mcpmarket".to_string()),
                        categories: tool
                            .categories
                            .as_ref()
                            .map(|cats| cats.iter().map(|c| c.name.clone()).collect()),
                        icon_url: tool.owner.as_ref().and_then(|o| o.avatar.clone()),
                    };
                    all_servers.push(config);
                }
            }
        }
    }

    // 2. Fetch from official registry for concrete install instructions
    let mut next_cursor: Option<String> = None;
    let mut page_count = 0;

    let featured_identifiers: HashSet<&str> = [
        "@modelcontextprotocol/server-filesystem",
        "@modelcontextprotocol/server-github",
        "@modelcontextprotocol/server-git",
        "@modelcontextprotocol/server-postgres",
        "@modelcontextprotocol/server-brave-search",
        "@modelcontextprotocol/server-google-maps",
        "@modelcontextprotocol/server-memory",
    ]
    .iter()
    .cloned()
    .collect();

    loop {
        if page_count >= 5 {
            break;
        }

        let mut url = "https://registry.modelcontextprotocol.io/v0.1/servers".to_string();
        let mut params = Vec::new();
        if let Some(q) = &query {
            params.push(format!("search={}", q));
        }
        if let Some(cursor) = &next_cursor {
            params.push(format!("cursor={}", cursor));
        }
        if !params.is_empty() {
            url.push_str("?");
            url.push_str(&params.join("&"));
        }

        let res = match client
            .get(&url)
            .headers(headers.clone())
            .timeout(std::time::Duration::from_secs(5))
            .send()
            .await
        {
            Ok(r) => r,
            Err(_) => break, // Fallback to what we have
        };

        if !res.status().is_success() {
            break;
        }

        if let Ok(registry_data) = res.json::<RegistryResponse>().await {
            for item in registry_data.servers {
                let server = item.server;
                if let Some(packages) = &server.packages {
                    for pkg in packages {
                        if pkg.registry_type.to_lowercase() == "npm" {
                            let id = pkg.identifier.replace("/", "-").replace("@", "");

                            // Check if we already have this
                            let mut exists = false;
                            for s in all_servers.iter_mut() {
                                if s.name.to_lowercase() == server.name.to_lowercase()
                                    || s.id == id
                                    || (s.args.len() >= 2 && s.args[1] == pkg.identifier)
                                {
                                    // Update with concrete install info if it was a placeholder
                                    s.command = "npx".to_string();
                                    s.args = vec!["-y".to_string(), pkg.identifier.clone()];
                                    s.source = Some("registry".to_string());
                                    exists = true;
                                    break;
                                }
                            }

                            if !exists {
                                let display_name = server.title.clone().unwrap_or_else(|| {
                                    let name = if server.name.contains('/') {
                                        server
                                            .name
                                            .split('/')
                                            .last()
                                            .unwrap_or(&server.name)
                                            .to_string()
                                    } else {
                                        server.name.clone()
                                    };
                                    name.replace('-', " ")
                                        .replace('.', " ")
                                        .split_whitespace()
                                        .map(|word| {
                                            let mut chars = word.chars();
                                            match chars.next() {
                                                None => String::new(),
                                                Some(f) => {
                                                    f.to_uppercase().collect::<String>()
                                                        + chars.as_str()
                                                }
                                            }
                                        })
                                        .collect::<Vec<String>>()
                                        .join(" ")
                                });

                                let config = McpServerConfig {
                                    id: id.clone(),
                                    name: display_name,
                                    description: server.description.clone(),
                                    command: "npx".to_string(),
                                    args: vec!["-y".to_string(), pkg.identifier.clone()],
                                    env: None,
                                    secrets_env: None,
                                    enabled: false,
                                    stars: None,
                                    author: None,
                                    source: Some("registry".to_string()),
                                    categories: None,
                                    icon_url: None,
                                };

                                if query.is_none()
                                    && featured_identifiers.contains(pkg.identifier.as_str())
                                {
                                    all_servers.insert(0, config);
                                } else {
                                    all_servers.push(config);
                                }
                            }
                            break;
                        }
                    }
                }
            }
            if let Some(meta) = registry_data.metadata {
                next_cursor = meta.next_cursor;
            } else {
                next_cursor = None;
            }
            if next_cursor.is_none() || query.is_some() {
                break;
            }
            page_count += 1;
        } else {
            break;
        }
    }

    Ok(all_servers)
}

#[tauri::command]
pub async fn sync_mcp_with_clis() -> Result<Vec<String>, String> {
    use crate::services::cli_config_service::{CliConfigService, CliType};

    let mut updated_paths = Vec::new();

    // Sync Gemini
    match CliConfigService::sync_with_global_config(&CliType::Gemini).await {
        Ok(path) => updated_paths.push(path.to_string_lossy().to_string()),
        Err(e) => log::warn!("Failed to sync with Gemini CLI: {}", e),
    }

    // Sync Claude
    match CliConfigService::sync_with_global_config(&CliType::Claude).await {
        Ok(path) => updated_paths.push(path.to_string_lossy().to_string()),
        Err(e) => log::warn!("Failed to sync with Claude Code: {}", e),
    }

    // Sync Custom CLIs
    if let Ok(settings) = crate::services::settings_service::SettingsService::load_global_settings()
    {
        for custom in settings.custom_clis {
            if custom.is_configured && custom.settings_file_path.is_some() {
                match CliConfigService::sync_with_global_config(&CliType::Custom(custom.id.clone()))
                    .await
                {
                    Ok(path) => updated_paths.push(path.to_string_lossy().to_string()),
                    Err(e) => log::warn!("Failed to sync with Custom CLI '{}': {}", custom.name, e),
                }
            }
        }
    }

    if updated_paths.is_empty() {
        return Err(
            "No CLI configurations were updated. Ensure Gemini or Claude Code is detected."
                .to_string(),
        );
    }

    Ok(updated_paths)
}
#[tauri::command]
pub async fn test_litellm_connection(
    base_url: String,
    api_key_secret_id: String,
) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let base = base_url.trim_end_matches('/');
    let health_url = format!("{}/health", base);

    // Try to get the API key for authentication
    let api_key = crate::services::secrets_service::SecretsService::get_secret(&api_key_secret_id)
        .ok()
        .flatten();

    let max_retries = 5;
    let mut last_error = String::new();

    for attempt in 1..=max_retries {
        let mut request = client.get(&health_url);
        if let Some(key) = &api_key {
            request = request.bearer_auth(key);
        }

        match request.send().await {
            Ok(response) => {
                if response.status().is_success() {
                    return Ok(format!("Connected to LiteLLM at {}", base));
                } else {
                    let status = response.status();
                    let body = response.text().await.unwrap_or_default();
                    last_error = format!("LiteLLM responded with {} — {}", status, body);
                    // Retrying on 503 or 502 which usually happens during proxy boot
                    if !status.is_server_error() {
                        return Err(last_error);
                    }
                }
            }
            Err(e) => {
                last_error = format!("Cannot reach LiteLLM at {}. Is the proxy running? Error: {}", base, e);
            }
        }
        
        if attempt < max_retries {
            tokio::time::sleep(std::time::Duration::from_millis(1000)).await;
        }
    }

    Err(last_error)
}
