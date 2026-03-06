use crate::services::encryption_service::EncryptionService;
use crate::services::secrets_service::{Secrets, SecretsService};

#[tauri::command]
pub async fn save_secrets(secrets: Secrets) -> Result<(), String> {
    SecretsService::save_secrets(&secrets).map_err(|e| format!("Failed to save secrets: {}", e))
}

#[tauri::command]
pub async fn has_claude_api_key() -> Result<bool, String> {
    let api_key = SecretsService::get_claude_api_key()
        .map_err(|e| format!("Failed to check for API key: {}", e))?;
    Ok(api_key.is_some_and(|key| !key.is_empty()))
}

#[tauri::command]
pub async fn has_gemini_api_key() -> Result<bool, String> {
    let secrets =
        SecretsService::load_secrets().map_err(|e| format!("Failed to load secrets: {}", e))?;
    Ok(secrets.gemini_api_key.map_or(false, |key| !key.is_empty()))
}

#[tauri::command]
pub async fn has_secret(id: String) -> Result<bool, String> {
    let secret = SecretsService::get_secret(&id)
        .map_err(|e| format!("Failed to check secret '{}': {}", id, e))?;
    Ok(secret.map(|s| !s.is_empty()).unwrap_or(false))
}

#[tauri::command]
pub async fn list_saved_secret_ids() -> Result<Vec<String>, String> {
    SecretsService::list_saved_secret_ids()
        .map_err(|e| format!("Failed to list saved secrets: {}", e))
}

#[tauri::command]
pub async fn test_encryption() -> Result<bool, String> {
    let test_data = "test_encryption";
    let encrypted = EncryptionService::encrypt(test_data).map_err(|e| e.to_string())?;
    let decrypted = EncryptionService::decrypt(&encrypted).map_err(|e| e.to_string())?;

    Ok(test_data == decrypted)
}

#[tauri::command]
pub async fn reset_encryption_key() -> Result<(), String> {
    EncryptionService::delete_master_key().map_err(|e| e.to_string())
}
