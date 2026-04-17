use crate::services::channel_service::{ChannelService, TelegramBotInfo, WhatsAppInfo};
use crate::models::settings::ChannelConfig;
use crate::services::settings_service::SettingsService;
use crate::services::secrets_service::SecretsService;

const TELEGRAM_BOT_TOKEN_KEY: &str = "TELEGRAM_BOT_TOKEN";
const WHATSAPP_ACCESS_TOKEN_KEY: &str = "WHATSAPP_ACCESS_TOKEN";

// ──────────────────────────── Tauri Commands ────────────────────────────

/// Test a Telegram bot token by calling the `getMe` endpoint.
#[tauri::command]
pub async fn test_telegram_connection(bot_token: Option<String>) -> Result<TelegramBotInfo, String> {
    ChannelService::test_telegram_connection(bot_token)
        .await
        .map_err(|e| e.to_string())
}

/// Send a text message to a Telegram chat via the Bot API.
#[tauri::command]
pub async fn send_telegram_message(
    bot_token: Option<String>,
    chat_id: String,
    text: String,
) -> Result<String, String> {
    ChannelService::send_telegram_message(bot_token, chat_id, text)
        .await
        .map_err(|e| e.to_string())
}

/// Test a WhatsApp access token by calling the Meta Graph API.
#[tauri::command]
pub async fn test_whatsapp_connection(
    access_token: Option<String>,
    phone_number_id: Option<String>,
) -> Result<WhatsAppInfo, String> {
    ChannelService::test_whatsapp_connection(access_token, phone_number_id)
        .await
        .map_err(|e| e.to_string())
}

/// Send a text message via WhatsApp Meta Cloud API.
#[tauri::command]
pub async fn send_whatsapp_message(
    access_token: Option<String>,
    phone_number_id: Option<String>,
    recipient_phone: String,
    text: String,
) -> Result<String, String> {
    ChannelService::send_whatsapp_message(access_token, phone_number_id, recipient_phone, text)
        .await
        .map_err(|e| e.to_string())
}

/// Load channel configuration. Checks secret existence for UI state.
#[tauri::command]
pub async fn load_channel_settings() -> Result<ChannelConfig, String> {
    let settings = SettingsService::load_global_settings().map_err(|e| e.to_string())?;
    let mut config = settings.channel_config.unwrap_or_default();

    // Check if secrets exist to correctly reflect state in the UI
    config.has_telegram_token = SecretsService::get_secret(TELEGRAM_BOT_TOKEN_KEY)
        .map_err(|e| e.to_string())?
        .is_some();
    config.has_whatsapp_token = SecretsService::get_secret(WHATSAPP_ACCESS_TOKEN_KEY)
        .map_err(|e| e.to_string())?
        .is_some();

    Ok(config)
}

/// Save channel configuration. Secrets go to the encrypted store; non-secret
/// settings are persisted in the global config file.
#[tauri::command]
pub async fn save_channel_settings(
    config: ChannelConfig,
    telegram_bot_token: Option<String>,
    whatsapp_access_token: Option<String>,
) -> Result<(), String> {
    // 1. Save secrets if provided
    if let Some(token) = telegram_bot_token {
        if !token.is_empty() && !token.starts_with('•') {
            SecretsService::set_secret(TELEGRAM_BOT_TOKEN_KEY, &token)
                .map_err(|e| format!("Failed to save Telegram token: {}", e))?;
        }
    }

    if let Some(token) = whatsapp_access_token {
        if !token.is_empty() && !token.starts_with('•') {
            SecretsService::set_secret(WHATSAPP_ACCESS_TOKEN_KEY, &token)
                .map_err(|e| format!("Failed to save WhatsApp token: {}", e))?;
        }
    }

    // 2. Load global settings and update the channel_config field
    let mut settings = SettingsService::load_global_settings().map_err(|e| e.to_string())?;

    // We only preserve the persistent fields from the incoming config
    settings.channel_config = Some(config);

    // 3. Persist back to disk
    SettingsService::save_global_settings(&settings).map_err(|e| e.to_string())?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    #[ignore = "Fails if user has a global OS keyring Telegram token"]
    async fn test_telegram_connection_empty_token_fails() {
        std::env::set_var("PROJECTS_DIR", "/tmp/nonexistent-ai-researcher-test-1");
        let result = test_telegram_connection(Some("".to_string())).await;
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Telegram integration is not enabled"));
    }

    #[tokio::test]
    #[ignore = "Fails if user has a global OS keyring Telegram token"]
    async fn test_send_telegram_message_empty_fields_fail() {
        std::env::set_var("PROJECTS_DIR", "/tmp/nonexistent-ai-researcher-test-2");
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
