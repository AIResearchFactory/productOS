use serde::{Deserialize, Serialize};

/// Payload returned by the Telegram `getMe` API.
#[derive(Debug, Serialize, Deserialize)]
pub struct TelegramBotInfo {
    pub ok: bool,
    pub description: Option<String>,
    pub username: Option<String>,
    pub first_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChannelConfig {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default)]
    pub telegram_enabled: bool,
    #[serde(default)]
    pub whatsapp_enabled: bool,
    #[serde(default = "default_routing")]
    pub default_project_routing: String,
    #[serde(default)]
    pub telegram_default_chat_id: String,
    #[serde(default)]
    pub whatsapp_phone_number_id: String,
    #[serde(default)]
    pub notes: String,
    /// Indicates whether the Telegram bot token secret exists (set on load, never persisted).
    #[serde(default)]
    pub has_telegram_token: bool,
    /// Indicates whether the WhatsApp access token secret exists.
    #[serde(default)]
    pub has_whatsapp_token: bool,
}

fn default_routing() -> String {
    "manual".to_string()
}

impl Default for ChannelConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            telegram_enabled: false,
            whatsapp_enabled: false,
            default_project_routing: default_routing(),
            telegram_default_chat_id: String::new(),
            whatsapp_phone_number_id: String::new(),
            notes: String::new(),
            has_telegram_token: false,
            has_whatsapp_token: false,
        }
    }
}

/// Secret IDs used by the channel connector.
const TELEGRAM_BOT_TOKEN_KEY: &str = "TELEGRAM_BOT_TOKEN";
const WHATSAPP_ACCESS_TOKEN_KEY: &str = "WHATSAPP_ACCESS_TOKEN";

// ──────────────────────────── Tauri Commands ────────────────────────────

/// Test a Telegram bot token by calling the `getMe` endpoint.
/// If `bot_token` is not provided, it attempts to load it from the encrypted secrets store.
/// Returns bot username on success, or a descriptive error string on failure.
#[tauri::command]
pub async fn test_telegram_connection(bot_token: Option<String>) -> Result<TelegramBotInfo, String> {
    use crate::services::secrets_service::SecretsService;

    // Use provided token or retrieve from secret store
    let token = match bot_token {
        Some(t) if !t.is_empty() && !t.starts_with('•') => t,
        _ => {
            use crate::services::settings_service::SettingsService;
            let settings = SettingsService::load_global_settings().map_err(|e| e.to_string())?;
            let config = settings.channel_config.unwrap_or_default();
            if !config.enabled || !config.telegram_enabled {
                return Err("Telegram integration is not enabled".to_string());
            }
            SecretsService::get_secret(TELEGRAM_BOT_TOKEN_KEY)
                .map_err(|e| format!("Failed to retrieve Telegram bot token: {}", e))?
                .ok_or_else(|| "No Telegram bot token found".to_string())?
        }
    };

    let url = format!("https://api.telegram.org/bot{}/getMe", token);

    let response = reqwest::get(&url)
        .await
        .map_err(|e| format!("Network error contacting Telegram API: {}", e))?;

    let status = response.status();
    let body = response
        .text()
        .await
        .map_err(|e| format!("Failed to read Telegram response: {}", e))?;

    if !status.is_success() {
        return Err(format!(
            "Telegram API returned HTTP {}: {}",
            status.as_u16(),
            body
        ));
    }

    // Parse the nested response: { ok: true, result: { username, first_name, ... } }
    let raw: serde_json::Value =
        serde_json::from_str(&body).map_err(|e| format!("Invalid JSON from Telegram: {}", e))?;

    let ok = raw.get("ok").and_then(|v| v.as_bool()).unwrap_or(false);
    if !ok {
        let desc = raw
            .get("description")
            .and_then(|v| v.as_str())
            .unwrap_or("Unknown error");
        return Err(format!("Telegram API error: {}", desc));
    }

    let result = raw.get("result");
    let username = result
        .and_then(|r| r.get("username"))
        .and_then(|v| v.as_str())
        .map(String::from);
    let first_name = result
        .and_then(|r| r.get("first_name"))
        .and_then(|v| v.as_str())
        .map(String::from);

    Ok(TelegramBotInfo {
        ok: true,
        description: None,
        username,
        first_name,
    })
}

