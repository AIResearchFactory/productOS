import crypto from 'node:crypto';
import { execSync } from 'node:child_process';

const APP_NAME = 'ai-research-assistant';
const MASTER_KEY_NAME = 'master_encryption_key';

let sessionKey = null;

export class EncryptionService {
  static getOrCreateMasterKey() {
    if (sessionKey) return sessionKey;

    try {
      // Try to fetch from macOS keychain
      const output = execSync(
        `security find-generic-password -s "${APP_NAME}" -a "${MASTER_KEY_NAME}" -w`,
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
      ).trim();

      if (output) {
        sessionKey = Buffer.from(output, 'base64');
        return sessionKey;
      }
    } catch (error) {
      // Key not found or other error
    }

    // Fallback: Generate new key
    const newKey = crypto.randomBytes(32);
    const keyBase64 = newKey.toString('base64');

    try {
      // Try to store in macOS keychain
      execSync(
        `security add-generic-password -s "${APP_NAME}" -a "${MASTER_KEY_NAME}" -w "${keyBase64}" -U`,
        { stdio: 'ignore' }
      );
      sessionKey = newKey;
      return sessionKey;
    } catch (error) {
      console.error('[EncryptionService] Failed to store master key in keychain, falling back to session-only key.');
      sessionKey = newKey;
      return sessionKey;
    }
  }

  static encrypt(data) {
    const key = this.getOrCreateMasterKey();
    const nonce = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, nonce);
    
    let ciphertext = cipher.update(data, 'utf8');
    ciphertext = Buffer.concat([ciphertext, cipher.final()]);
    const tag = cipher.getAuthTag();

    // Combine: nonce (12) + ciphertext + tag (16)
    const combined = Buffer.concat([nonce, ciphertext, tag]);
    return combined.toString('base64');
  }

  static decrypt(encryptedData) {
    const key = this.getOrCreateMasterKey();
    const combined = Buffer.from(encryptedData, 'base64');

    if (combined.length < 28) { // 12 (nonce) + 0 (min ciphertext) + 16 (tag)
      throw new Error('Invalid encrypted data: too short');
    }

    const nonce = combined.subarray(0, 12);
    const tag = combined.subarray(combined.length - 16);
    const ciphertext = combined.subarray(12, combined.length - 16);

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, nonce);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(ciphertext, undefined, 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}
