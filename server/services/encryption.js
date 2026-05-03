import crypto from 'crypto';

/**
 * Encryption Service using AES-256-GCM.
 * Backward-compatible with the Rust EncryptionService format:
 *   encrypted blob = base64(nonce[12] + ciphertext + authTag[16])
 *
 * Master key is stored in the OS keyring under service "ai-research-assistant" / key "master_encryption_key".
 * Falls back to in-memory session key if keyring is unavailable.
 */

const APP_NAME = 'productos';
const MASTER_KEY_NAME = 'master_encryption_key';
const ALGORITHM = 'aes-256-gcm';
const NONCE_LENGTH = 12;
const KEY_LENGTH = 32;

let _masterKeyCache = null;  // Buffer
let _keytarModule = null;
let _keytarLoadAttempted = false;

/**
 * Attempt to load keytar (OS keyring access).
 * Returns null if unavailable.
 */
async function getKeytar() {
  if (_keytarLoadAttempted) return _keytarModule;
  _keytarLoadAttempted = true;

  try {
    _keytarModule = await import('keytar');
    // Handle default export
    if (_keytarModule.default) _keytarModule = _keytarModule.default;
  } catch (e) {
    console.warn('[encryption] keytar not available, falling back to session key:', e.message);
    _keytarModule = null;
  }
  return _keytarModule;
}

/**
 * Get or create master key from OS keyring.
 * Falls back to in-memory session key if keyring is unavailable.
 */
export async function getOrCreateMasterKey() {
  if (_masterKeyCache) return _masterKeyCache;

  const keytar = await getKeytar();

  if (keytar) {
    try {
      // Try to load existing key
      const storedKey = await keytar.getPassword(APP_NAME, MASTER_KEY_NAME);
      if (storedKey) {
        _masterKeyCache = Buffer.from(storedKey, 'base64');
        return _masterKeyCache;
      }

      // Generate and store new key
      const newKey = crypto.randomBytes(KEY_LENGTH);
      await keytar.setPassword(APP_NAME, MASTER_KEY_NAME, newKey.toString('base64'));
      _masterKeyCache = newKey;
      return _masterKeyCache;
    } catch (e) {
      console.error('[encryption] Keyring access failed:', e.message);
      console.warn('[encryption] Falling back to in-memory session key (secrets will not persist across restarts).');
    }
  }

  // Fallback: in-memory session key
  if (!_masterKeyCache) {
    _masterKeyCache = crypto.randomBytes(KEY_LENGTH);
  }
  return _masterKeyCache;
}

/**
 * Encrypt data using AES-256-GCM.
 * Output format: base64(nonce[12] + ciphertext + authTag[16])
 * This is compatible with the Rust aes-gcm crate output format.
 */
export async function encrypt(plaintext) {
  const key = await getOrCreateMasterKey();
  const nonce = crypto.randomBytes(NONCE_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, nonce);

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Rust aes-gcm format: nonce + ciphertext + authTag appended
  const combined = Buffer.concat([nonce, encrypted, authTag]);
  return combined.toString('base64');
}

/**
 * Decrypt data using AES-256-GCM.
 * Input format: base64(nonce[12] + ciphertext + authTag[16])
 */
export async function decrypt(encryptedData) {
  const key = await getOrCreateMasterKey();
  const combined = Buffer.from(encryptedData, 'base64');

  if (combined.length < NONCE_LENGTH + 16) {
    throw new Error('Invalid encrypted data: too short');
  }

  const nonce = combined.subarray(0, NONCE_LENGTH);
  const authTag = combined.subarray(combined.length - 16);
  const ciphertext = combined.subarray(NONCE_LENGTH, combined.length - 16);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, nonce);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf-8');
}

/**
 * Delete master key from keyring (for testing/reset).
 */
export async function deleteMasterKey() {
  _masterKeyCache = null;
  const keytar = await getKeytar();
  if (keytar) {
    try {
      await keytar.deletePassword(APP_NAME, MASTER_KEY_NAME);
    } catch { /* ignore */ }
  }
}