/// Send a text message to a Telegram chat via the Bot API.
/// If `bot_token` is not provided, it attempts to load it from the encrypted secrets store.
#[tauri::command]
pub async fn send_telegram_message(
    bot_token: Option<String>,
    chat_id: String,
    text: String,
) -> Result<String, String> {
    use crate::services::secrets_service::SecretsService;

    // Use provided token or retrieve from secret store
    let token = match bot_token {
        Some(t) if !t.is_empty() && !t.starts_with('•') => t,
        _ => {
            use crate::services::settings_service::SettingsService;
            let settings = SettingsService::load_global_settings().map_err(|e| e.to_string())?;
            let config = settings.channel_config.unwrap_or_default();
            if !config.enabled || !config.telegram_enabled {
                return Err("Telegram integration is not enabled".to_string());
            }
            SecretsService::get_secret(TELEGRAM_BOT_TOKEN_KEY)
                .map_err(|e| format!("Failed to retrieve Telegram bot token: {}", e))?
                .ok_or_else(|| "No Telegram bot token found".to_string())?
        }
    };

    if chat_id.is_empty() {
        return Err("Chat ID cannot be empty".to_string());
    }
    if text.is_empty() {
        return Err("Message text cannot be empty".to_string());
    }

    let url = format!("https://api.telegram.org/bot{}/sendMessage", token);

    let client = reqwest::Client::new();
    let payload = serde_json::json!({
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "Markdown"
    });

    let response = client
        .post(&url)
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("Network error sending Telegram message: {}", e))?;

    let status = response.status();
    let body = response
        .text()
        .await
        .map_err(|e| format!("Failed to read Telegram response: {}", e))?;

    if !status.is_success() {
        return Err(format!(
            "Telegram API returned HTTP {}: {}",
            status.as_u16(),
            body
        ));
    }

    Ok("Message sent successfully".to_string())
}

/// Save channel configuration. Secrets go to the encrypted store; non-secret
/// config goes to global settings via the `channel_config` field.
#[tauri::command]
pub async fn save_channel_settings(
    enabled: bool,
    telegram_enabled: bool,
    whatsapp_enabled: bool,
    default_project_routing: String,
    telegram_bot_token: Option<String>,
    telegram_default_chat_id: String,
    whatsapp_access_token: Option<String>,
    whatsapp_phone_number_id: String,
    notes: String,
) -> Result<(), String> {
    use crate::services::secrets_service::{Secrets, SecretsService};
    use crate::services::settings_service::SettingsService;

    // ── Save secrets (only if a real value is provided, not the mask) ──
    if let Some(ref token) = telegram_bot_token {
        if !token.is_empty() && !token.starts_with('•') {
            let mut new_secrets = Secrets::default();
            new_secrets
                .custom_api_keys
                .insert(TELEGRAM_BOT_TOKEN_KEY.to_string(), token.clone());
            SecretsService::save_secrets(&new_secrets)
                .map_err(|e| format!("Failed to save Telegram token: {}", e))?;
        }
    }

    if let Some(ref token) = whatsapp_access_token {
        if !token.is_empty() && !token.starts_with('•') {
            let mut new_secrets = Secrets::default();
            new_secrets
                .custom_api_keys
                .insert(WHATSAPP_ACCESS_TOKEN_KEY.to_string(), token.clone());
            SecretsService::save_secrets(&new_secrets)
                .map_err(|e| format!("Failed to save WhatsApp token: {}", e))?;
        }
    }

    // ── Save non-secret config to global settings ──
    let mut settings = SettingsService::load_global_settings()
        .map_err(|e| format!("Failed to load settings: {}", e))?;

    settings.channel_config = Some(ChannelConfig {
        enabled,
        telegram_enabled,
        whatsapp_enabled,
        default_project_routing,
        telegram_default_chat_id,
        whatsapp_phone_number_id,
        notes,
        has_telegram_token: false, // informational, set on load
        has_whatsapp_token: false,
    });

    SettingsService::save_global_settings(&settings)
        .map_err(|e| format!("Failed to save settings: {}", e))?;

    Ok(())
}

