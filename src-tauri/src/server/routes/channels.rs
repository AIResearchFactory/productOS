use crate::commands::channel_commands;
use crate::models::settings::ChannelConfig;
use crate::services::channel_service::{TelegramBotInfo, WhatsAppInfo};
use axum::{routing::{get, post}, Json, Router};
use serde::Deserialize;
use super::utils::internal_error;

pub fn router() -> Router<super::super::AppState> {
    Router::new()
        .route("/settings", get(load_channel_settings).post(save_channel_settings))
        .route("/telegram/test", post(test_telegram_connection))
        .route("/telegram/send", post(send_telegram_message))
        .route("/whatsapp/test", post(test_whatsapp_connection))
        .route("/whatsapp/send", post(send_whatsapp_message))
}

async fn load_channel_settings() -> Result<Json<ChannelConfig>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    channel_commands::load_channel_settings()
        .await
        .map(Json)
        .map_err(internal_error)
}

#[derive(Deserialize)]
struct SaveChannelSettingsRequest {
    config: ChannelConfig,
    telegram_bot_token: Option<String>,
    whatsapp_access_token: Option<String>,
}

async fn save_channel_settings(Json(req): Json<SaveChannelSettingsRequest>) -> Result<(), (axum::http::StatusCode, Json<serde_json::Value>)> {
    channel_commands::save_channel_settings(req.config, req.telegram_bot_token, req.whatsapp_access_token)
        .await
        .map_err(internal_error)
}

#[derive(Deserialize)]
struct TelegramTestRequest {
    bot_token: Option<String>,
}

async fn test_telegram_connection(Json(req): Json<TelegramTestRequest>) -> Result<Json<TelegramBotInfo>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    channel_commands::test_telegram_connection(req.bot_token)
        .await
        .map(Json)
        .map_err(internal_error)
}

#[derive(Deserialize)]
struct TelegramSendRequest {
    bot_token: Option<String>,
    chat_id: String,
    text: String,
}

async fn send_telegram_message(Json(req): Json<TelegramSendRequest>) -> Result<Json<String>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    channel_commands::send_telegram_message(req.bot_token, req.chat_id, req.text)
        .await
        .map(Json)
        .map_err(internal_error)
}

#[derive(Deserialize)]
struct WhatsAppTestRequest {
    access_token: Option<String>,
    phone_number_id: Option<String>,
}

async fn test_whatsapp_connection(Json(req): Json<WhatsAppTestRequest>) -> Result<Json<WhatsAppInfo>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    channel_commands::test_whatsapp_connection(req.access_token, req.phone_number_id)
        .await
        .map(Json)
        .map_err(internal_error)
}

#[derive(Deserialize)]
struct WhatsAppSendRequest {
    access_token: Option<String>,
    phone_number_id: Option<String>,
    recipient_phone: String,
    text: String,
}

async fn send_whatsapp_message(Json(req): Json<WhatsAppSendRequest>) -> Result<Json<String>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    channel_commands::send_whatsapp_message(req.access_token, req.phone_number_id, req.recipient_phone, req.text)
        .await
        .map(Json)
        .map_err(internal_error)
}
