use anyhow::{Context, Result};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;

use crate::services::encryption_service::EncryptionService;
use crate::utils::paths;

pub struct SecretsService;

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct Secrets {
    #[serde(default)]
    pub claude_api_key: Option<String>,
    #[serde(default)]
    pub gemini_api_key: Option<String>,
    #[serde(default)]
    pub n8n_webhook_url: Option<String>,
    #[serde(default)]
    pub custom_api_keys: HashMap<String, String>,
}

impl SecretsService {
    /// Load secrets from secrets.encrypted.json
    pub fn load_secrets() -> Result<Secrets> {
        let secrets_path = paths::get_secrets_path()?;

        // If file doesn't exist, return empty secrets
        if !secrets_path.exists() {
            return Ok(Secrets {
                claude_api_key: None,
                gemini_api_key: None,
                n8n_webhook_url: None,
                custom_api_keys: HashMap::new(),
            });
        }

        let content = fs::read_to_string(&secrets_path).context("Failed to read secrets file")?;

        Self::parse_encrypted_secrets(&content)
    }

    /// Parse secrets from encrypted JSON
    fn parse_encrypted_secrets(content: &str) -> Result<Secrets> {
        // Parse as JSON (only format supported now)
        let json_wrapper: serde_json::Value =
            serde_json::from_str(content).context("Failed to parse secrets JSON")?;

        if let Some(encrypted_data) = json_wrapper.get("encrypted_data").and_then(|v| v.as_str()) {
            // Decrypt the data
            let decrypted_json = EncryptionService::decrypt(encrypted_data)
                .context("Failed to decrypt secrets from JSON")?;

            // Deserialize from JSON
            let secrets: Secrets = serde_json::from_str(&decrypted_json)
                .context("Failed to parse decrypted secrets")?;

            return Ok(secrets);
        }

        Err(anyhow::anyhow!("Invalid secrets file structure"))
    }

    /// Save secrets to secrets.encrypted.json
    pub fn save_secrets(new_secrets: &Secrets) -> Result<()> {
        let secrets_path = paths::get_secrets_path()?;

        // Load existing secrets to merge
        let mut secrets = Self::load_secrets().unwrap_or(Secrets {
            claude_api_key: None,
            gemini_api_key: None,
            n8n_webhook_url: None,
            custom_api_keys: HashMap::new(),
        });

        // Update fields if they are provided in new_secrets
        if new_secrets.claude_api_key.is_some() {
            secrets.claude_api_key = new_secrets.claude_api_key.clone();
        }
        if new_secrets.gemini_api_key.is_some() {
            secrets.gemini_api_key = new_secrets.gemini_api_key.clone();
        }
        if new_secrets.n8n_webhook_url.is_some() {
            secrets.n8n_webhook_url = new_secrets.n8n_webhook_url.clone();
        }
        for (key, value) in &new_secrets.custom_api_keys {
            secrets.custom_api_keys.insert(key.clone(), value.clone());
        }

        // Ensure directory exists
        if let Some(parent) = secrets_path.parent() {
            fs::create_dir_all(parent).context("Failed to create secrets directory")?;
        }

        let content = Self::format_encrypted_secrets(&secrets)?;
        fs::write(&secrets_path, content).context("Failed to write secrets file")?;

        Ok(())
    }

    /// Format secrets as encrypted JSON content
    fn format_encrypted_secrets(secrets: &Secrets) -> Result<String> {
        // Serialize to JSON
        let json_data = serde_json::to_string(secrets).context("Failed to serialize secrets")?;

        // Encrypt
        let encrypted_data =
            EncryptionService::encrypt(&json_data).context("Failed to encrypt secrets")?;

        // Get current timestamp
        let now: DateTime<Utc> = Utc::now();
        let timestamp = now.to_rfc3339();

        // Create JSON wrapper
        let wrapper = serde_json::json!({
            "encrypted": true,
            "version": "1.0.0",
            "last_updated": timestamp,
            "encrypted_data": encrypted_data
        });

        Ok(serde_json::to_string_pretty(&wrapper)?)
    }

    /// Get Claude API key
    pub fn get_claude_api_key() -> Result<Option<String>> {
        let secrets = Self::load_secrets()?;
        Ok(secrets.claude_api_key)
    }

