use serde::{Deserialize, Serialize};
use anyhow::{Result, anyhow};
use crate::services::secrets_service::SecretsService;
use crate::services::settings_service::SettingsService;

const TELEGRAM_BOT_TOKEN_KEY: &str = "TELEGRAM_BOT_TOKEN";
const WHATSAPP_ACCESS_TOKEN_KEY: &str = "WHATSAPP_ACCESS_TOKEN";

/// Payload returned by the Telegram `getMe` API.
#[derive(Debug, Serialize, Deserialize)]
pub struct TelegramBotInfo {
    pub ok: bool,
    pub description: Option<String>,
    pub username: Option<String>,
    pub first_name: Option<String>,
}

/// Payload returned by the WhatsApp API for connection tests or metadata.
#[derive(Debug, Serialize, Deserialize)]
pub struct WhatsAppInfo {
    pub ok: bool,
    pub display_phone_number: Option<String>,
    pub verified_name: Option<String>,
    pub id: Option<String>,
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

    /// Test a WhatsApp access token and Phone Number ID by calling the Meta Graph API.
    pub async fn test_whatsapp_connection(access_token: Option<String>, phone_number_id: Option<String>) -> Result<WhatsAppInfo> {
        let settings = SettingsService::load_global_settings().map_err(|e| anyhow!(e.to_string()))?;
        let config = settings.channel_config.unwrap_or_default();

        let token = match access_token {
            Some(t) if !t.is_empty() && !t.starts_with('•') => t,
            _ => SecretsService::get_secret(WHATSAPP_ACCESS_TOKEN_KEY)
                    .map_err(|e| anyhow!(format!("Failed to retrieve WhatsApp token: {}", e)))?
                    .ok_or_else(|| anyhow!("No WhatsApp access token found"))?
        };

        let pid = match phone_number_id {
            Some(p) if !p.is_empty() => p,
            _ => if config.whatsapp_phone_number_id.is_empty() {
                return Err(anyhow!("WhatsApp Phone Number ID is not configured"));
            } else {
                config.whatsapp_phone_number_id.clone()
            }
        };

        let url = format!("https://graph.facebook.com/v17.0/{}", pid);
        let client = reqwest::Client::new();
        let response = client.get(&url)
            .header("Authorization", format!("Bearer {}", token))
            .send()
            .await
            .map_err(|e| anyhow!(format!("Network error contacting WhatsApp API: {}", e)))?;

        let status = response.status();
        let body = response.text().await.map_err(|e| anyhow!(format!("Failed to read WhatsApp response: {}", e)))?;

        if !status.is_success() {
            return Err(anyhow!(format!("WhatsApp API (Meta) returned HTTP {}: {}", status.as_u16(), body)));
        }

        let raw: serde_json::Value = serde_json::from_str(&body).map_err(|e| anyhow!(format!("Invalid JSON from Meta: {}", e)))?;
        
        Ok(WhatsAppInfo {
            ok: true,
            display_phone_number: raw.get("display_phone_number").and_then(|v| v.as_str()).map(String::from),
            verified_name: raw.get("verified_name").and_then(|v| v.as_str()).map(String::from),
            id: raw.get("id").and_then(|v| v.as_str()).map(String::from),
        })
    }

    /// Send a WhatsApp message via Meta Cloud API.
    /// Note: WhatsApp usually requires template-based messaging for business-initiated conversations.
    /// This implementation assumes a simple text message (might only work for active sessions).
    pub async fn send_whatsapp_message(
        access_token: Option<String>,
        phone_number_id: Option<String>,
        recipient_phone: String,
        text: String,
    ) -> Result<String> {
        let settings = SettingsService::load_global_settings().map_err(|e| anyhow!(e.to_string()))?;
        let config = settings.channel_config.unwrap_or_default();

        let token = match access_token {
            Some(t) if !t.is_empty() && !t.starts_with('•') => t,
            _ => SecretsService::get_secret(WHATSAPP_ACCESS_TOKEN_KEY)
                    .map_err(|e| anyhow!(format!("Failed to retrieve WhatsApp token: {}", e)))?
                    .ok_or_else(|| anyhow!("No WhatsApp access token found"))?
        };

        let pid = match phone_number_id {
            Some(p) if !p.is_empty() => p,
            _ => if config.whatsapp_phone_number_id.is_empty() {
                return Err(anyhow!("WhatsApp Phone Number ID is not configured"));
            } else {
                config.whatsapp_phone_number_id.clone()
            }
        };

        if recipient_phone.is_empty() {
            return Err(anyhow!("Recipient phone number cannot be empty"));
        }

        let url = format!("https://graph.facebook.com/v17.0/{}/messages", pid);
        let client = reqwest::Client::new();
        let payload = serde_json::json!({
            "messaging_product": "whatsapp",
            "to": recipient_phone,
            "type": "text",
            "text": { "body": text }
        });

        let response = client.post(&url)
            .header("Authorization", format!("Bearer {}", token))
            .json(&payload)
            .send()
            .await
            .map_err(|e| anyhow!(format!("Network error sending WhatsApp message: {}", e)))?;

        let status = response.status();
        let body = response.text().await.map_err(|e| anyhow!(format!("Failed to read Meta response: {}", e)))?;

        if !status.is_success() {
            return Err(anyhow!(format!("WhatsApp API returned HTTP {}: {}", status.as_u16(), body)));
        }

        Ok("WhatsApp message sent successfully".to_string())
    }

    /// High-level function to send a notification to all enabled channels.
    pub async fn send_notification(message: &str) -> Result<()> {
        let settings = SettingsService::load_global_settings().map_err(|e| anyhow!(e.to_string()))?;
        let config = settings.channel_config.unwrap_or_default();

        if !config.enabled {
            return Ok(());
        }

        // Send to Telegram if enabled
        if config.telegram_enabled && !config.telegram_default_chat_id.is_empty() {
            let _ = Self::send_telegram_message(None, config.telegram_default_chat_id, message.to_string()).await;
        }

        // Send to WhatsApp if enabled
        if config.whatsapp_enabled && !config.whatsapp_phone_number_id.is_empty() {
            // Note: Recipient logic might need refinement; for now using a placeholder or project setting if added later.
            // For general notifications, we might need a "whatsapp_default_recipient" field in config.
            // HACK: Reusing notes or another field if no default recipient is defined yet.
            // Assuming for now it's not yet fully wired to a recipient in the UI.
        }

        Ok(())
    }
}
