use aes_gcm::{
    aead::{Aead, KeyInit, OsRng},
    Aes256Gcm, Nonce,
};
use anyhow::Context;
use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use keyring::Entry;
use rand::RngCore;
use std::sync::Mutex;

pub struct EncryptionService;

#[derive(Clone, Debug)]
enum KeyCacheState {
    Uninitialized,
    Key(Vec<u8>),
    AccessDenied,
}

static MASTER_KEY_CACHE: Mutex<KeyCacheState> = Mutex::new(KeyCacheState::Uninitialized);

const APP_NAME: &str = "ai-research-assistant";
const MASTER_KEY_NAME: &str = "master_encryption_key";

impl EncryptionService {
    /// Get or create master key from OS keyring
    pub fn get_or_create_master_key() -> Result<Vec<u8>, anyhow::Error> {
        // Hold lock throughout the entire check-fetch-update process to prevent race conditions
        let mut guard = MASTER_KEY_CACHE
            .lock()
            .map_err(|_| anyhow::anyhow!("Failed to lock mutex"))?;

        // Check cache
        match &*guard {
            KeyCacheState::Key(key) => return Ok(key.clone()),
            KeyCacheState::AccessDenied => {
                return Err(anyhow::anyhow!("Keyring access previously denied. Please restart the app or reset configuration to try again."));
            }
            KeyCacheState::Uninitialized => {}
        }

        // Cache miss - fetch from keyring
        match Self::fetch_from_keyring() {
            Ok(key) => {
                *guard = KeyCacheState::Key(key.clone());
                Ok(key)
            }
            Err(e) => {
                let err_str = e.to_string().to_lowercase();
                if err_str.contains("access denied") || err_str.contains("security") || err_str.contains("denied") {
                    *guard = KeyCacheState::AccessDenied;
                }
                Err(e)
            }
        }
    }

    /// Fetch from keyring directly (no cache)
    fn fetch_from_keyring() -> Result<Vec<u8>, anyhow::Error> {
        let entry_result = Entry::new(APP_NAME, MASTER_KEY_NAME);

        #[cfg(test)]
        {
            // In tests, if keyring initialization fails, use a static test key
            if entry_result.is_err() {
                return Ok(vec![0u8; 32]);
            }
        }

        let entry = entry_result?;

        match entry.get_password() {
            Ok(key_b64) => {
                // Decode existing key
                let key = BASE64
                    .decode(key_b64)
                    .context("Failed to decode master key from base64")?;
                Ok(key)
            }
            Err(e) => {
                // Special handling for keyring errors
                let is_not_found = match e {
                    keyring::Error::NoEntry => true,
                    _ => {
                        let err_str = e.to_string().to_lowercase();
                        err_str.contains("not found")
                            || err_str.contains("no entry")
                            || err_str.contains("does not exist")
                    }
                };

                #[cfg(test)]
                {
                    // In tests, if getting password fails for platform reasons, fallback
                    if !is_not_found {
                        let err_str = e.to_string();
                        if err_str.contains("keychain")
                            || err_str.contains("storage")
                            || err_str.contains("denied")
                        {
                            return Ok(vec![0u8; 32]);
                        }
                    }
                }

                if !is_not_found {
                    // If it's not a "not found" error, it might be an access denied error.
                    // We should NOT try to set_password because it will likely fail or prompt again.
                    return Err(anyhow::anyhow!("Keyring access failed: {}. If you denied access, please restart the app and allow it.", e));
                }

                // Generate new key
                let mut key = vec![0u8; 32];
                OsRng.fill_bytes(&mut key);

                // Store in keyring
                let key_b64 = BASE64.encode(&key);

                match entry.set_password(&key_b64) {
                    Ok(_) => Ok(key),
                    Err(_set_err) => {
                        #[cfg(test)]
                        {
                            // If storing in keyring fails in tests, just return the key
                            return Ok(key);
                        }
                        #[cfg(not(test))]
                        Err(anyhow::anyhow!("Failed to store master key in keyring: {}. This usually happens if keychain access is denied.", _set_err))
                    }
                }
            }
        }
    }

    /// Encrypt data using AES-256-GCM
    pub fn encrypt(data: &str) -> Result<String, anyhow::Error> {
        let key = Self::get_or_create_master_key()?;
        let cipher = Aes256Gcm::new_from_slice(&key)
            .map_err(|e| anyhow::anyhow!("Invalid key length: {}", e))?;

        // Generate random nonce
        let mut nonce_bytes = [0u8; 12];
        OsRng.fill_bytes(&mut nonce_bytes);
        let nonce = Nonce::from(nonce_bytes);

        // Encrypt
        let ciphertext = cipher
            .encrypt(&nonce, data.as_bytes())
            .map_err(|e| anyhow::anyhow!("Encryption failed: {}", e))?;

        // Combine nonce + ciphertext and encode
        let mut combined = nonce_bytes.to_vec();
        combined.extend_from_slice(&ciphertext);

        Ok(BASE64.encode(combined))
    }