    /// Get a secret by its ID
    pub fn get_secret(id: &str) -> Result<Option<String>> {
        let secrets = Self::load_secrets()?;

        // Check for common IDs
        if id == "claude_api_key" || id == "ANTHROPIC_API_KEY" {
            if let Some(key) = &secrets.claude_api_key {
                return Ok(Some(key.clone()));
            }
        }

        if id == "gemini_api_key" || id == "GEMINI_API_KEY" {
            if let Some(key) = &secrets.gemini_api_key {
                return Ok(Some(key.clone()));
            }
        }

        if id == "n8n_webhook_url" {
            if let Some(url) = &secrets.n8n_webhook_url {
                return Ok(Some(url.clone()));
            }
        }

        // Check custom API keys
        Ok(secrets.custom_api_keys.get(id).cloned())
    }

    /// Check if Claude API key exists
    pub fn has_claude_api_key() -> Result<bool> {
        let secrets = Self::load_secrets()?;
        Ok(secrets.claude_api_key.is_some())
    }

    /// Check if Gemini API key exists
    pub fn has_gemini_api_key() -> Result<bool> {
        let secrets = Self::load_secrets()?;
        Ok(secrets.gemini_api_key.is_some())
    }

    /// List saved secret IDs without returning secret values.
    pub fn list_saved_secret_ids() -> Result<Vec<String>> {
        let secrets = Self::load_secrets()?;
        let mut ids = Vec::new();

        if secrets.claude_api_key.is_some() {
            ids.push("claude_api_key".to_string());
            ids.push("ANTHROPIC_API_KEY".to_string());
        }
        if secrets.gemini_api_key.is_some() {
            ids.push("gemini_api_key".to_string());
            ids.push("GEMINI_API_KEY".to_string());
        }
        if secrets.n8n_webhook_url.is_some() {
            ids.push("n8n_webhook_url".to_string());
        }

        for key in secrets.custom_api_keys.keys() {
            ids.push(key.clone());
        }

        ids.sort();
        ids.dedup();
        Ok(ids)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;

    // Use a mutex to ensure tests run serially and don't interfere with each other
    static TEST_MUTEX: Mutex<()> = Mutex::new(());

    #[test]
    fn test_encrypt_decrypt_secrets() {
        let _lock = TEST_MUTEX.lock().unwrap();

        // Clean up any existing master key
        let _ = EncryptionService::delete_master_key();

        let secrets = Secrets {
            claude_api_key: Some("test_claude_key".to_string()),
            gemini_api_key: Some("test_gemini_key".to_string()),
            n8n_webhook_url: Some("https://example.com/webhook".to_string()),
            custom_api_keys: {
                let mut map = HashMap::new();
                map.insert("openai".to_string(), "sk-openai-test".to_string());
                map
            },
        };

        // Format and parse
        let formatted = SecretsService::format_encrypted_secrets(&secrets).unwrap();
        let parsed = SecretsService::parse_encrypted_secrets(&formatted).unwrap();

        assert_eq!(parsed.claude_api_key, secrets.claude_api_key);
        assert_eq!(parsed.gemini_api_key, secrets.gemini_api_key);
        assert_eq!(parsed.n8n_webhook_url, secrets.n8n_webhook_url);
        assert_eq!(
            parsed.custom_api_keys.get("openai"),
            secrets.custom_api_keys.get("openai")
        );

        // Clean up
        let _ = EncryptionService::delete_master_key();
    }

    #[test]
    fn test_format_encrypted_secrets_structure() {
        let _lock = TEST_MUTEX.lock().unwrap();

        // Clean up any existing master key
        let _ = EncryptionService::delete_master_key();

        let secrets = Secrets {
            claude_api_key: Some("test_claude_key".to_string()),
            gemini_api_key: None,
            n8n_webhook_url: None,
            custom_api_keys: HashMap::new(),
        };

        let content = SecretsService::format_encrypted_secrets(&secrets).unwrap();

        // Verify structure
        assert!(content.starts_with("{"));
        assert!(content.contains("\"encrypted\": true"));
        assert!(content.contains("\"version\": \"1.0.0\""));
        assert!(content.contains("\"last_updated\":"));
        assert!(content.contains("\"encrypted_data\":"));

        // Clean up
        let _ = EncryptionService::delete_master_key();
    }
}
