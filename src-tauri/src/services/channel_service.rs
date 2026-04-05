use serde::{Deserialize, Serialize};
use anyhow::{Result, anyhow};
use crate::services::secrets_service::SecretsService;
use crate::services::settings_service::SettingsService;

const TELEGRAM_BOT_TOKEN_KEY: &str = "TELEGRAM_BOT_TOKEN";

/// Payload returned by the Telegram `getMe` API.
#[derive(Debug, Serialize, Deserialize)]
pub struct TelegramBotInfo {
    pub ok: bool,
    pub description: Option<String>,
    pub username: Option<String>,
    pub first_name: Option<String>,
}

pub struct ChannelService;

impl ChannelService {
    /// Test a Telegram bot token by calling the `getMe` endpoint.
    pub async fn test_telegram_connection(bot_token: Option<String>) -> Result<TelegramBotInfo> {
        let token = match bot_token {
            Some(t) if !t.is_empty() && !t.starts_with('•') => t,
            _ => {
                let settings = SettingsService::load_global_settings().map_err(|e| anyhow!(e.to_string()))?;
                let config = settings.channel_config.unwrap_or_default();
                if !config.enabled || !config.telegram_enabled {
                    return Err(anyhow!("Telegram integration is not enabled"));
                }
                SecretsService::get_secret(TELEGRAM_BOT_TOKEN_KEY)
                    .map_err(|e| anyhow!(format!("Failed to retrieve Telegram bot token: {}", e)))?
                    .ok_or_else(|| anyhow!("No Telegram bot token found"))?
            }
        };

        let url = format!("https://api.telegram.org/bot{}/getMe", token);
        let response = reqwest::get(&url)
            .await
            .map_err(|e| anyhow!(format!("Network error contacting Telegram API: {}", e)))?;

        let status = response.status();
        let body = response.text().await.map_err(|e| anyhow!(format!("Failed to read Telegram response: {}", e)))?;

        if !status.is_success() {
            return Err(anyhow!(format!("Telegram API returned HTTP {}: {}", status.as_u16(), body)));
        }

        let raw: serde_json::Value = serde_json::from_str(&body).map_err(|e| anyhow!(format!("Invalid JSON from Telegram: {}", e)))?;

        let ok = raw.get("ok").and_then(|v| v.as_bool()).unwrap_or(false);
        if !ok {
            let desc = raw.get("description").and_then(|v| v.as_str()).unwrap_or("Unknown error");
            return Err(anyhow!(format!("Telegram API error: {}", desc)));
        }

        let result = raw.get("result");
        let username = result.and_then(|r| r.get("username")).and_then(|v| v.as_str()).map(String::from);
        let first_name = result.and_then(|r| r.get("first_name")).and_then(|v| v.as_str()).map(String::from);

        Ok(TelegramBotInfo {
            ok: true,
            description: None,
            username,
            first_name,
        })
    }

    /// Send a text message to a Telegram chat via the Bot API.
    pub async fn send_telegram_message(
        bot_token: Option<String>,
        chat_id: String,
        text: String,
    ) -> Result<String> {
        let token = match bot_token {
            Some(t) if !t.is_empty() && !t.starts_with('•') => t,
            _ => {
                let settings = SettingsService::load_global_settings().map_err(|e| anyhow!(e.to_string()))?;
                let config = settings.channel_config.unwrap_or_default();
                if !config.enabled || !config.telegram_enabled {
                    return Err(anyhow!("Telegram integration is not enabled"));
                }
                SecretsService::get_secret(TELEGRAM_BOT_TOKEN_KEY)
                    .map_err(|e| anyhow!(format!("Failed to retrieve Telegram bot token: {}", e)))?
                    .ok_or_else(|| anyhow!("No Telegram bot token found"))?
            }
        };

        if chat_id.is_empty() {
            return Err(anyhow!("Chat ID cannot be empty"));
        }
        if text.is_empty() {
            return Err(anyhow!("Message text cannot be empty"));
        }

        let url = format!("https://api.telegram.org/bot{}/sendMessage", token);
        let client = reqwest::Client::new();
        let payload = serde_json::json!({
            "chat_id": chat_id,
            "text": text,
            "parse_mode": "Markdown"
        });

        let response = client.post(&url).json(&payload).send().await
            .map_err(|e| anyhow!(format!("Network error sending Telegram message: {}", e)))?;

        let status = response.status();
        let body = response.text().await.map_err(|e| anyhow!(format!("Failed to read Telegram response: {}", e)))?;

        if !status.is_success() {
            return Err(anyhow!(format!("Telegram API returned HTTP {}: {}", status.as_u16(), body)));
        }

        Ok("Message sent successfully".to_string())
    }

    /// High-level function to send a notification to all enabled channels.
    pub async fn send_notification(message: &str) -> Result<()> {
        let settings = SettingsService::load_global_settings().map_err(|e| anyhow!(e.to_string()))?;
        let config = settings.channel_config.unwrap_or_default();

        if !config.enabled {
            return Ok(());
        }

        if config.telegram_enabled && !config.telegram_default_chat_id.is_empty() {
            let _ = Self::send_telegram_message(None, config.telegram_default_chat_id, message.to_string()).await;
        }

        // WhatsApp integration can be added here once implemented in the backend

        Ok(())
    }
}