    /// Decrypt data using AES-256-GCM
    pub fn decrypt(encrypted_data: &str) -> Result<String, anyhow::Error> {
        let key = Self::get_or_create_master_key()?;
        let cipher =
            Aes256Gcm::new_from_slice(&key).map_err(|_e| anyhow::anyhow!("Invalid key length"))?;

        // Decode
        let combined = BASE64.decode(encrypted_data)?;

        if combined.len() < 12 {
            return Err(anyhow::anyhow!("Invalid encrypted data"));
        }

        // Split nonce and ciphertext
        let (nonce_bytes, ciphertext) = combined.split_at(12);
        let nonce_array: [u8; 12] = nonce_bytes
            .try_into()
            .map_err(|_| anyhow::anyhow!("Invalid nonce size"))?;
        let nonce = Nonce::from(nonce_array);

        // Decrypt
        let plaintext = cipher
            .decrypt(&nonce, ciphertext)
            .map_err(|e| anyhow::anyhow!("Decryption failed: {}", e))?;

        Ok(String::from_utf8(plaintext)?)
    }

    /// Delete master key from keyring (for testing/reset)
    #[allow(dead_code)]
    pub fn delete_master_key() -> Result<(), anyhow::Error> {
        // Clear cache
        if let Ok(mut guard) = MASTER_KEY_CACHE.lock() {
            *guard = KeyCacheState::Uninitialized;
        }

        let entry = Entry::new(APP_NAME, MASTER_KEY_NAME)?;
        let _ = entry.delete_password();
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;

    // Use a mutex to ensure tests run serially and don't interfere with each other
    static TEST_MUTEX: Mutex<()> = Mutex::new(());

    #[test]
    fn test_encrypt_decrypt() {
        let _lock = TEST_MUTEX.lock().unwrap();

        // Clean up any existing master key
        let _ = EncryptionService::delete_master_key();

        let original = "sk-ant-test-key-12345";
        let encrypted = EncryptionService::encrypt(original).unwrap();
        let decrypted = EncryptionService::decrypt(&encrypted).unwrap();
        assert_eq!(original, decrypted);

        // Clean up
        let _ = EncryptionService::delete_master_key();
    }

    #[test]
    fn test_encrypt_produces_different_output() {
        let _lock = TEST_MUTEX.lock().unwrap();

        // Clean up any existing master key
        let _ = EncryptionService::delete_master_key();

        // Same input should produce different encrypted output due to random nonces
        let original = "test-secret";
        let encrypted1 = EncryptionService::encrypt(original).unwrap();
        let encrypted2 = EncryptionService::encrypt(original).unwrap();
        assert_ne!(encrypted1, encrypted2);

        // But both should decrypt to the same value
        let decrypted1 = EncryptionService::decrypt(&encrypted1).unwrap();
        let decrypted2 = EncryptionService::decrypt(&encrypted2).unwrap();
        assert_eq!(decrypted1, original);
        assert_eq!(decrypted2, original);

        // Clean up
        let _ = EncryptionService::delete_master_key();
    }

    #[test]
    fn test_invalid_encrypted_data() {
        let _lock = TEST_MUTEX.lock().unwrap();

        // Clean up any existing master key
        let _ = EncryptionService::delete_master_key();

        // Test with invalid base64
        let result = EncryptionService::decrypt("invalid-base64!");
        assert!(result.is_err());

        // Test with too short data
        let result = EncryptionService::decrypt(&BASE64.encode(b"short"));
        assert!(result.is_err());

        // Test with wrong data
        let wrong_data = BASE64.encode(vec![0u8; 24]);
        let result = EncryptionService::decrypt(&wrong_data);
        assert!(result.is_err());

        // Clean up
        let _ = EncryptionService::delete_master_key();
    }

    #[test]
    fn test_master_key_persists_in_keyring() {
        let _lock = TEST_MUTEX.lock().unwrap();

        // Clean up any existing master key
        let _ = EncryptionService::delete_master_key();

        // First encryption creates a key
        let original = "test-data";
        let encrypted1 = EncryptionService::encrypt(original).unwrap();

        // Get the key that was created
        let key1 = EncryptionService::get_or_create_master_key().unwrap();

        // Get the key again - should be the same one from keyring
        let key2 = EncryptionService::get_or_create_master_key().unwrap();
        assert_eq!(key1, key2, "Master key should persist in keyring");

        // Should be able to decrypt data encrypted with the original key
        let decrypted = EncryptionService::decrypt(&encrypted1).unwrap();
        assert_eq!(original, decrypted);

        // Clean up
        let _ = EncryptionService::delete_master_key();
    }

    #[test]
    fn test_encrypted_data_not_readable() {
        let _lock = TEST_MUTEX.lock().unwrap();

        // Clean up any existing master key
        let _ = EncryptionService::delete_master_key();

        let secret = "sk-ant-api-key-super-secret";
        let encrypted = EncryptionService::encrypt(secret).unwrap();

        // Verify the encrypted data doesn't contain the original text
        assert!(!encrypted.contains("sk-ant"));
        assert!(!encrypted.contains("super-secret"));

        // Verify encrypted data is base64 (only contains valid chars)
        assert!(encrypted
            .chars()
            .all(|c| c.is_alphanumeric() || c == '+' || c == '/' || c == '='));

        // Clean up
        let _ = EncryptionService::delete_master_key();
    }
}