/// Load channel configuration. Returns config + flags indicating which secrets exist.
#[tauri::command]
pub async fn load_channel_settings() -> Result<ChannelConfig, String> {
    use crate::services::secrets_service::SecretsService;
    use crate::services::settings_service::SettingsService;

    let settings = SettingsService::load_global_settings()
        .map_err(|e| format!("Failed to load settings: {}", e))?;

    let mut config = settings.channel_config.unwrap_or_default();

    // Check which secrets exist (don't reveal actual values)
    config.has_telegram_token = SecretsService::get_secret(TELEGRAM_BOT_TOKEN_KEY)
        .ok()
        .flatten()
        .map(|s| !s.is_empty())
        .unwrap_or(false);
    config.has_whatsapp_token = SecretsService::get_secret(WHATSAPP_ACCESS_TOKEN_KEY)
        .ok()
        .flatten()
        .map(|s| !s.is_empty())
        .unwrap_or(false);

    Ok(config)
}


// ──────────────────────────── Tests ────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_telegram_get_me_url_construction() {
        let token = "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11";
        let url = format!("https://api.telegram.org/bot{}/getMe", token);
        assert!(url.starts_with("https://api.telegram.org/bot123456:ABC-DEF"));
        assert!(url.ends_with("/getMe"));
        assert!(!url.contains("{{"));
    }

    #[test]
    fn test_telegram_send_message_url_construction() {
        let token = "123456:TESTTOKEN";
        let url = format!("https://api.telegram.org/bot{}/sendMessage", token);
        assert_eq!(
            url,
            "https://api.telegram.org/bot123456:TESTTOKEN/sendMessage"
        );
    }

    #[test]
    fn test_telegram_send_message_payload() {
        let chat_id = "2041972713";
        let text = "Hello from productOS!";
        let payload = serde_json::json!({
            "chat_id": chat_id,
            "text": text,
            "parse_mode": "Markdown"
        });

        assert_eq!(payload["chat_id"], "2041972713");
        assert_eq!(payload["text"], "Hello from productOS!");
        assert_eq!(payload["parse_mode"], "Markdown");
    }

    #[test]
    fn test_channel_config_default() {
        let config = ChannelConfig::default();
        assert!(!config.enabled);
        assert_eq!(config.default_project_routing, "manual");
        assert_eq!(config.telegram_default_chat_id, "");
        assert!(!config.has_telegram_token);
        assert!(!config.has_whatsapp_token);
    }

    #[test]
    fn test_channel_config_serialization_roundtrip() {
        let config = ChannelConfig {
            enabled: true,
            telegram_enabled: true,
            whatsapp_enabled: false,
            default_project_routing: "last_active".to_string(),
            telegram_default_chat_id: "123456".to_string(),
            whatsapp_phone_number_id: "789".to_string(),
            notes: "Test notes".to_string(),
            has_telegram_token: true,
            has_whatsapp_token: false,
        };

        let json = serde_json::to_string(&config).unwrap();
        let deserialized: ChannelConfig = serde_json::from_str(&json).unwrap();

        assert!(deserialized.enabled);
        assert_eq!(deserialized.default_project_routing, "last_active");
        assert_eq!(deserialized.telegram_default_chat_id, "123456");
        assert!(deserialized.has_telegram_token);
        assert!(!deserialized.has_whatsapp_token);
    }

    #[test]
    fn test_telegram_bot_info_deserialization() {
        let info = TelegramBotInfo {
            ok: true,
            description: None,
            username: Some("test_bot".to_string()),
            first_name: Some("Test Bot".to_string()),
        };

        let json = serde_json::to_string(&info).unwrap();
        assert!(json.contains("test_bot"));
        assert!(json.contains("Test Bot"));
    }

    #[tokio::test]
    async fn test_telegram_connection_empty_token_fails() {
        let result = test_telegram_connection(Some("".to_string())).await;
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Telegram integration is not enabled"));
    }

    #[tokio::test]
    async fn test_send_telegram_message_empty_fields_fail() {
        let result =
            send_telegram_message(Some("".to_string()), "123".to_string(), "hi".to_string()).await;
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Telegram integration is not enabled"));

        let result =
            send_telegram_message(Some("tok".to_string()), "".to_string(), "hi".to_string()).await;
        assert!(result.is_err());

        let result =
            send_telegram_message(Some("tok".to_string()), "123".to_string(), "".to_string()).await;
        assert!(result.is_err());
    }
}
