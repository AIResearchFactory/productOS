use async_trait::async_trait;
use anyhow::{Result, anyhow};

use crate::models::ai::{Message, ChatResponse, Tool, ProviderType, OpenAiCliConfig};
use crate::services::ai_provider::AIProvider;
use crate::services::secrets_service::SecretsService;
use crate::services::cli_config_service::CliConfigService;

pub struct OpenAiCliProvider {
    pub config: OpenAiCliConfig,
}

/// Resolve the best available bearer token: explicit API key → OAuth token.
fn resolve_bearer_token(config: &OpenAiCliConfig) -> Option<String> {
    // 1. Explicit API key
    if let Ok(Some(key)) = SecretsService::get_secret(&config.api_key_secret_id) {
        if !key.trim().is_empty() {
            return Some(key);
        }
    }
    if let Ok(Some(key)) = SecretsService::get_secret("OPENAI_API_KEY") {
        if !key.trim().is_empty() {
            return Some(key);
        }
    }
    // 2. OAuth access token
    crate::services::openai_oauth::get_stored_access_token()
}

/// Check whether a CLI binary is available on PATH.
fn binary_exists(bin: &str) -> bool {
    crate::utils::env::command_exists(bin)
}

/// Call the OpenAI Chat Completions REST API directly.
async fn call_openai_rest_api(
    token: &str,
    model: &str,
    instructions: Option<&str>,
    prompt: &str,
    account_id: Option<String>,
) -> Result<String> {
    let client = reqwest::Client::new();

    // Determine if we should use the Codex endpoint (OAuth tokens)
    // Codex endpoint uses a slightly different body and headers
    let is_codex = token.len() > 100 && !token.starts_with("sk-"); // Heuristic for OAuth token vs API Key
    let api_url = if is_codex {
        "https://chatgpt.com/backend-api/codex/responses"
    } else {
        "https://api.openai.com/v1/chat/completions"
    };

    log::info!("[OpenAI REST] Using endpoint: {}", api_url);

    let mut body = serde_json::json!({
        "model": model,
        "messages": [
            { "role": "user", "content": { "content_type": "text", "parts": [prompt] } }
        ]
    });

    if is_codex {
        // Codex endpoint expects responses-style payload and requires store=false.
        // It also expects instructions to be present.
        let safe_instructions = instructions
            .map(|s| s.trim())
            .filter(|s| !s.is_empty())
            .unwrap_or("You are a helpful AI assistant.");

        body = serde_json::json!({
            "model": model,
            "instructions": safe_instructions,
            "input": [
                {
                    "role": "user",
                    "content": [
                        { "type": "input_text", "text": prompt }
                    ]
                }
            ],
            "store": false
        });
    } else {
        // Standard OpenAI API format
        let mut standard_messages = Vec::new();
        if let Some(inst) = instructions {
            standard_messages.push(serde_json::json!({ "role": "system", "content": inst }));
        }
        standard_messages.push(serde_json::json!({ "role": "user", "content": prompt }));
        body["messages"] = serde_json::json!(standard_messages);
    }

    let mut request = client
        .post(api_url)
        .header("Authorization", format!("Bearer {}", token))
        .header("Content-Type", "application/json")
        .header("User-Agent", "OpenAI-CLI/1.0.0")
        .json(&body);

    if is_codex {
        request = request.header("originator", "opencode");
        if let Some(id) = account_id {
            request = request.header("ChatGPT-Account-Id", id);
        } else if let Some(id) = crate::services::openai_oauth::get_stored_account_id() {
            request = request.header("ChatGPT-Account-Id", id);
        }
    }

    let resp = request.send()
        .await
        .map_err(|e| anyhow!("OpenAI API request failed: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let err_body = resp.text().await.unwrap_or_default();
        let err_lower = err_body.to_lowercase();

        if status.as_u16() == 429 || err_lower.contains("insufficient_quota") {
            return Err(anyhow!("OpenAI API capacity exhausted (429). Check your billing dashboard.\n\nDetails: {}", err_body));
        } else if status.as_u16() == 404 || err_lower.contains("model_not_found") {
            return Err(anyhow!("OpenAI model not found (404). Your model alias '{}' might be invalid.\n\nDetails: {}", model, err_body));
        } else if status.as_u16() == 401 || err_lower.contains("unauthorized") {
            return Err(anyhow!("OpenAI is not authenticated yet.\nGo to Settings → OpenAI (ChatGPT Login) and click 'Login / Refresh Session', then try again.\n\nDetails: {}", err_body));
        }
        return Err(anyhow!("OpenAI API error (HTTP {}): {}", status, err_body));
    }

    let json: serde_json::Value = resp.json().await
        .map_err(|e| anyhow!("Failed to parse OpenAI response: {}", e))?;

    let mut content = String::new();

    // Standard Chat Completions
    if let Some(s) = json.get("choices")
        .and_then(|c| c.get(0))
        .and_then(|c| c.get("message"))
        .and_then(|m| m.get("content"))
        .and_then(|v| v.as_str())
    {
        content = s.to_string();
    }

    // Responses/Codex style fallback
    if content.trim().is_empty() {
        if let Some(s) = json.get("output_text").and_then(|v| v.as_str()) {
            content = s.to_string();
        }
    }

    if content.trim().is_empty() {
        if let Some(arr) = json.get("output").and_then(|v| v.as_array()) {
            let mut pieces = Vec::new();
            for item in arr {
                if let Some(content_arr) = item.get("content").and_then(|v| v.as_array()) {
                    for c in content_arr {
                        if let Some(text) = c.get("text").and_then(|v| v.as_str()) {
                            pieces.push(text.to_string());
                        }
                    }
                }
            }
            if !pieces.is_empty() {
                content = pieces.join("\n");
            }
        }
    }

    if content.trim().is_empty() {
        return Err(anyhow!("OpenAI returned an empty response body."));
    }

    Ok(content)
}

#[async_trait]
impl AIProvider for OpenAiCliProvider {
    async fn chat(&self, messages: Vec<Message>, system_prompt: Option<String>, _tools: Option<Vec<Tool>>, project_path: Option<String>) -> Result<ChatResponse> {
        let mut combined_prompt = String::new();
        for msg in &messages {
            combined_prompt.push_str(&format!("{}: {}\n", msg.role, msg.content));
        }

        if combined_prompt.trim().is_empty() {
            return Err(anyhow!("OpenAI request was empty. Please provide a prompt/instructions before sending."));
        }

        let cmd_parts: Vec<&str> = self.config.command.split_whitespace().collect();
        let bin = cmd_parts.first().copied().unwrap_or("");

        // ── If binary is missing, use REST API directly ──
        if bin.is_empty() || !binary_exists(bin) {
            let token = resolve_bearer_token(&self.config)
                .ok_or_else(|| anyhow!(
                    "OpenAI is not authenticated yet.\nGo to Settings → OpenAI (ChatGPT Login) and click 'Login / Refresh Session', then try again."
                ))?;

            log::info!("[OpenAI REST] Calling API directly (CLI binary '{}' not found)", bin);
            let account_id = crate::services::openai_oauth::get_stored_account_id();
            let content = call_openai_rest_api(&token, &self.config.model_alias, system_prompt.as_deref(), &combined_prompt, account_id).await?;
            return Ok(ChatResponse {
                content,
                tool_calls: None,
                metadata: None,
            });
        }

        // ── CLI binary exists — use it ──
        let api_key = resolve_bearer_token(&self.config);

        let mut command = tokio::process::Command::new(cmd_parts[0]);
        if cmd_parts.len() > 1 {
            command.args(&cmd_parts[1..]);
        }
        if let Some(key) = &api_key {
            if let Some(env_var) = &self.config.api_key_env_var {
                if !env_var.is_empty() {
                    command.env(env_var, key);
                } else {
                    command.env("OPENAI_API_KEY", key);
                }
            } else {
                command.env("OPENAI_API_KEY", key);
            }
        }
        
        if let Some(path) = &project_path {
            let config_dir = std::path::Path::new(path);
            command.current_dir(config_dir);

            match CliConfigService::collect_mcp_secrets() {
                Ok(secrets) => {
                    for (k, v) in secrets {
                        command.env(k, v);
                    }
                }
                Err(e) => log::warn!("[OpenAI CLI] Failed to collect MCP secrets: {}", e),
            }
        }
        
        log::info!("[OpenAI CLI] Executing command: {} with model alias: {}", cmd_parts[0], self.config.model_alias);
        
        let output = if cmd_parts[0].eq_ignore_ascii_case("codex") {
            command
                .arg("exec")
                .arg("-c")
                .arg("model_provider_options.store=false")
                .arg("--model")
                .arg(&self.config.model_alias)
                .arg(&combined_prompt)
                .output()
                .await?
        } else {
            command
                .arg("--model")
                .arg(&self.config.model_alias)
                .arg("--prompt")
                .arg(&combined_prompt)
                .output()
                .await?
        };

        if output.status.success() {
            Ok(ChatResponse {
                content: String::from_utf8_lossy(&output.stdout).to_string(),
                tool_calls: None,
                metadata: None,
            })
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr).to_string();
            let filtered_err: Vec<&str> = stderr.lines()
                .filter(|line| !line.is_empty())
                .collect();
            
            let err_msg = if filtered_err.is_empty() {
                stderr
            } else {
                filtered_err.join("\n")
            };

            let err_lower = err_msg.to_lowercase();

            if err_msg.contains("429") || err_lower.contains("insufficient_quota") || err_lower.contains("exceeded your current quota") {
                Err(anyhow!("OpenAI API capacity exhausted (429). Check your billing dashboard.\n\nDetails: {}", err_msg))
            } else if err_msg.contains("404") || err_lower.contains("model_not_found") {
                Err(anyhow!("OpenAI model not found (404). Your model alias '{}' might be invalid.\n\nDetails: {}", self.config.model_alias, err_msg))
            } else if err_lower.contains("not logged") || err_lower.contains("not authenticated") || err_lower.contains("login required") || err_lower.contains("please login") || err_lower.contains("unauthorized") {
                Err(anyhow!("OpenAI is not authenticated yet.\nGo to Settings → OpenAI (ChatGPT Login) and click 'Login / Refresh Session', then try again.\n\nDetails: {}", err_msg))
            } else {
                Err(anyhow!("OpenAI CLI error: {}", err_msg))
            }
        }
    }

    async fn list_models(&self) -> Result<Vec<String>> {
        Ok(vec![self.config.model_alias.clone()])
    }

    fn supports_mcp(&self) -> bool {
        true
    }

    fn provider_type(&self) -> ProviderType {
        ProviderType::OpenAiCli
    }

    async fn chat_stream(
        &self,
        messages: Vec<Message>,
        system_prompt: Option<String>,
        _tools: Option<Vec<Tool>>,
        project_path: Option<String>,
    ) -> Result<std::pin::Pin<Box<dyn futures_util::Stream<Item = Result<String>> + Send>>> {
        let mut combined_prompt = String::new();
        for msg in &messages {
            combined_prompt.push_str(&format!("{}: {}\n", msg.role, msg.content));
        }

        if combined_prompt.trim().is_empty() {
            return Err(anyhow!("OpenAI request was empty. Please provide a prompt/instructions before sending."));
        }

        let cmd_parts: Vec<&str> = self.config.command.split_whitespace().collect();
        let bin = cmd_parts.first().copied().unwrap_or("");

        // ── If binary is missing, use REST API and wrap as stream ──
        if bin.is_empty() || !binary_exists(bin) {
            let token = resolve_bearer_token(&self.config)
                .ok_or_else(|| anyhow!(
                    "OpenAI is not authenticated yet.\nGo to Settings → OpenAI (ChatGPT Login) and click 'Login / Refresh Session', then try again."
                ))?;

            log::info!("[OpenAI REST] Streaming via API directly (CLI binary '{}' not found)", bin);
            let model = self.config.model_alias.clone();
            let account_id = crate::services::openai_oauth::get_stored_account_id();

            let s = async_stream::try_stream! {
                let content = call_openai_rest_api(&token, &model, system_prompt.as_deref(), &combined_prompt, account_id).await?;
                yield content;
            };
            return Ok(Box::pin(s));
        }

        // ── CLI binary exists — use it with streaming ──
        let api_key = resolve_bearer_token(&self.config);

        let mut command = tokio::process::Command::new(cmd_parts[0]);
        if cmd_parts.len() > 1 {
            command.args(&cmd_parts[1..]);
        }
        if let Some(key) = &api_key {
            if let Some(env_var) = &self.config.api_key_env_var {
                if !env_var.is_empty() {
                    command.env(env_var, key);
                } else {
                    command.env("OPENAI_API_KEY", key);
                }
            } else {
                command.env("OPENAI_API_KEY", key);
            }
        }
        
        if let Some(path) = &project_path {
            let config_dir = std::path::Path::new(path);
            command.current_dir(config_dir);

            match CliConfigService::collect_mcp_secrets() {
                Ok(secrets) => {
                    for (k, v) in secrets {
                        command.env(k, v);
                    }
                }
                Err(e) => log::warn!("[OpenAI CLI] Failed to collect MCP secrets: {}", e),
            }
        }
        
        let mut child = if cmd_parts[0].eq_ignore_ascii_case("codex") {
            command
                .arg("exec")
                .arg("-c")
                .arg("model_provider_options.store=false")
                .arg("--model")
                .arg(&self.config.model_alias)
                .arg(&combined_prompt)
                .stdout(std::process::Stdio::piped())
                .stderr(std::process::Stdio::piped())
                .spawn()?
        } else {
            command
                .arg("--model")
                .arg(&self.config.model_alias)
                .arg("--prompt")
                .arg(&combined_prompt)
                .stdout(std::process::Stdio::piped())
                .stderr(std::process::Stdio::piped())
                .spawn()?
        };

        let stdout = child.stdout.take().ok_or_else(|| anyhow!("Failed to capture stdout"))?;
        
        // Register for cancellation
        let manager = crate::services::cancellation_service::CANCELLATION_MANAGER.clone();
        manager.register_process("chat".to_string(), child).await;

        let s = async_stream::try_stream! {
            use tokio::io::AsyncReadExt;
            let mut reader = stdout;
            let mut buffer = [0u8; 1024];

            loop {
                let n = reader.read(&mut buffer).await?;
                if n == 0 { break; }
                let text = String::from_utf8_lossy(&buffer[..n]).to_string();
                yield text;
            }
            
            let mut processes = crate::services::cancellation_service::CANCELLATION_MANAGER.active_processes.lock().await;
            processes.remove("chat");
        };

        Ok(Box::pin(s))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::ai::{OpenAiCliConfig, Message};

    #[tokio::test]
    async fn test_openai_cli_provider_metadata() {
        let config = OpenAiCliConfig {
            command: "echo".to_string(),
            model_alias: "gpt-4o".to_string(),
            api_key_secret_id: "TEST_KEY".to_string(),
            api_key_env_var: None,
            detected_path: None,
        };
        let provider = OpenAiCliProvider { config: config.clone() };
        
        assert_eq!(provider.provider_type(), ProviderType::OpenAiCli);
        assert_eq!(provider.supports_mcp(), true);
        
        let models = provider.list_models().await.unwrap();
        assert_eq!(models, vec!["gpt-4o".to_string()]);
    }

    #[tokio::test]
    async fn test_openai_cli_provider_chat_failure() {
        let config = OpenAiCliConfig {
            command: "false".to_string(), // Use 'false' command which always fails
            model_alias: "gpt-4o".to_string(),
            api_key_secret_id: "NON_EXISTENT_KEY".to_string(),
            api_key_env_var: None,
            detected_path: None,
        };
        let provider = OpenAiCliProvider { config };
        let messages = vec![Message { 
            role: "user".to_string(), 
            content: "hello".to_string(),
            tool_calls: None,
            tool_results: None,
        }];
        
        // No system prompt, no tools, no project path
        let result = provider.chat(messages, None, None, None).await;
        // The command will fail, so we expect an error
        // Either command not found or exit status 1
        assert!(result.is_err());
    }
}
